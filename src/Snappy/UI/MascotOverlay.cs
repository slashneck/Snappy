using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.UI;

/// <summary>
/// A small Snappy that pops up in the corner of the screen you're looking at when you clip, also over games, with her
/// speech bubble, and hops off the edge of the screen when she's done. Click-through, never steals focus, and excluded from screen capture so it never shows up in your
/// clips. Her animation frames are pre-rendered from the same SVG as the app's mascot; the springs and the typing are
/// the same as in the app.
/// </summary>
internal sealed class MascotOverlay : Form
{
    private enum Phase { Hidden, Saving, Result, Leaving }

    private readonly Dictionary<string, (Bitmap Sheet, AppAssets.StripInfo Info)> _strips = new();
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 15 };
    private readonly Stopwatch _clock = Stopwatch.StartNew();

    private Phase _phase = Phase.Hidden;
    private string _strip = "clip";
    private long _stripStart, _shownAt, _textAt, _resultAt, _leaveAt;
    private string _title = "", _sub = "";
    private bool _error;
    private Rectangle _screen;

    /// <summary>Snappy's animations are off in the settings: she shows up and leaves without bouncing.</summary>
    public bool Still { get; set; }

    /// <summary>The rare golden Snappy (one clip in five hundred): gold all over, with a few twinkles around her.</summary>
    public bool Shiny { get; set; }

    private const int HoldResultMs = 1900, TypeMsPerChar = 24;

    public MascotOverlay()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        foreach (var (name, info) in AppAssets.OverlayStrips())
            if (name != "faces") _strips[name] = (AppAssets.LoadBitmap($"overlay-{name}.png"), info);
        _timer.Tick += (_, _) => Tick();
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
        // WDA_EXCLUDEFROMCAPTURE: invisible to screen capture, so it never lands in a clip.
        if (!SetWindowDisplayAffinity(Handle, 0x11)) Log.Warn("Overlay could not be excluded from capture");
    }

    public void ShowSaving(string app)
    {
        _error = false;
        SetText(OverlayOutfit.Style?.Saving ?? "Saving your clip...", app);
        StartStrip("clip");
        long now = _clock.ElapsedMilliseconds;
        if (_phase is Phase.Hidden or Phase.Leaving) Appear(now);
        _phase = Phase.Saving;
        _timer.Start();
        Tick();
    }

    public void ShowResult(bool success, string title, string sub)
    {
        _error = !success;
        SetText(title, sub);
        StartStrip(success ? "happy" : "error");
        long now = _clock.ElapsedMilliseconds;
        if (_phase is Phase.Hidden or Phase.Leaving) Appear(now);
        _resultAt = now;
        _phase = Phase.Result;
        _timer.Start();
        Tick();
    }

    private void Appear(long now)
    {
        _shownAt = now;
        _screen = Screen.FromHandle(GetForegroundWindow()).Bounds;
        if (!IsHandleCreated) CreateHandle();
        ShowWindow(Handle, 4 /* SW_SHOWNOACTIVATE */);
        SetWindowPos(Handle, new IntPtr(-1) /* HWND_TOPMOST */, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 /* NOSIZE|NOMOVE|NOACTIVATE */);
    }

    private void SetText(string title, string sub)
    {
        _title = title;
        _sub = sub;
        _textAt = _clock.ElapsedMilliseconds;
    }

    private void StartStrip(string name)
    {
        _strip = name;
        _stripStart = _clock.ElapsedMilliseconds;
    }

    /// <summary>A damped spring from 0 to 1, the same curve the app's animations use. Overshoots, then settles.</summary>
    private static double Spring(double t, double damping)
    {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        double w0 = 6.9 / damping, wd = w0 * Math.Sqrt(1 - damping * damping);
        return 1 - Math.Exp(-damping * w0 * t) * (Math.Cos(wd * t) + damping * w0 / wd * Math.Sin(wd * t));
    }

    private static double Clamp01(double v) => Math.Clamp(v, 0, 1);
    private static double EaseIn(double t) => t * t * t;

    private void Tick()
    {
        long now = _clock.ElapsedMilliseconds;
        var (builtIn, info) = _strips[_strip];
        // (in whatever outfit she's wearing in the app)
        var sheet = OverlayOutfit.Sheet(_strip) ?? builtIn;
        int frameMs = 1000 / info.Fps;
        int frame = (int)((now - _stripStart) / frameMs);
        if (_strip == "clip" && frame >= info.Frames) { StartStrip("working"); Tick(); return; }
        if (_strip == "working") frame %= info.Frames;
        else frame = Math.Min(frame, info.Frames - 1);

        // Once the result is typed out and has been read, she leaves.
        if (_phase == Phase.Result)
        {
            long typed = (_title.Length + _sub.Length) * TypeMsPerChar;
            long resultAnimMs = info.Frames * frameMs;
            if (now - _resultAt > Math.Max(typed, resultAnimMs) + HoldResultMs)
            {
                _phase = Phase.Leaving;
                _leaveAt = now;
            }
        }
        if (_phase == Phase.Leaving && now - _leaveAt > (Still ? 520 : 1000))
        {
            _timer.Stop();
            _phase = Phase.Hidden;
            ShowWindow(Handle, 0 /* SW_HIDE */);
            return;
        }

        Render(sheet, info, frame, now);
    }

    private void Render(Bitmap sheet, AppAssets.StripInfo info, int frame, long now)
    {
        float s = DpiFor(_screen) / 96f;
        int mascot = (int)(92 * s), margin = (int)(18 * s), room = (int)(16 * s);

        // ----- how far along each piece of the animation is -----
        double since = now - _shownAt;
        double pop = Still ? 1 : Spring(since / 520.0, 0.42);              // she springs up out of nothing
        double fade = Clamp01(since / 110.0);
        double bubbleIn = Still ? 1 : Spring((since - 140) / 560.0, 0.5);  // then the bubble grows out of her
        double bubbleFade = Clamp01((since - 140) / 110.0);
        double bump = 1;                                                   // a little squash when the result arrives
        if (_phase is Phase.Result or Phase.Leaving && !Still) bump = 0.9 + 0.1 * Spring((now - _resultAt) / 420.0, 0.4);
        double bubbleOut = 0, herOut = 0, run = 0;
        if (_phase == Phase.Leaving)
        {
            bubbleOut = EaseIn(Clamp01((now - _leaveAt) / 170.0));
            if (Still) herOut = Clamp01((now - _leaveAt - 110) / 380.0);   // no hopping: she just fades
            else run = Clamp01((now - _leaveAt - 150) / 820.0);            // she hops off the edge of the screen
        }

        // ----- the words, typed out -----
        int chars = (int)Math.Max(0, (now - _textAt - (_phase == Phase.Saving ? 260 : 90)) / TypeMsPerChar);
        string title = _title[..Math.Min(_title.Length, chars)];
        string sub = _sub[..Math.Min(_sub.Length, Math.Max(0, chars - _title.Length))];

        // in a skin, the bubble is the skin's: its colours and its lettering
        var style = OverlayOutfit.Style;
        Color Hex(string? hex, Color fallback, int alpha)
        {
            try { return Color.FromArgb(alpha, string.IsNullOrEmpty(hex) ? fallback : ColorTranslator.FromHtml(hex)); }
            catch { return Color.FromArgb(alpha, fallback); }
        }
        using var titleFont = style != null ? new Font(style.Font, 14f * s, style.Bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel) : new Font("Segoe UI Semibold", 14.5f * s, GraphicsUnit.Pixel);
        using var subFont = style != null ? new Font(style.Font, 12f * s, GraphicsUnit.Pixel) : new Font("Segoe UI", 12.5f * s, GraphicsUnit.Pixel);
        int pad = (int)(15 * s), maxText = (int)(250 * s), lineGap = (int)(2 * s);
        int textW;
        using (var probe = Graphics.FromHwnd(IntPtr.Zero))
        {
            // measured on the full text, so the bubble keeps its size while the words type in
            textW = (int)Math.Ceiling(Math.Max(probe.MeasureString(_title, titleFont).Width, probe.MeasureString(_sub, subFont).Width));
        }
        textW = Math.Clamp(textW, (int)(90 * s), maxText);
        int bubbleW = textW + pad * 2;
        int bubbleH = titleFont.Height + (string.IsNullOrEmpty(_sub) ? 0 : subFont.Height + lineGap) + (int)(18 * s);
        int tail = (int)(9 * s);

        // The window's right edge sits exactly on the screen's edge, so she can run out of it without ever showing up on
        // a monitor next to this one.
        int width = room + bubbleW + tail + (int)(6 * s) + mascot + margin;
        int height = mascot + room * 2;
        using var bmp = new Bitmap(width, height, PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);

            var her = new RectangleF(width - margin - mascot, room, mascot, mascot);
            float eyes = her.Y + mascot * 0.5f;

            // ----- the bubble, growing out of the tail that points at her -----
            float bubbleScale = (float)((0.35 + 0.65 * bubbleIn) * (1 - 0.35 * bubbleOut));
            int bubbleAlpha = (int)(255 * bubbleFade * (1 - bubbleOut));
            if (bubbleAlpha > 0 && bubbleScale > 0.05f)
            {
                var box = new RectangleF(her.X - (int)(6 * s) - tail - bubbleW, eyes - bubbleH / 2f, bubbleW, bubbleH);
                var tip = new PointF(box.Right + tail, eyes);
                var state = g.Save();
                g.TranslateTransform(tip.X, tip.Y);
                g.ScaleTransform(bubbleScale, (float)(bubbleScale * bump));
                g.TranslateTransform(-tip.X, -tip.Y);

                // a soft shadow under it
                for (int i = 3; i >= 1; i--)
                {
                    using var shadowPath = RoundedRect(new RectangleF(box.X - i, box.Y + 2 * s + i, box.Width + i * 2, box.Height + i), 16 * s + i);
                    using var shade = new SolidBrush(Color.FromArgb(bubbleAlpha * 22 / 255, 0, 0, 0));
                    g.FillPath(shade, shadowPath);
                }
                using (var path = RoundedRect(box, Math.Max(1, (float)(style?.Radius ?? 16)) * s))
                using (var fill = new SolidBrush(Hex(style?.Bg, Color.FromArgb(244, 244, 244), bubbleAlpha)))
                {
                    g.FillPath(fill, path);
                    g.FillPolygon(fill, new[] { new PointF(box.Right - 2, eyes - tail), tip, new PointF(box.Right - 2, eyes + tail) });
                    if (!string.IsNullOrEmpty(style?.Edge))
                    {
                        using var edge = new Pen(Hex(style.Edge, Color.White, bubbleAlpha * 110 / 255), 1.4f * s);
                        g.DrawPath(edge, path);
                    }
                    if (Shiny)
                    {
                        using var gold = new Pen(Color.FromArgb(bubbleAlpha, 232, 178, 40), 2.2f * s);
                        g.DrawPath(gold, path);
                    }
                }

                var format = new StringFormat(StringFormatFlags.NoWrap) { Trimming = StringTrimming.EllipsisCharacter };
                float textY = box.Y + (int)(9 * s);
                var inkColor = _error ? Hex(style?.Error, Color.FromArgb(214, 50, 43), bubbleAlpha) : Hex(style?.Ink, Color.FromArgb(10, 10, 10), bubbleAlpha);
                if (!string.IsNullOrEmpty(style?.Depth))
                {
                    // lettering with depth: the same words a pixel at a time down and to the right, in the depth colour
                    using var side = new SolidBrush(Hex(style.Depth, Color.Gray, bubbleAlpha));
                    for (int d = 3; d >= 1; d--)
                        g.DrawString(title, titleFont, side, new RectangleF(box.X + pad + d * s * 0.8f, textY + d * s * 0.8f, textW + 2, titleFont.Height + 2), format);
                }
                using (var ink = new SolidBrush(inkColor))
                    g.DrawString(title, titleFont, ink, new RectangleF(box.X + pad, textY, textW + 2, titleFont.Height + 2), format);
                using (var grey = new SolidBrush(Hex(style?.Sub, Color.FromArgb(92, 92, 92), bubbleAlpha)))
                    g.DrawString(sub, subFont, grey, new RectangleF(box.X + pad, textY + titleFont.Height + lineGap, textW + 2, subFont.Height + 2), format);
                g.Restore(state);
            }

            // ----- Snappy: springs up from her feet, and on the way out crouches, then hops off to the right -----
            float herScale = (float)(pop * (1 - 0.6 * herOut));
            int herAlpha = (int)(255 * fade * (1 - herOut));
            float runX = 0, lift = 0, squashX = 1, squashY = 1;
            if (run > 0)
            {
                // a little crouch first, then three hops that speed up as she goes
                const double crouch = 0.14;
                if (run < crouch)
                {
                    double c = Math.Sin(run / crouch * Math.PI);
                    squashX = (float)(1 + 0.1 * c);
                    squashY = (float)(1 - 0.12 * c);
                }
                else
                {
                    double r = (run - crouch) / (1 - crouch);
                    runX = (float)(Math.Pow(r, 1.5) * (margin + mascot + 10 * s));
                    double hop = Math.Abs(Math.Sin(r * Math.PI * 3));
                    lift = (float)(-hop * 12 * s);
                    squashX = (float)(0.95 + 0.07 * (1 - hop));
                    squashY = (float)(1.06 - 0.1 * (1 - hop));
                }
            }
            if (herAlpha > 0 && herScale > 0.05f)
            {
                var feet = new PointF(her.X + her.Width / 2, her.Bottom);
                var state = g.Save();
                g.TranslateTransform(feet.X + runX, feet.Y + lift);
                g.ScaleTransform(herScale * squashX, herScale * squashY);
                g.TranslateTransform(-feet.X, -feet.Y);
                int col = frame % info.Cols, row = frame / info.Cols;
                using var attrs = new ImageAttributes();
                // shiny: white turns to gold, black stays black
                attrs.SetColorMatrix(Shiny
                    ? new ColorMatrix(new[]
                    {
                        new[] { 1f, 0, 0, 0, 0 }, new[] { 0, 0.8f, 0, 0, 0 }, new[] { 0, 0, 0.28f, 0, 0 },
                        new[] { 0, 0, 0, herAlpha / 255f, 0 }, new[] { 0, 0, 0, 0, 1f },
                    })
                    : new ColorMatrix { Matrix33 = herAlpha / 255f });
                g.DrawImage(sheet, Rectangle.Round(her), col * info.Size, row * info.Size, info.Size, info.Size, GraphicsUnit.Pixel, attrs);
                g.Restore(state);
                if (Shiny) Twinkles(g, her, runX, lift, herAlpha * herScale, now, s);
            }
        }

        int x = _screen.Right - width;
        int y = _screen.Top + margin - room;
        PushLayered(bmp, x, y);

#if DEBUG
        if (Environment.GetEnvironmentVariable("SNAPPY_OVERLAY_DUMP") is { Length: > 0 } dumpDir && (now / 15) % 6 == 0)
        {
            Directory.CreateDirectory(dumpDir);
            bmp.Save(Path.Combine(dumpDir, $"{now:D6}-{_phase}.png"), ImageFormat.Png);
        }
#endif
    }

    /// <summary>Four-pointed stars around a shiny Snappy, each growing and shrinking on its own beat.</summary>
    private static void Twinkles(Graphics g, RectangleF her, float dx, float dy, float alpha, long now, float s)
    {
        var spots = new[] { (0.06f, 0.12f, 1f), (0.94f, 0.2f, 0.75f), (0.86f, 0.9f, 0.6f), (0.1f, 0.78f, 0.55f) };
        for (int i = 0; i < spots.Length; i++)
        {
            var (fx, fy, size) = spots[i];
            double beat = 0.5 + 0.5 * Math.Sin(now / 210.0 + i * 1.9);
            float r = (float)(size * 9 * s * (0.35 + 0.65 * beat));
            float cx = her.X + her.Width * fx + dx, cy = her.Y + her.Height * fy + dy, w = r * 0.28f;
            var star = new[]
            {
                new PointF(cx, cy - r), new PointF(cx + w, cy - w), new PointF(cx + r, cy), new PointF(cx + w, cy + w),
                new PointF(cx, cy + r), new PointF(cx - w, cy + w), new PointF(cx - r, cy), new PointF(cx - w, cy - w),
            };
            using var fill = new SolidBrush(Color.FromArgb((int)Math.Clamp(alpha * (0.45 + 0.55 * beat), 0, 255), 255, 236, 150));
            g.FillPolygon(fill, star);
        }
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

    private static uint DpiFor(Rectangle screen)
    {
        IntPtr monitor = MonitorFromPoint(new POINT { x = screen.X + screen.Width / 2, y = screen.Y + screen.Height / 2 }, 2);
        return GetDpiForMonitor(monitor, 0, out uint dpiX, out _) == 0 ? dpiX : 96;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _timer.Dispose();
            foreach (var (sheet, _) in _strips.Values) sheet.Dispose();
        }
        base.Dispose(disposing);
    }

    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] private struct SIZE { public int cx, cy; }
    [StructLayout(LayoutKind.Sequential, Pack = 1)] private struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }

    [DllImport("user32.dll")] private static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst, ref SIZE psize, IntPtr hdcSrc, ref POINT pprSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);
    [DllImport("user32.dll")] private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
    [DllImport("shcore.dll")] private static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint dpiX, out uint dpiY);
    [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    [DllImport("gdi32.dll")] private static extern bool DeleteDC(IntPtr hdc);
    [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr hdc, IntPtr obj);
    [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr obj);
}
