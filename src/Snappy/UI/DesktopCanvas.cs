using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.UI;

/// <summary>
/// What Snappy leaves on the desktop while she's out of her window: marker writing, a sticky note, a poster of herself,
/// a polaroid, made-up notifications, confetti. All of it is drawn on one see-through, click-through layer over the
/// screen, excluded from screen capture, and wiped away when she's back. Nothing on the PC itself changes, and the
/// polaroid is only ever shown, never saved.
/// </summary>
internal sealed class DesktopCanvas : Form
{
    private sealed class Prop
    {
        public string Id = "", Kind = "", Text = "";
        public PointF At;          // where it sits, as a fraction of the work area
        public long Born, Gone = -1;
        public float Angle;
        public Bitmap? Image;
    }

    private sealed class Bit
    {
        public PointF P, V;
        public float R, Spin;
        public Color C;
    }

    private sealed class Shard
    {
        public PointF P, V;
        public float R, Spin, Size;
        public PointF[] Shape = Array.Empty<PointF>();
    }

    private readonly List<Prop> _props = new();
    private readonly List<Shard> _shards = new();
    private Func<PointF>? _beamTo;   // the tractor beam: from a point on the window to wherever she is
    private PointF _beamFrom;
    private long _beamAt;
    private bool _beamWeak;
    private readonly List<Bit> _confetti = new();
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 30 };
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private Rectangle _area;
    private long _confettiUntil, _lastTick;

    public DesktopCanvas(Rectangle area)
    {
        _area = area;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
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
        if (!SetWindowDisplayAffinity(Handle, 0x11)) Log.Warn("Desktop canvas could not be excluded from capture");
    }

    private void Wake()
    {
        if (!IsHandleCreated) CreateHandle();
        ShowWindow(Handle, 4 /* SW_SHOWNOACTIVATE */);
        SetWindowPos(Handle, new IntPtr(-1) /* HWND_TOPMOST */, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
        _timer.Start();
    }

    /// <summary>Puts something on the desktop: graffiti, note, poster or toast, at a spot given as fractions of the work area.</summary>
    public void Add(string id, string kind, string text, float fx, float fy)
    {
        _props.RemoveAll(p => p.Id == id);
        _props.Add(new Prop { Id = id, Kind = kind, Text = text, At = new PointF(fx, fy), Born = _clock.ElapsedMilliseconds, Angle = kind switch { "graffiti" => -6, "note" => 4, "photo" => -5, _ => 0 } });
        Wake();
    }

    /// <summary>A polaroid of the screen as it is right now (without Snappy, who never shows up in captures).</summary>
    public void Photo(string id, float fx, float fy)
    {
        var shot = new Bitmap(_area.Width / 4, _area.Height / 4, PixelFormat.Format32bppPArgb);
        try
        {
            using var full = new Bitmap(_area.Width, _area.Height, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(full)) g.CopyFromScreen(_area.Location, Point.Empty, _area.Size);
            using (var g = Graphics.FromImage(shot))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(full, new Rectangle(0, 0, shot.Width, shot.Height));
            }
        }
        catch (Exception ex)
        {
            Log.Warn($"Desktop photo failed: {ex.Message}");
        }
        Add(id, "photo", "say cheese!", fx, fy);
        _props[^1].Image = shot;
    }

    public void Confetti(int ms)
    {
        var rng = Random.Shared;
        var colors = new[] { Color.FromArgb(255, 216, 77), Color.FromArgb(54, 215, 122), Color.FromArgb(255, 122, 147), Color.FromArgb(126, 232, 255), Color.White, Color.FromArgb(178, 140, 255) };
        for (int i = 0; i < 160; i++)
            _confetti.Add(new Bit
            {
                P = new PointF(rng.NextSingle() * _area.Width, -rng.NextSingle() * _area.Height * 0.6f),
                V = new PointF((rng.NextSingle() - 0.5f) * 0.12f, 0.12f + rng.NextSingle() * 0.18f),
                R = rng.NextSingle() * 6.3f, Spin = (rng.NextSingle() - 0.5f) * 0.012f, C = colors[rng.Next(colors.Length)],
            });
        _confettiUntil = _clock.ElapsedMilliseconds + ms;
        Wake();
    }

    /// <summary>Pieces of the window flying out from a point on the screen, towards one side (1 right, -1 left).</summary>
    public void Shatter(PointF at, int side)
    {
        var rng = Random.Shared;
        var local = new PointF(at.X - _area.X, at.Y - _area.Y);
        for (int i = 0; i < 34; i++)
        {
            float size = 8 + rng.NextSingle() * 22;
            var shape = Enumerable.Range(0, 3 + rng.Next(2)).Select(k =>
            {
                double a = k * Math.PI * 2 / 3.4 + rng.NextDouble() * 0.9;
                float r = size * (0.5f + rng.NextSingle() * 0.6f);
                return new PointF((float)Math.Cos(a) * r, (float)Math.Sin(a) * r);
            }).ToArray();
            _shards.Add(new Shard
            {
                P = new PointF(local.X, local.Y + (rng.NextSingle() - 0.5f) * 160),
                V = new PointF(side * (0.25f + rng.NextSingle() * 0.75f), -0.35f - rng.NextSingle() * 0.55f),
                R = rng.NextSingle() * 6.3f, Spin = (rng.NextSingle() - 0.5f) * 0.03f, Size = size, Shape = shape,
            });
        }
        Wake();
    }

    /// <summary>The Program's tractor beam, from a point on the screen to her; weak, it flickers and gives up.</summary>
    public void Beam(PointF from, Func<PointF>? to, bool weak)
    {
        _beamFrom = new PointF(from.X - _area.X, from.Y - _area.Y);
        _beamTo = to;
        _beamWeak = weak;
        _beamAt = _clock.ElapsedMilliseconds;
        Wake();
    }

    /// <summary>Takes one thing away (or everything, with null): it wipes off, or fades.</summary>
    public void Remove(string? id)
    {
        long now = _clock.ElapsedMilliseconds;
        foreach (var p in _props) if ((id == null || p.Id == id) && p.Gone < 0) p.Gone = now;
        if (id == null) { _confettiUntil = now; _beamTo = null; }
        if (id == "beam") _beamTo = null;
        Wake();
    }

    private void Render()
    {
        long now = _clock.ElapsedMilliseconds;
        long dt = Math.Clamp(now - _lastTick, 1, 60);
        _lastTick = now;
        foreach (var p in _props.Where(p => p.Gone >= 0 && now - p.Gone > 450).ToList())
        {
            p.Image?.Dispose();
            _props.Remove(p);
        }
        foreach (var b in _confetti)
        {
            b.P = new PointF(b.P.X + b.V.X * dt + MathF.Sin((now + b.R * 900) / 300f) * 0.6f, b.P.Y + b.V.Y * dt);
            b.R += b.Spin * dt;
        }
        _confetti.RemoveAll(b => b.P.Y > _area.Height + 20 || now > _confettiUntil + 1500);
        foreach (var sh in _shards)
        {
            sh.V = new PointF(sh.V.X * 0.995f, sh.V.Y + 0.0024f * dt);
            sh.P = new PointF(sh.P.X + sh.V.X * dt, sh.P.Y + sh.V.Y * dt);
            sh.R += sh.Spin * dt;
        }
        _shards.RemoveAll(sh => sh.P.Y > _area.Height + 40);
        bool moving = _confetti.Count > 0 || _shards.Count > 0 || _beamTo != null || _props.Any(p => now - p.Born < 1800 || p.Gone >= 0 || p.Kind == "poster");
        if (_props.Count == 0 && _confetti.Count == 0 && _shards.Count == 0 && _beamTo == null)
        {
            _timer.Stop();
            ShowWindow(Handle, 0 /* SW_HIDE */);
            return;
        }

        using var bmp = new Bitmap(_area.Width, _area.Height, PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);
            float s = DeviceDpi / 96f;
            foreach (var p in _props)
            {
                double age = now - p.Born;
                float fade = p.Gone >= 0 ? 1 - Math.Clamp((now - p.Gone) / 450f, 0, 1) : 1;
                var at = new PointF(_area.Width * p.At.X, _area.Height * p.At.Y);
                var state = g.Save();
                g.TranslateTransform(at.X, at.Y);
                g.RotateTransform(p.Angle);
                switch (p.Kind)
                {
                    case "graffiti": Graffiti(g, p.Text, (float)Math.Clamp(age / 1600, 0, 1), fade, p.Gone >= 0 ? Math.Clamp((now - p.Gone) / 450f, 0, 1) : 0, s); break;
                    case "note": Note(g, p.Text, Pop(age), fade, s); break;
                    case "photo": Polaroid(g, p, Pop(age), fade, s); break;
                    case "toast": Toast(g, p.Text, (float)Math.Clamp(age / 380, 0, 1), fade, s); break;
                    case "poster": Poster(g, (float)Math.Clamp(age / 600, 0, 1) * fade, now, s); break;
                }
                g.Restore(state);
            }
            foreach (var sh in _shards)
            {
                var state = g.Save();
                g.TranslateTransform(sh.P.X, sh.P.Y);
                g.RotateTransform(sh.R * 57.3f);
                using var glass = new SolidBrush(Color.FromArgb(150, 200, 236, 255));
                using var glint = new Pen(Color.FromArgb(230, 255, 255, 255), 1.6f * s);
                g.FillPolygon(glass, sh.Shape);
                g.DrawPolygon(glint, sh.Shape);
                g.Restore(state);
            }
            if (_beamTo != null)
            {
                var to = _beamTo();
                to = new PointF(to.X - _area.X, to.Y - _area.Y - 50 * s);
                double age = now - _beamAt;
                // a weak beam stutters; a strong one hums steady
                float power = _beamWeak ? (float)(0.45 + 0.4 * Math.Sin(age / 37.0) * Math.Sin(age / 91.0)) : (float)Math.Min(1, age / 300.0);
                for (int i = 3; i >= 0; i--)
                {
                    using var pen = new Pen(Color.FromArgb((int)(Math.Clamp(power, 0, 1) * (i == 0 ? 230 : 60)), i == 0 ? 220 : 110, i == 0 ? 248 : 215, 255), (i == 0 ? 4 : 10 + i * 12) * s) { StartCap = LineCap.Round, EndCap = LineCap.Round };
                    g.DrawLine(pen, _beamFrom, to);
                }
                using var ring = new Pen(Color.FromArgb((int)(Math.Clamp(power, 0, 1) * 200), 160, 230, 255), 3 * s);
                float rr = (float)(40 + 10 * Math.Sin(age / 120.0)) * s;
                g.DrawEllipse(ring, to.X - rr, to.Y - rr, rr * 2, rr * 2);
            }
            foreach (var b in _confetti)
            {
                var state = g.Save();
                g.TranslateTransform(b.P.X, b.P.Y);
                g.RotateTransform(b.R * 57.3f);
                using var brush = new SolidBrush(b.C);
                g.FillRectangle(brush, -5 * s, -2.5f * s * MathF.Abs(MathF.Cos(b.R * 2)) - 1, 10 * s, 5 * s * MathF.Abs(MathF.Cos(b.R * 2)) + 1);
                g.Restore(state);
            }
        }
        PushLayered(bmp, _area.X, _area.Y);
        _timer.Interval = moving ? 30 : 250;
    }

    // a springy scale from 0 to 1 over the first half second
    private static float Pop(double age)
    {
        double t = Math.Clamp(age / 520, 0, 1);
        return (float)(1 - Math.Exp(-6 * t) * Math.Cos(9 * t));
    }

    private static Font Hand(float size) =>
        FontFamily.Families.Any(f => f.Name == "Ink Free") ? new Font("Ink Free", size, FontStyle.Bold, GraphicsUnit.Pixel)
            : new Font("Segoe Print", size, FontStyle.Bold, GraphicsUnit.Pixel);

    // marker writing, revealed left to right as she writes it, rubbed off from the left when it goes
    private static void Graffiti(Graphics g, string text, float written, float fade, float wiped, float s)
    {
        using var font = Hand(96 * s);
        var size = g.MeasureString(text, font);
        var box = new RectangleF(-size.Width / 2, -size.Height / 2, size.Width, size.Height);
        g.SetClip(new RectangleF(box.X + box.Width * wiped, box.Y - 20, box.Width * (written - wiped), box.Height + 40));
        using var path = new GraphicsPath();
        path.AddString(text, font.FontFamily, (int)font.Style, font.Size, new PointF(box.X, box.Y), StringFormat.GenericDefault);
        using var outline = new Pen(Color.FromArgb((int)(220 * fade), 20, 10, 14), 10 * s) { LineJoin = LineJoin.Round };
        using var ink = new SolidBrush(Color.FromArgb((int)(240 * fade), 232, 52, 74));
        g.DrawPath(outline, path);
        g.FillPath(ink, path);
        g.ResetClip();
    }

    private static void Note(Graphics g, string text, float pop, float fade, float s)
    {
        g.ScaleTransform(pop, pop);
        float w = 230 * s;
        var r = new RectangleF(-w / 2, -w / 2, w, w);
        using (var shade = new SolidBrush(Color.FromArgb((int)(70 * fade), 0, 0, 0))) g.FillRectangle(shade, r.X + 6 * s, r.Y + 8 * s, w, w);
        using (var paper = new SolidBrush(Color.FromArgb((int)(255 * fade), 255, 226, 110))) g.FillRectangle(paper, r);
        using (var top = new SolidBrush(Color.FromArgb((int)(255 * fade), 245, 205, 80))) g.FillRectangle(top, r.X, r.Y, w, 26 * s);
        using var font = Hand(25 * s);
        using var ink = new SolidBrush(Color.FromArgb((int)(255 * fade), 40, 34, 60));
        g.DrawString(text, font, ink, new RectangleF(r.X + 18 * s, r.Y + 40 * s, w - 36 * s, w - 50 * s));
    }

    private static void Polaroid(Graphics g, Prop p, float pop, float fade, float s)
    {
        if (p.Image == null) return;
        g.ScaleTransform(pop, pop);
        float iw = 360 * s, ih = iw * p.Image.Height / p.Image.Width, pad = 16 * s;
        var frame = new RectangleF(-iw / 2 - pad, -ih / 2 - pad, iw + pad * 2, ih + pad * 2 + 52 * s);
        using (var shade = new SolidBrush(Color.FromArgb((int)(80 * fade), 0, 0, 0))) g.FillRectangle(shade, frame.X + 8 * s, frame.Y + 10 * s, frame.Width, frame.Height);
        using (var white = new SolidBrush(Color.FromArgb((int)(255 * fade), 250, 250, 246))) g.FillRectangle(white, frame);
        using var attrs = new ImageAttributes();
        attrs.SetColorMatrix(new ColorMatrix { Matrix33 = fade });
        g.DrawImage(p.Image, Rectangle.Round(new RectangleF(-iw / 2, -ih / 2, iw, ih)), 0, 0, p.Image.Width, p.Image.Height, GraphicsUnit.Pixel, attrs);
        using var font = Hand(24 * s);
        using var ink = new SolidBrush(Color.FromArgb((int)(255 * fade), 50, 50, 60));
        var size = g.MeasureString(p.Text, font);
        g.DrawString(p.Text, font, ink, -size.Width / 2, ih / 2 + pad + 6 * s);
    }

    // a made-up notification from Snappy, sliding in from the right
    private void Toast(Graphics g, string text, float slide, float fade, float s)
    {
        float w = 360 * s, h = 86 * s;
        float off = (1 - (1 - (1 - slide) * (1 - slide))) * (w + 40 * s);
        var r = new RectangleF(-w + off, -h / 2, w, h);
        using (var path = Rounded(r, 10 * s))
        using (var card = new SolidBrush(Color.FromArgb((int)(245 * fade), 32, 32, 36)))
        using (var edge = new Pen(Color.FromArgb((int)(60 * fade), 255, 255, 255), 1))
        {
            g.FillPath(card, path);
            g.DrawPath(edge, path);
        }
        using var icon = new SolidBrush(Color.FromArgb((int)(255 * fade), 244, 244, 244));
        using (var p = Rounded(new RectangleF(r.X + 16 * s, r.Y + 20 * s, 46 * s, 34 * s), 10 * s)) g.FillPath(icon, p);
        using var dot = new SolidBrush(Color.FromArgb((int)(255 * fade), 10, 10, 10));
        g.FillEllipse(dot, r.X + 28 * s, r.Y + 30 * s, 7 * s, 10 * s);
        g.FillEllipse(dot, r.X + 43 * s, r.Y + 30 * s, 7 * s, 10 * s);
        using var title = new Font("Segoe UI Semibold", 14 * s, GraphicsUnit.Pixel);
        using var body = new Font("Segoe UI", 13 * s, GraphicsUnit.Pixel);
        using var white = new SolidBrush(Color.FromArgb((int)(255 * fade), 240, 240, 240));
        using var grey = new SolidBrush(Color.FromArgb((int)(255 * fade), 170, 170, 175));
        g.DrawString("Snappy", title, white, r.X + 76 * s, r.Y + 16 * s);
        g.DrawString(text, body, grey, new RectangleF(r.X + 76 * s, r.Y + 38 * s, w - 90 * s, h - 40 * s));
    }

    // her new wallpaper: the whole screen, with her face on it
    private void Poster(Graphics g, float shown, long now, float s)
    {
        g.ResetTransform();
        DrawPoster(g, _area.Size, shown, MathF.Sin(now / 400f));
    }

    /// <summary>Her poster: an orange-to-pink backdrop with her big face on it, filling a whole screen.</summary>
    public static void DrawPoster(Graphics g, Size area, float shown, float bob01)
    {
        using (var dim = new LinearGradientBrush(new Rectangle(0, 0, area.Width, area.Height), Color.FromArgb((int)(235 * shown), 255, 154, 64), Color.FromArgb((int)(235 * shown), 255, 107, 154), 45f))
            g.FillRectangle(dim, 0, 0, area.Width, area.Height);
        float cx = area.Width / 2f, cy = area.Height * 0.44f, k = Math.Min(area.Width, area.Height) / 900f * (0.8f + 0.2f * shown);
        float bob = bob01 * 8 * k;
        var body = new RectangleF(cx - 220 * k, cy - 150 * k + bob, 440 * k, 312 * k);
        int a = (int)(255 * shown);
        using var white = new SolidBrush(Color.FromArgb(a, 244, 244, 244));
        using var black = new SolidBrush(Color.FromArgb(a, 10, 10, 10));
        using var pink = new SolidBrush(Color.FromArgb(a, 255, 157, 176));
        using var outline = new Pen(Color.FromArgb(a, 10, 10, 10), 14 * k);
        using (var bump = Rounded(new RectangleF(cx - 150 * k, body.Y - 52 * k, 108 * k, 70 * k), 22 * k)) { g.FillPath(white, bump); g.DrawPath(outline, bump); }
        using (var p = Rounded(body, 106 * k)) { g.FillPath(white, p); g.DrawPath(outline, p); }
        g.FillEllipse(black, cx - 102 * k, cy - 50 * k + bob, 68 * k, 96 * k);
        g.FillEllipse(black, cx + 34 * k, cy - 50 * k + bob, 68 * k, 96 * k);
        g.FillEllipse(white, cx - 88 * k, cy - 36 * k + bob, 20 * k, 26 * k);
        g.FillEllipse(white, cx + 48 * k, cy - 36 * k + bob, 20 * k, 26 * k);
        g.FillEllipse(pink, cx - 172 * k, cy + 52 * k + bob, 56 * k, 32 * k);
        g.FillEllipse(pink, cx + 116 * k, cy + 52 * k + bob, 56 * k, 32 * k);
        using var font = new Font("Segoe UI Black", 64 * k, FontStyle.Bold, GraphicsUnit.Pixel);
        using var text = new SolidBrush(Color.FromArgb(a, 255, 255, 255));
        var caption = "SNAPPY";
        var size = g.MeasureString(caption, font);
        g.DrawString(caption, font, text, cx - size.Width / 2, body.Bottom + 34 * k);
    }

    private static GraphicsPath Rounded(RectangleF r, float radius)
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

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _timer.Dispose();
            foreach (var p in _props) p.Image?.Dispose();
        }
        base.Dispose(disposing);
    }

    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] private struct SIZE { public int cx, cy; }
    [StructLayout(LayoutKind.Sequential, Pack = 1)] private struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }

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
