using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.UI;

/// <summary>
/// The Program, out on the desktop while Snappy is loose: its eye at the top of the screen, a countdown next to it, and
/// what it says typed out underneath, the same as in the app. Click-through, never takes focus, never in a clip.
/// </summary>
internal sealed class DesktopProgram : Form
{
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 15 };
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private Rectangle _area;
    private string _text = "", _clockText = "";
    private bool _alert;
    private long _shownAt, _textAt, _leaveAt = -1;

    public DesktopProgram(Rectangle area)
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
        if (!SetWindowDisplayAffinity(Handle, 0x11)) Log.Warn("Desktop Program could not be excluded from capture");
    }

    private float Dpi => DeviceDpi / 96f;

    /// <summary>The middle of its eye on the screen, where its tractor beam comes from.</summary>
    public PointF Eye => new(_area.X + _area.Width / 2f - 70 * Dpi, _area.Y + 14 * Dpi + 27 * Dpi);

    public void Appear()
    {
        _shownAt = _clock.ElapsedMilliseconds;
        _leaveAt = -1;
        if (!IsHandleCreated) CreateHandle();
        ShowWindow(Handle, 4 /* SW_SHOWNOACTIVATE */);
        SetWindowPos(Handle, new IntPtr(-1) /* HWND_TOPMOST */, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
        _timer.Start();
    }

    public void Say(string text, bool alert)
    {
        _text = text ?? "";
        _alert = alert;
        _textAt = _clock.ElapsedMilliseconds;
    }

    public void Countdown(string text) => _clockText = text ?? "";

    public void Vanish() => _leaveAt = _clock.ElapsedMilliseconds;

    private void Render()
    {
        long now = _clock.ElapsedMilliseconds;
        if (_leaveAt >= 0 && now - _leaveAt > 350)
        {
            _timer.Stop();
            ShowWindow(Handle, 0 /* SW_HIDE */);
            return;
        }
        float s = Dpi;
        double since = now - _shownAt;
        double pop = 1 - Math.Exp(-7 * Math.Clamp(since / 650, 0, 1)) * Math.Cos(10 * Math.Clamp(since / 650, 0, 1));
        float fade = _leaveAt >= 0 ? 1 - (float)Math.Clamp((now - _leaveAt) / 350.0, 0, 1) : (float)Math.Clamp(since / 200, 0, 1);
        int width = (int)(640 * s), height = (int)(200 * s);
        using var bmp = new Bitmap(width, height, PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.Clear(Color.Transparent);
            Color tone = _alert ? Color.FromArgb(255, 170, 80) : Color.FromArgb(140, 220, 255);

            // the pill with its eye
            using var name = new Font("Consolas", 11 * s, FontStyle.Bold, GraphicsUnit.Pixel);
            using var clockFont = new Font("Consolas", 11 * s, FontStyle.Bold, GraphicsUnit.Pixel);
            float clockW = _clockText.Length > 0 ? g.MeasureString(_clockText, clockFont).Width + 22 * s : 0;
            float pillW = 150 * s + clockW, pillH = 54 * s;
            var pill = new RectangleF(width / 2f - pillW / 2, 14 * s, pillW, pillH);
            var state = g.Save();
            g.TranslateTransform(width / 2f, pill.Y);
            g.ScaleTransform((float)pop, (float)(0.7 + 0.3 * pop));
            g.TranslateTransform(-width / 2f, -pill.Y);
            using (var path = Rounded(pill, pillH / 2))
            using (var back = new LinearGradientBrush(pill, Color.FromArgb((int)(247 * fade), 13, 20, 26), Color.FromArgb((int)(247 * fade), 6, 9, 12), 90f))
            using (var edge = new Pen(Color.FromArgb((int)(90 * fade), tone), 1.4f * s))
            {
                g.FillPath(back, path);
                g.DrawPath(edge, path);
            }
            var eye = new PointF(pill.X + 7 * s + 20 * s, pill.Y + pillH / 2);
            using (var socket = new SolidBrush(Color.FromArgb((int)(255 * fade), 18, 34, 43))) g.FillEllipse(socket, eye.X - 20 * s, eye.Y - 20 * s, 40 * s, 40 * s);
            float glow = (float)(1 + 0.08 * Math.Sin(now / 500.0));
            using (var halo = new GraphicsPath())
            {
                halo.AddEllipse(eye.X - 16 * s * glow, eye.Y - 16 * s * glow, 32 * s * glow, 32 * s * glow);
                using var light = new PathGradientBrush(halo) { CenterColor = Color.FromArgb((int)(255 * fade), 255, 255, 255), SurroundColors = new[] { Color.FromArgb(0, tone) } };
                g.FillPath(light, halo);
            }
            using (var label = new SolidBrush(Color.FromArgb((int)(170 * fade), tone)))
                g.DrawString("P R O G R A M", name, label, eye.X + 30 * s, eye.Y - name.Height / 2f);
            if (clockW > 0)
            {
                var chip = new RectangleF(pill.Right - clockW - 6 * s, pill.Y + 13 * s, clockW - 4 * s, pillH - 26 * s);
                using var chipPath = Rounded(chip, chip.Height / 2);
                using var chipBack = new SolidBrush(Color.FromArgb((int)(40 * fade), 255, 154, 64));
                using var chipText = new SolidBrush(Color.FromArgb((int)(255 * fade), 255, 179, 107));
                g.FillPath(chipBack, chipPath);
                g.DrawString(_clockText, clockFont, chipText, chip.X + 9 * s, chip.Y + chip.Height / 2 - clockFont.Height / 2f);
            }
            g.Restore(state);

            // what it says, typed out evenly under its eye
            if (_text.Length > 0)
            {
                using var font = new Font("Consolas", 16 * s, FontStyle.Bold, GraphicsUnit.Pixel);
                int chars = (int)Math.Max(0, (now - _textAt) / 31);
                string typed = _text[..Math.Min(_text.Length, chars)];
                var box = new RectangleF(20 * s, pill.Bottom + 14 * s, width - 40 * s, height - pill.Bottom - 16 * s);
                var format = new StringFormat { Alignment = StringAlignment.Center };
                // the full text is measured first so the lines never jump while it types
                var full = g.MeasureString(_text, font, (int)box.Width, format);
                using var shadow = new SolidBrush(Color.FromArgb((int)(210 * fade), 0, 0, 0));
                using var ink = new SolidBrush(Color.FromArgb((int)(255 * fade), _alert ? Color.FromArgb(255, 210, 160) : Color.FromArgb(212, 242, 255)));
                var layout = new RectangleF(box.X, box.Y, box.Width, full.Height + 4);
                string shown = PadLike(typed, _text);
                foreach (var (dx, dy) in new[] { (-1.5f, 1.5f), (1.5f, 1.5f), (0f, 2.5f) })
                    g.DrawString(shown, font, shadow, new RectangleF(layout.X + dx * s, layout.Y + dy * s, layout.Width, layout.Height), format);
                g.DrawString(shown, font, ink, layout, format);
            }
        }
        PushLayered(bmp, _area.X + _area.Width / 2 - width / 2, _area.Y);
    }

    // The typed part, then the rest as non-breaking spaces of the same length, so it wraps like the finished line.
    private static string PadLike(string typed, string full)
    {
        var rest = full[typed.Length..].Select(c => c == ' ' || c == '\n' ? c : ' ');
        return typed + string.Concat(rest);
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
        if (disposing) _timer.Dispose();
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
