using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using Snappy.Input;

namespace Snappy.Studio;

/// <summary>
/// Draws the keycap and cat overlays into BGRA frames for the recording. Mirrors wwwroot/overlay.js, which draws the
/// same thing for the Studio preview; keep the two in sync when changing the look.
/// </summary>
public sealed class InputOverlayRenderer : IDisposable
{
    private record struct Key(int Code, float X, float Y, float W, string Label);

    private static readonly Color Ink = Color.FromArgb(10, 10, 10);
    private static readonly Color Paper = Color.FromArgb(244, 244, 244);
    private static readonly Color CapFill = Color.FromArgb(158, 10, 10, 10);
    private static readonly Color CapLine = Color.FromArgb(140, 244, 244, 244);
    private static readonly Color Dim = Color.FromArgb(90, 244, 244, 244);
    private static readonly Dictionary<int, (float X, float Y, float W, string Label)> Positions = BuildPositions();

    private readonly Bitmap _bitmap;
    private readonly Graphics _g;
    private readonly StudioLayer _layer;
    private readonly List<Key> _keys = new();
    private readonly RectangleF? _mouse;
    private readonly float _layoutW, _layoutH;

    public int Width { get; }
    public int Height { get; }

    public InputOverlayRenderer(StudioLayer layer, int width, int height)
    {
        _layer = layer;
        Width = Math.Max(2, width);
        Height = Math.Max(2, height);
        _bitmap = new Bitmap(Width, Height, PixelFormat.Format32bppArgb);
        _g = Graphics.FromImage(_bitmap);
        _g.SmoothingMode = SmoothingMode.AntiAlias;
        _g.TextRenderingHint = TextRenderingHint.AntiAlias;
        _g.PixelOffsetMode = PixelOffsetMode.HighQuality;

        if (layer.ShowKeys)
        {
            float extraX = 0;
            foreach (int code in KeysFor(layer).Order())
            {
                if (Positions.TryGetValue(code, out var p)) _keys.Add(new Key(code, p.X, p.Y, p.W, p.Label));
                else _keys.Add(new Key(code, extraX++, 5.2f, 1, ((Keys)code).ToString()));
            }
        }
        float minX = _keys.Count > 0 ? _keys.Min(k => k.X) : 0, minY = _keys.Count > 0 ? _keys.Min(k => k.Y) : 0;
        for (int i = 0; i < _keys.Count; i++) _keys[i] = _keys[i] with { X = _keys[i].X - minX, Y = _keys[i].Y - minY };
        _layoutW = _keys.Count > 0 ? _keys.Max(k => k.X + k.W) : 0;
        _layoutH = _keys.Count > 0 ? _keys.Max(k => k.Y + 1) : 0;
        if (layer.ShowMouse)
        {
            float mx = _keys.Count > 0 ? _layoutW + 0.45f : 0;
            _layoutW = mx + 1.9f;
            float my = _keys.Count > 0 ? Math.Max(0, (Math.Max(_layoutH, 2.9f) - 2.9f) / 2) : 0;
            _layoutH = Math.Max(_layoutH, 2.9f);
            _mouse = new RectangleF(mx, my, 1.9f, 2.9f);
        }
        _layoutW = Math.Max(_layoutW, 0.01f);
        _layoutH = Math.Max(_layoutH, 0.01f);
    }

    public static HashSet<int> KeysFor(StudioLayer layer)
    {
        return InputPresets.KeysFor(layer.Presets, layer.ExtraKeys);
    }

    /// <summary>Width / height of the content, so the Studio can keep the layer's proportions.</summary>
    public static double AspectFor(StudioLayer layer)
    {
        if (layer.Style == "cat") return 5.6 / 3.7;
        using var r = new InputOverlayRenderer(layer, 16, 16);
        return r._layoutW / r._layoutH;
    }

    /// <summary>Renders one frame and copies it (BGRA, top-down) into <paramref name="destination"/>.</summary>
    public void Render(InputState state, byte[] destination)
    {
        _g.Clear(Color.Transparent);
        if (_layer.Style == "cat")
        {
            float u = Math.Min((Width - 4) / 5.6f, (Height - 4) / 3.7f);
            var saved = _g.Save();
            _g.TranslateTransform(2, 2);
            _g.ScaleTransform(u * 5.6f / 200, u * 5.6f / 200);
            DrawCat(state);
            _g.Restore(saved);
        }
        else
        {
            float u = Math.Min((Width - 4) / _layoutW, (Height - 4) / _layoutH);
            var saved = _g.Save();
            _g.TranslateTransform(2, 2);
            DrawKeys(state, u);
            _g.Restore(saved);
        }

        if (_layer.Opacity < 0.999) ApplyOpacity();
        var data = _bitmap.LockBits(new Rectangle(0, 0, Width, Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try { Marshal.Copy(data.Scan0, destination, 0, Width * Height * 4); }
        finally { _bitmap.UnlockBits(data); }
    }

    private void ApplyOpacity()
    {
        var data = _bitmap.LockBits(new Rectangle(0, 0, Width, Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        try
        {
            unsafe
            {
                byte* p = (byte*)data.Scan0;
                int factor = (int)(_layer.Opacity * 256);
                for (int i = 3; i < Width * Height * 4; i += 4) p[i] = (byte)(p[i] * factor >> 8);
            }
        }
        finally { _bitmap.UnlockBits(data); }
    }

    private static GraphicsPath Rounded(RectangleF r, float radius)
    {
        radius = Math.Min(radius, Math.Min(r.Width, r.Height) / 2);
        float d = radius * 2;
        var p = new GraphicsPath();
        if (d <= 0) { p.AddRectangle(r); return p; }
        p.AddArc(r.X, r.Y, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    private void DrawKeys(InputState st, float u)
    {
        using var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        foreach (var k in _keys)
        {
            bool on = st.Keys.Contains(k.Code);
            float pad = u * 0.07f;
            var rect = new RectangleF(k.X * u + pad, k.Y * u + pad + (on ? u * 0.03f : 0), k.W * u - pad * 2, u - pad * 2);
            using var path = Rounded(rect, u * 0.18f);
            using (var fill = new SolidBrush(on ? Paper : CapFill)) _g.FillPath(fill, path);
            using (var pen = new Pen(on ? Paper : CapLine, Math.Max(1, u * 0.045f))) _g.DrawPath(pen, path);
            using var font = new Font("Segoe UI Semibold", Math.Max(1, u * (k.Label.Length > 2 ? 0.27f : 0.38f)), GraphicsUnit.Pixel);
            using var text = new SolidBrush(on ? Ink : Paper);
            _g.DrawString(k.Label, font, text, new RectangleF(rect.X, rect.Y + u * 0.01f, rect.Width, rect.Height), format);
        }
        if (_mouse is { } m) DrawMouse(st, new RectangleF(m.X * u, m.Y * u, m.Width * u, m.Height * u), u);
    }

    private void DrawMouse(InputState st, RectangleF r, float u)
    {
        float lw = Math.Max(1, u * 0.045f);
        var body = new RectangleF(r.X + lw, r.Y + lw, r.Width - lw * 2, r.Height - lw * 2);
        using var bodyPath = Rounded(body, r.Width * 0.48f);
        using (var fill = new SolidBrush(CapFill)) _g.FillPath(fill, bodyPath);
        float split = r.Y + r.Height * 0.4f;
        var clip = _g.Clip;
        _g.SetClip(bodyPath);
        using (var paper = new SolidBrush(Paper))
        {
            if (st.Buttons.Contains(1)) _g.FillRectangle(paper, r.X, r.Y, r.Width / 2, split - r.Y);
            if (st.Buttons.Contains(2)) _g.FillRectangle(paper, r.X + r.Width / 2, r.Y, r.Width / 2, split - r.Y);
        }
        _g.Clip = clip;
        using (var pen = new Pen(CapLine, lw))
        {
            _g.DrawPath(pen, bodyPath);
            _g.DrawLine(pen, r.X + lw, split, r.Right - lw, split);
            _g.DrawLine(pen, r.X + r.Width / 2, r.Y + lw, r.X + r.Width / 2, split);
        }
        using (var wheelPath = Rounded(new RectangleF(r.X + r.Width / 2 - u * 0.1f, r.Y + r.Height * 0.14f, u * 0.2f, r.Height * 0.16f), u * 0.1f))
        using (var wheel = new SolidBrush(st.Buttons.Contains(3) || st.Wheel != 0 ? Paper : Dim))
            _g.FillPath(wheel, wheelPath);
        if (st.Wheel != 0)
        {
            float ax = r.X + r.Width / 2, ay = st.Wheel > 0 ? r.Y - u * 0.12f : r.Y + r.Height * 0.36f;
            using var arrow = new SolidBrush(Paper);
            _g.FillPolygon(arrow, new[] { new PointF(ax - u * 0.14f, ay), new PointF(ax + u * 0.14f, ay), new PointF(ax, ay + (st.Wheel > 0 ? -u * 0.16f : u * 0.16f)) });
        }
        double mag = Math.Sqrt(st.Vx * st.Vx + st.Vy * st.Vy);
        double k = mag > 0 ? Math.Min(1, mag / 160) / mag : 0;
        float cx = r.X + r.Width / 2 + (float)(st.Vx * k * r.Width * 0.28), cy = r.Y + r.Height * 0.68f + (float)(st.Vy * k * r.Height * 0.16);
        using var dot = new SolidBrush(mag > 3 ? Paper : Dim);
        _g.FillEllipse(dot, cx - u * 0.11f, cy - u * 0.11f, u * 0.22f, u * 0.22f);
    }

    private void InkThenPaper(GraphicsPath path)
    {
        using (var ink = new Pen(Ink, 9) { LineJoin = LineJoin.Round }) _g.DrawPath(ink, path);
        using var paper = new SolidBrush(Paper);
        _g.FillPath(paper, path);
    }

    private static GraphicsPath Ellipse(float cx, float cy, float rx, float ry, float rotationDeg = 0)
    {
        var p = new GraphicsPath();
        p.AddEllipse(-rx, -ry, rx * 2, ry * 2);
        using var m = new Matrix();
        m.Translate(cx, cy);
        m.Rotate(rotationDeg);
        p.Transform(m);
        return p;
    }

    private void DrawCat(InputState st)
    {
        bool anyKey = _layer.ShowKeys && st.Keys.Count > 0;
        bool click = st.Buttons.Count > 0;
        double mag = Math.Sqrt(st.Vx * st.Vx + st.Vy * st.Vy);
        double mk = mag > 0 ? Math.Min(1, mag / 160) / mag : 0;
        float mx = 152 + (float)(st.Vx * mk * 14), my = 110 + (float)(st.Vy * mk * 4);

        using (var body = new GraphicsPath())
        {
            body.AddArc(40, 66, 120, 76, 180, 180);
            body.CloseFigure();
            body.AddEllipse(66, 24, 68, 68);
            body.AddPolygon(new[] { new PointF(72, 44), new PointF(76, 16), new PointF(96, 30) });
            body.AddPolygon(new[] { new PointF(128, 44), new PointF(124, 16), new PointF(104, 30) });
            InkThenPaper(body);
        }

        using (var ink = new SolidBrush(Ink))
        {
            if (st.TimeMs % 3700 < 120)
            {
                _g.FillRectangle(ink, 84, 57, 9, 3);
                _g.FillRectangle(ink, 107, 57, 9, 3);
            }
            else
            {
                _g.FillEllipse(ink, 84.5f, 54, 8, 8);
                _g.FillEllipse(ink, 107.5f, 54, 8, 8);
            }
        }
        using (var mouth = new GraphicsPath())
        using (var pen = new Pen(Ink, 3) { StartCap = LineCap.Round, EndCap = LineCap.Round })
        {
            mouth.AddBezier(93, 69, 95.3f, 71.7f, 97.7f, 71.7f, 100, 69);
            mouth.AddBezier(100, 69, 102.3f, 71.7f, 104.7f, 71.7f, 107, 69);
            _g.DrawPath(pen, mouth);
        }

        using (var desk = new Pen(Paper, 4.5f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            _g.DrawLine(desk, 4, 118, 196, 118);
        using (var keyboard = Rounded(new RectangleF(18, 106, 78, 14), 4)) InkThenPaper(keyboard);
        using (var ink = new SolidBrush(Ink))
            for (int i = 0; i < 6; i++) _g.FillRectangle(ink, 24 + i * 11.5f, 111, 7, 3);
        using (var mouse = Ellipse(mx, my, 15, 9)) InkThenPaper(mouse);
        if (mag > 25)
        {
            float dir = Math.Sign(st.Vx) == 0 ? 1 : Math.Sign(st.Vx);
            using var lines = new Pen(Paper, 3) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            _g.DrawLine(lines, mx - dir * 24, my - 6, mx - dir * 34, my - 6);
            _g.DrawLine(lines, mx - dir * 24, my + 2, mx - dir * 32, my + 2);
        }

        using (var left = Ellipse(58, anyKey ? 104 : 86, 13, 9, -11.5f)) InkThenPaper(left);
        using (var right = Ellipse(mx - 2, my - (click ? 5 : 10), 13, 9, 11.5f)) InkThenPaper(right);
    }

    private static Dictionary<int, (float, float, float, string)> BuildPositions()
    {
        var map = new Dictionary<int, (float, float, float, string)>();
        void Row(int[] codes, float x0, float y, string labels)
        {
            for (int i = 0; i < codes.Length; i++) map[codes[i]] = (x0 + i, y, 1, labels[i].ToString());
        }
        Row(new[] { 0xC0, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x30 }, 0, 0, "`1234567890");
        Row(new[] { 0x51, 0x57, 0x45, 0x52, 0x54, 0x59, 0x55, 0x49, 0x4F, 0x50 }, 1.5f, 1, "QWERTYUIOP");
        Row(new[] { 0x41, 0x53, 0x44, 0x46, 0x47, 0x48, 0x4A, 0x4B, 0x4C }, 1.75f, 2, "ASDFGHJKL");
        Row(new[] { 0x5A, 0x58, 0x43, 0x56, 0x42, 0x4E, 0x4D }, 2.25f, 3, "ZXCVBNM");
        map[0x09] = (0, 1, 1.5f, "Tab");
        map[0x14] = (0, 2, 1.75f, "Caps");
        map[0x10] = (0, 3, 2.25f, "Shift");
        map[0x11] = (0, 4, 1.5f, "Ctrl");
        map[0x12] = (2.5f, 4, 1.25f, "Alt");
        map[0x20] = (3.75f, 4, 4.5f, "Space");
        for (int i = 1; i <= 12; i++) map[0x6F + i] = (i - 1 + (i > 4 ? 0.5f : 0) + (i > 8 ? 0.5f : 0), -1.2f, 1, $"F{i}");
        return map;
    }

    public void Dispose()
    {
        _g.Dispose();
        _bitmap.Dispose();
    }
}
