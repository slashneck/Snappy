using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.UI;

/// <summary>
/// A small Snappy that pops up in the corner of the screen you're looking at when you clip, also over games.
/// Click-through, never steals focus, and excluded from screen capture so it never shows up in your clips.
/// Animation frames are pre-rendered from the same SVG as the app's mascot.
/// </summary>
internal sealed class MascotOverlay : Form
{
    private enum Phase { Hidden, Saving, Result, FadingOut }

    private readonly Dictionary<string, (Bitmap Sheet, AppAssets.StripInfo Info)> _strips = new();
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 16 };
    private readonly Stopwatch _clock = Stopwatch.StartNew();

    private Phase _phase = Phase.Hidden;
    private string _strip = "clip";
    private long _stripStart, _phaseStart;
    private string _title = "", _sub = "";
    private bool _error;
    private Rectangle _screen;

    private const int HoldResultMs = 1700, FadeInMs = 160, FadeOutMs = 260;

    public MascotOverlay()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        foreach (var (name, info) in AppAssets.OverlayStrips())
            _strips[name] = (AppAssets.LoadBitmap($"overlay-{name}.png"), info);
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
        // WDA_EXCLUDEFROMCAPTURE: invisible to Desktop Duplication, so it never lands in a clip.
        if (!SetWindowDisplayAffinity(Handle, 0x11)) Log.Warn("Overlay could not be excluded from capture");
    }

    public void ShowSaving(string app)
    {
        _title = "Saving clip…";
        _sub = app;
        _error = false;
        StartStrip("clip");
        BeginPhase(Phase.Saving);
    }

    public void ShowResult(bool success, string title, string sub)
    {
        _title = title;
        _sub = sub;
        _error = !success;
        StartStrip(success ? "happy" : "error");
        BeginPhase(Phase.Result);
    }

    private void BeginPhase(Phase phase)
    {
        bool wasHidden = _phase is Phase.Hidden;
        _phase = phase;
        _phaseStart = _clock.ElapsedMilliseconds;
        if (wasHidden || !Visible)
        {
            _screen = Screen.FromHandle(GetForegroundWindow()).Bounds;
            _fadeStart = _clock.ElapsedMilliseconds;
            if (!IsHandleCreated) CreateHandle();
            ShowWindow(Handle, 4 /* SW_SHOWNOACTIVATE */);
            SetWindowPos(Handle, new IntPtr(-1) /* HWND_TOPMOST */, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 /* NOSIZE|NOMOVE|NOACTIVATE */);
        }
        _timer.Start();
        Tick();
    }

    private long _fadeStart;

    private void StartStrip(string name)
    {
        _strip = name;
        _stripStart = _clock.ElapsedMilliseconds;
    }

    private void Tick()
    {
        long now = _clock.ElapsedMilliseconds;
        var (sheet, info) = _strips[_strip];
        int frameMs = 1000 / info.Fps;
        int frame = (int)((now - _stripStart) / frameMs);

        if (_strip == "clip" && frame >= info.Frames) { StartStrip("working"); Tick(); return; }
        if (_strip == "working") frame %= info.Frames;
        else frame = Math.Min(frame, info.Frames - 1);

        double alpha = Math.Min(1, (now - _fadeStart) / (double)FadeInMs);
        if (_phase == Phase.Result && now - _phaseStart > info.Frames * frameMs + HoldResultMs)
        {
            _phase = Phase.FadingOut;
            _phaseStart = now;
        }
        if (_phase == Phase.FadingOut)
        {
            alpha = 1 - (now - _phaseStart) / (double)FadeOutMs;
            if (alpha <= 0)
            {
                _timer.Stop();
                _phase = Phase.Hidden;
                ShowWindow(Handle, 0 /* SW_HIDE */);
                return;
            }
        }

        Render(sheet, info, frame, Math.Clamp(alpha, 0, 1));
    }

    private void Render(Bitmap sheet, AppAssets.StripInfo info, int frame, double alpha)
    {
        float scale = DpiFor(_screen) / 96f;
        int mascot = (int)(92 * scale);
        int pad = (int)(14 * scale), gap = (int)(4 * scale), pillH = (int)(58 * scale), margin = (int)(22 * scale);

        using var titleFont = new Font("Segoe UI Semibold", 14.5f * scale, GraphicsUnit.Pixel);
        using var subFont = new Font("Segoe UI", 12.5f * scale, GraphicsUnit.Pixel);
        int maxText = (int)(260 * scale);
        int textW;
        using (var probe = Graphics.FromHwnd(IntPtr.Zero))
        {
            textW = (int)Math.Ceiling(Math.Max(probe.MeasureString(_title, titleFont).Width, probe.MeasureString(_sub, subFont).Width));
        }
        textW = Math.Min(maxText, Math.Max((int)(96 * scale), textW));
        int pillW = textW + pad * 2;
        int width = mascot + gap + pillW;
        int height = mascot;

        using var bmp = new Bitmap(width, height, PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);

            // Pill
            var pill = new RectangleF(mascot + gap, (height - pillH) / 2f + 4 * scale, pillW, pillH);
            using (var path = RoundedRect(pill, pillH / 2.6f))
            using (var fill = new SolidBrush(Color.FromArgb(238, 12, 12, 12)))
            using (var border = new Pen(Color.FromArgb(38, 255, 255, 255), Math.Max(1, scale)))
            {
                g.FillPath(fill, path);
                g.DrawPath(border, path);
            }
            var format = new StringFormat(StringFormatFlags.NoWrap) { Trimming = StringTrimming.EllipsisCharacter };
            float textX = pill.X + pad;
            float titleY = pill.Y + pillH / 2f - titleFont.Height + 2 * scale;
            using (var white = new SolidBrush(_error ? Color.FromArgb(255, 255, 110, 100) : Color.FromArgb(255, 244, 244, 244)))
                g.DrawString(_title, titleFont, white, new RectangleF(textX, titleY, textW + 2, titleFont.Height + 2), format);
            using (var grey = new SolidBrush(Color.FromArgb(255, 163, 163, 163)))
                g.DrawString(_sub, subFont, grey, new RectangleF(textX, pill.Y + pillH / 2f + 1 * scale, textW + 2, subFont.Height + 2), format);

            // Mascot frame
            int col = frame % info.Cols, row = frame / info.Cols;
            g.DrawImage(sheet, new Rectangle(0, 0, mascot, mascot),
                new Rectangle(col * info.Size, row * info.Size, info.Size, info.Size), GraphicsUnit.Pixel);
        }

        int x = _screen.Right - width - margin;
        int y = _screen.Top + margin - (int)((1 - alpha) * 10 * scale);
        PushLayered(bmp, x, y, (byte)(alpha * 255));

#if DEBUG
        if (Environment.GetEnvironmentVariable("SNAPPY_OVERLAY_DUMP") is { Length: > 0 } dumpDir && frame % 8 == 0)
        {
            Directory.CreateDirectory(dumpDir);
            bmp.Save(Path.Combine(dumpDir, $"{_strip}-{frame:D2}.png"), ImageFormat.Png);
        }
#endif
    }

    private void PushLayered(Bitmap bmp, int x, int y, byte alpha)
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
            var blend = new BLENDFUNCTION { BlendOp = 0, BlendFlags = 0, SourceConstantAlpha = alpha, AlphaFormat = 1 };
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
        float d = radius * 2;
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
