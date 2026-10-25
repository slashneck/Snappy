using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.UI;

/// <summary>
/// Snappy out on the real desktop, for the one event where she climbs out of the app window: she stands on the taskbar,
/// hops along it and says a word or two in a bubble. For a while you can pick her up, swing her around and throw her;
/// otherwise every click goes straight through her. Never takes focus, and excluded from screen capture like the corner
/// pop-up, so she never shows up in a clip. Positions are screen pixels of her feet.
/// </summary>
internal sealed class DesktopSnappy : Form
{
    private readonly (Bitmap Sheet, AppAssets.StripInfo Info) _strip;
    private readonly (Bitmap Sheet, AppAssets.StripInfo Info) _faces;
    // her faces, in the order tools/mascot/render.mjs draws them into overlay-faces.png
    private static readonly string[] Faces = { "open", "happy", "shock", "angry", "joy", "smug", "sad", "wink", "love", "ew", "dizzy", "wince", "worried" };
    private int _face = -1, _bodyFace = -1;     // what she's saying it with, and what being thrown around does to her face
    private long _faceAt, _bodyFaceUntil;
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 15 };
    private readonly Stopwatch _clock = Stopwatch.StartNew();

    private PointF _from, _to;
    private long _moveAt, _moveMs, _shownAt, _textAt, _leaveAt = -1;
    private int _hops;
    private bool _fall;
    private string _text = "";
    private int _size = 96;
    private bool _bubbleRight; // her bubble opens away from the app window, onto the open desktop

    // picked up and thrown around: where she is, how fast she's going (pixels per millisecond) and how far she leans
    private enum Motion { Walking, Held, Flying }
    private Motion _motion = Motion.Walking;
    private PointF _pos, _vel, _grab;
    private float _tilt;
    private long _lastTick, _swungAt, _landAt = -1;
    private Rectangle _area;
    private bool _thief;
    private List<(int Left, int Right, int Y)> _ledges = new();
    private long _ledgesAt;
    private bool _onLedge;   // standing on a window: if that window goes away (or moves), down she goes
    private Point _setCursor;
    private float _struggle;

    /// <summary>What just happened to her, for the page to react to: grab, swing, throw, drop or land.</summary>
    public event Action<string>? Reacted;

    public DesktopSnappy()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        var strips = AppAssets.OverlayStrips();
        _strip = (AppAssets.LoadBitmap("overlay-happy.png"), strips["happy"]);
        _faces = (AppAssets.LoadBitmap("overlay-faces.png"), strips["faces"]);
        _timer.Tick += (_, _) => Render();
    }

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= 0x80000 /* LAYERED */ | 0x20 /* TRANSPARENT */ | 0x80 /* TOOLWINDOW */ | 0x8000000 /* NOACTIVATE */ | 0x8 /* TOPMOST */;
            return cp;
        }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        if (!SetWindowDisplayAffinity(Handle, 0x11)) Log.Warn("Desktop Snappy could not be excluded from capture");
    }

    public void Appear(PointF feet, int size, bool bubbleRight)
    {
        _size = Math.Clamp(size, 32, 400);
        _bubbleRight = bubbleRight;
        _area = Screen.FromPoint(Point.Round(feet)).WorkingArea;
        _motion = Motion.Walking;
        _from = _to = _pos = feet;
        _moveMs = 0;
        _shownAt = _clock.ElapsedMilliseconds;
        _leaveAt = -1;
        if (!IsHandleCreated) CreateHandle();
        ShowWindow(Handle, 4 /* SW_SHOWNOACTIVATE */);
        SetWindowPos(Handle, new IntPtr(-1) /* HWND_TOPMOST */, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
        _timer.Start();
        Render();
    }

    /// <summary>Hops (or, with fall, drops) from wherever she is to a new spot.</summary>
    public void GoTo(PointF feet, int ms, int hops, bool fall)
    {
        _from = Where(_clock.ElapsedMilliseconds);
        _motion = Motion.Walking;
        _onLedge = false;
        _to = feet;
        _moveAt = _clock.ElapsedMilliseconds;
        _moveMs = Math.Max(1, ms);
        _hops = Math.Max(0, hops);
        _fall = fall;
    }

    /// <summary>Back on top, e.g. above something she just put on the desktop.</summary>
    public void Raise()
    {
        if (IsHandleCreated) SetWindowPos(Handle, new IntPtr(-1) /* HWND_TOPMOST */, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
    }

    /// <summary>Moves her by so many pixels right away, e.g. along with the window she's shoving.</summary>
    public void Nudge(float dx, float dy)
    {
        _from = new PointF(_from.X + dx, _from.Y + dy);
        _to = new PointF(_to.X + dx, _to.Y + dy);
        _pos = new PointF(_pos.X + dx, _pos.Y + dy);
    }

    /// <summary>
    /// She holds on to the real mouse pointer and takes it along wherever she goes. Moving the mouse hard enough pulls
    /// it free ("cursor" with what: free); either way it's yours again the moment this is switched off.
    /// </summary>
    public void StealCursor(bool on)
    {
        _thief = on;
        _struggle = 0;
        if (on) _setCursor = Hand();
    }

    private Point Hand()
    {
        var at = Where(_clock.ElapsedMilliseconds);
        return Point.Round(new PointF(at.X + _size * 0.42f, at.Y - _size * 0.55f));
    }

    /// <summary>Where she is right now (screen pixels of her feet).</summary>
    public PointF Feet => Where(_clock.ElapsedMilliseconds);

    /// <summary>A shove from something (her own window cracking, say): off she flies.</summary>
    public void Launch(float vx, float vy)
    {
        _pos = Where(_clock.ElapsedMilliseconds);
        _vel = new PointF(vx, vy);
        _motion = Motion.Flying;
        BodyFace("joy", 60_000);
    }

    /// <summary>Her expression from now on (null: her usual happy self).</summary>
    public void Face(string? name)
    {
        _face = name == null ? -1 : Array.IndexOf(Faces, name);
        _faceAt = _clock.ElapsedMilliseconds;
    }

    private void BodyFace(string name, long ms)
    {
        _bodyFace = Array.IndexOf(Faces, name);
        _bodyFaceUntil = _clock.ElapsedMilliseconds + ms;
        _faceAt = _clock.ElapsedMilliseconds;
    }

    public void Say(string text)
    {
        _text = text ?? "";
        _textAt = _clock.ElapsedMilliseconds;
    }

    public void Vanish()
    {
        Grabbable = false;
        _thief = false;
        _leaveAt = _clock.ElapsedMilliseconds;
    }

    /// <summary>Lets you pick her up with the mouse. Otherwise every click goes straight through her.</summary>
    public bool Grabbable
    {
        set
        {
            if (!IsHandleCreated) return;
            int ex = GetWindowLong(Handle, -20 /* GWL_EXSTYLE */);
            SetWindowLong(Handle, -20, value ? ex & ~0x20 : ex | 0x20 /* TRANSPARENT */);
            Cursor = value ? Cursors.Hand : Cursors.Default;
            if (!value && _motion == Motion.Held) Release();
        }
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left || _leaveAt >= 0) return;
        _pos = Where(_clock.ElapsedMilliseconds);
        _grab = new PointF(Cursor.Position.X - _pos.X, Cursor.Position.Y - _pos.Y);
        _vel = PointF.Empty;
        _motion = Motion.Held;
        Capture = true;
        BodyFace("shock", 700);
        Reacted?.Invoke("grab");
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        base.OnMouseUp(e);
        if (_motion == Motion.Held) Release();
    }

    private void Release()
    {
        Capture = false;
        _motion = Motion.Flying;
        BodyFace("joy", 60_000);
        Reacted?.Invoke(Math.Sqrt(_vel.X * _vel.X + _vel.Y * _vel.Y) > 1.2 ? "throw" : "drop");
    }

    /// <summary>One tick of being held (she hangs from your hand and swings) or flying (gravity, walls, the taskbar).</summary>
    private void Step(long now, long dt)
    {
        if (_motion == Motion.Held)
        {
            var c = Cursor.Position;
            var next = new PointF(c.X - _grab.X, c.Y - _grab.Y);
            _vel = new PointF(_vel.X * 0.6f + (next.X - _pos.X) / dt * 0.4f, _vel.Y * 0.6f + (next.Y - _pos.Y) / dt * 0.4f);
            _pos = next;
            float lean = Math.Clamp(-_vel.X * 28, -55, 55);
            _tilt += (lean - _tilt) * 0.25f;
            if (Math.Abs(_vel.X) + Math.Abs(_vel.Y) > 2.2f && now - _swungAt > 1600)
            {
                _swungAt = now;
                BodyFace("joy", 1400);
                Reacted?.Invoke("swing");
            }
            else if (now > _bodyFaceUntil) BodyFace("worried", 300);
        }
        else if (_motion == Motion.Flying)
        {
            if (now - _ledgesAt > 400) { _ledges = DesktopWindows.Ledges(_area, (int)(_size * 0.7f)); _ledgesAt = now; }
            float before = _pos.Y;
            _vel.Y += 0.0032f * dt;
            _pos = new PointF(_pos.X + _vel.X * dt, _pos.Y + _vel.Y * dt);
            // falling onto the top of a window: she lands there
            if (_vel.Y > 0)
                foreach (var (left, right, y) in _ledges)
                    if (before <= y && _pos.Y >= y && _pos.X > left + _size * 0.25f && _pos.X < right - _size * 0.25f)
                    {
                        _pos.Y = y;
                        _vel = PointF.Empty;
                        _motion = Motion.Walking;
                        _from = _to = _pos;
                        _moveMs = 0;
                        _onLedge = true;
                        _landAt = now;
                        _tilt = ((_tilt % 360) + 540) % 360 - 180;
                        BodyFace("dizzy", 1500);
                        Reacted?.Invoke("land");
                        return;
                    }
            _tilt += _vel.X * dt * 0.35f; // tumbling
            float half = _size / 2f;
            if (_pos.X < _area.Left + half) { _pos.X = _area.Left + half; _vel.X = Math.Abs(_vel.X) * 0.6f; }
            if (_pos.X > _area.Right - half) { _pos.X = _area.Right - half; _vel.X = -Math.Abs(_vel.X) * 0.6f; }
            if (_pos.Y - _size < _area.Top) { _pos.Y = _area.Top + _size; _vel.Y = Math.Abs(_vel.Y) * 0.5f; }
            if (_pos.Y >= _area.Bottom)
            {
                _pos.Y = _area.Bottom;
                _landAt = now;
                if (_vel.Y > 0.45f)
                {
                    // a bounce, smaller each time
                    _vel.Y = -_vel.Y * 0.42f;
                    _vel.X *= 0.75f;
                }
                else
                {
                    _vel = PointF.Empty;
                    _motion = Motion.Walking;
                    _from = _to = _pos;
                    _moveMs = 0;
                    _tilt = ((_tilt % 360) + 540) % 360 - 180;
                    BodyFace("dizzy", 1500);
                    Reacted?.Invoke("land");
                }
            }
        }
        else
        {
            _tilt *= 0.82f; // back on her feet
            // the window under her moved or closed: she falls
            if (_onLedge && now - _ledgesAt > 300)
            {
                _ledges = DesktopWindows.Ledges(_area, (int)(_size * 0.5f));
                _ledgesAt = now;
                if (!_ledges.Any(l => Math.Abs(l.Y - _pos.Y) <= 4 && _pos.X > l.Left && _pos.X < l.Right))
                {
                    _onLedge = false;
                    Launch(0, 0);
                    BodyFace("shock", 800);
                }
            }
        }
    }

    private PointF Where(long now)
    {
        if (_motion != Motion.Walking) return _pos;
        if (_moveMs <= 0) return _to;
        double k = Math.Clamp((now - _moveAt) / (double)_moveMs, 0, 1);
        double ky = _fall ? k * k : k;   // falling speeds up, a hop doesn't
        return new PointF((float)(_from.X + (_to.X - _from.X) * k), (float)(_from.Y + (_to.Y - _from.Y) * ky));
    }

    private void Render()
    {
        long now = _clock.ElapsedMilliseconds;
        if (_leaveAt >= 0 && now - _leaveAt > 260)
        {
            _timer.Stop();
            ShowWindow(Handle, 0 /* SW_HIDE */);
            return;
        }
        Step(now, Math.Clamp(now - _lastTick, 1, 50));
        _lastTick = now;
        if (_thief)
        {
            // every bit you move the mouse is a tug against her; tug enough and it's free
            var c = Cursor.Position;
            _struggle += Math.Abs(c.X - _setCursor.X) + Math.Abs(c.Y - _setCursor.Y);
            if (_struggle > 900)
            {
                _thief = false;
                Reacted?.Invoke("free");
            }
            else
            {
                _setCursor = Hand();
                Cursor.Position = _setCursor;
            }
        }
        var screen = _area;
        float s = _size / 96f;
        var feet = Where(now);
        double k = _moveMs > 0 ? Math.Clamp((now - _moveAt) / (double)_moveMs, 0, 1) : 1;
        float lift = 0, squashX = 1, squashY = 1;
        if (_motion == Motion.Walking && _moveMs > 0 && k < 1 && _hops > 0)
        {
            double hop = Math.Abs(Math.Sin(k * Math.PI * _hops));
            lift = (float)(-hop * 16 * s);
            squashX = (float)(0.95 + 0.07 * (1 - hop));
            squashY = (float)(1.06 - 0.1 * (1 - hop));
        }
        else if ((_moveMs > 0 && _fall ? now - _moveAt - _moveMs : now - _landAt) is > 0 and < 260)
        {
            // landing: a squash that springs back
            double t = (_moveMs > 0 && _fall ? now - _moveAt - _moveMs : now - _landAt) / 260.0;
            squashX = (float)(1 + 0.14 * Math.Sin(t * Math.PI));
            squashY = (float)(1 - 0.16 * Math.Sin(t * Math.PI));
        }
        double since = now - _shownAt;
        float pop = (float)Math.Clamp(since / 180.0, 0, 1);
        int alpha = (int)(255 * pop * (_leaveAt >= 0 ? 1 - Math.Clamp((now - _leaveAt) / 260.0, 0, 1) : 1));

        // the bubble goes on whichever side of her has room
        using var font = new Font("Segoe UI Semibold", 14.5f * Math.Max(1, s * 0.9f), GraphicsUnit.Pixel);
        int chars = (int)Math.Max(0, (now - _textAt - 90) / 24);
        string typed = _text[..Math.Min(_text.Length, chars)];
        int pad = (int)(14 * s), tail = (int)(9 * s);
        int textW = 0;
        if (_text.Length > 0)
            using (var probe = Graphics.FromHwnd(IntPtr.Zero))
                textW = (int)Math.Ceiling(probe.MeasureString(_text, font).Width);
        int bubbleW = _text.Length > 0 ? textW + pad * 2 : 0, bubbleH = font.Height + (int)(18 * s);
        bool fitsLeft = feet.X - _size / 2f - bubbleW - tail > screen.Left + 8;
        bool fitsRight = feet.X + _size / 2f + bubbleW + tail < screen.Right - 8;
        bool bubbleLeft = _bubbleRight ? !fitsRight : fitsLeft;
        int room = (int)Math.Max(20 * s, _size * 0.45f); // space to lean and tumble in
        int width = _size + (bubbleW > 0 ? bubbleW + tail + (int)(6 * s) : 0) + room * 2;
        int height = _size + room * 2 + (int)(18 * s);
        int herX = bubbleLeft ? width - room - _size : room;
        int x = (int)Math.Round(feet.X - herX - _size / 2f), y = (int)Math.Round(feet.Y - room - _size);

        using var bmp = new Bitmap(width, height, PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);
            var her = new RectangleF(herX, room, _size, _size);
            if (bubbleW > 0 && alpha > 0)
            {
                float eyes = her.Y + _size * 0.45f + lift;
                var box = bubbleLeft
                    ? new RectangleF(her.X - (int)(6 * s) - tail - bubbleW, eyes - bubbleH / 2f, bubbleW, bubbleH)
                    : new RectangleF(her.Right + (int)(6 * s) + tail, eyes - bubbleH / 2f, bubbleW, bubbleH);
                var tip = new PointF(bubbleLeft ? box.Right + tail : box.X - tail, eyes);
                float edge = bubbleLeft ? box.Right - 2 : box.X + 2;
                using var path = RoundedRect(box, 16 * s);
                using var fill = new SolidBrush(Color.FromArgb(alpha, 244, 244, 244));
                g.FillPath(fill, path);
                g.FillPolygon(fill, new[] { new PointF(edge, eyes - tail), tip, new PointF(edge, eyes + tail) });
                using var ink = new SolidBrush(Color.FromArgb(alpha, 10, 10, 10));
                g.DrawString(typed, font, ink, new PointF(box.X + pad, box.Y + (int)(9 * s)));
            }
            if (alpha > 0)
            {
                var feetAt = new PointF(her.X + her.Width / 2, her.Bottom);
                var state = g.Save();
                // held, she hangs from where you grabbed her; otherwise she leans and tumbles around her middle
                var pivot = _motion == Motion.Held ? new PointF(feetAt.X + _grab.X, feetAt.Y + _grab.Y) : new PointF(feetAt.X, feetAt.Y - _size / 2f);
                g.TranslateTransform(pivot.X, pivot.Y);
                g.RotateTransform(_tilt);
                g.TranslateTransform(-pivot.X, -pivot.Y);
                g.TranslateTransform(feetAt.X, feetAt.Y + lift);
                g.ScaleTransform(squashX * (0.6f + 0.4f * pop), squashY * (0.6f + 0.4f * pop));
                g.TranslateTransform(-feetAt.X, -feetAt.Y);
                int face = now < _bodyFaceUntil ? _bodyFace : _face;
                var (sheet, info) = face >= 0 ? _faces : _strip;
                int frame = face >= 0 ? face : Math.Min(info.Frames - 1, (int)((now - Math.Max(_shownAt, _textAt)) / (1000 / info.Fps)));
                int col = frame % info.Cols, row = frame / info.Cols;
                // a new face comes with a little bounce
                float bounce = face >= 0 ? 1 + 0.08f * (float)Math.Max(0, 1 - (now - _faceAt) / 220.0) : 1;
                g.TranslateTransform(feetAt.X, feetAt.Y);
                g.ScaleTransform(bounce, bounce);
                g.TranslateTransform(-feetAt.X, -feetAt.Y);
                using var attrs = new ImageAttributes();
                attrs.SetColorMatrix(new ColorMatrix { Matrix33 = alpha / 255f });
                g.DrawImage(sheet, Rectangle.Round(her), col * info.Size, row * info.Size, info.Size, info.Size, GraphicsUnit.Pixel, attrs);
                g.Restore(state);
            }
        }
        PushLayered(bmp, x, y);
#if DEBUG
        if (Environment.GetEnvironmentVariable("SNAPPY_OVERLAY_DUMP") is { Length: > 0 } dumpDir && (now / 15) % 8 == 0)
        {
            Directory.CreateDirectory(dumpDir);
            bmp.Save(Path.Combine(dumpDir, $"desk-{now:D6}-{x}x{y}.png"), ImageFormat.Png);
        }
#endif
    }

    private void PushLayered(Bitmap bmp, int x, int y)
    {
        IntPtr screenDc = GetDC(IntPtr.Zero);
        IntPtr memDc = CreateCompatibleDC(screenDc);
        IntPtr hBitmap = bmp.GetHbitmap(Color.FromArgb(0));
        IntPtr old = SelectObject(memDc, hBitmap);
        try
        {
            var size = new SIZE { cx = bmp.Width, cy = bmp.Height };
            var src = new POINT();
            var dst = new POINT { x = x, y = y };
            var blend = new BLENDFUNCTION { BlendOp = 0, BlendFlags = 0, SourceConstantAlpha = 255, AlphaFormat = 1 };
            UpdateLayeredWindow(Handle, screenDc, ref dst, ref size, memDc, ref src, 0, ref blend, 2 /* ULW_ALPHA */);
        }
        finally
        {
            SelectObject(memDc, old);
            DeleteObject(hBitmap);
            DeleteDC(memDc);
            ReleaseDC(IntPtr.Zero, screenDc);
        }
    }

    private static GraphicsPath RoundedRect(RectangleF r, float radius)
    {
        float d = Math.Min(radius * 2, Math.Min(r.Width, r.Height));
        var p = new GraphicsPath();
        p.AddArc(r.X, r.Y, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _timer.Dispose();
            _strip.Sheet.Dispose();
            _faces.Sheet.Dispose();
        }
        base.Dispose(disposing);
    }

    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] private struct SIZE { public int cx, cy; }
    [StructLayout(LayoutKind.Sequential, Pack = 1)] private struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")] private static extern int SetWindowLong(IntPtr hwnd, int index, int value);
    [DllImport("user32.dll")] private static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst, ref SIZE psize, IntPtr hdcSrc, ref POINT pprSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);
    [DllImport("user32.dll")] private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
    [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    [DllImport("gdi32.dll")] private static extern bool DeleteDC(IntPtr hdc);
    [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr hdc, IntPtr obj);
    [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr obj);
}
