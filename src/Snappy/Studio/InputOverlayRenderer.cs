using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.Runtime.InteropServices;
using Snappy.Input;

namespace Snappy.Studio;

/// <summary>
/// Draws the input overlay: chosen keys, a whole keyboard, a mouse, a controller or the cat. Outlines on a see through
/// background, and whatever you press fills in with the layer's accent colour.
/// The recording and the Studio preview both come through here, so what you arrange is what lands in the clip.
/// </summary>
public sealed class InputOverlayRenderer : IDisposable
{
    private readonly record struct Cap(int Code, float X, float Y, float W, string Label);

    private static readonly Color Paper = Color.FromArgb(238, 244, 244, 244);
    private static readonly Color Shade = Color.FromArgb(150, 8, 8, 10);
    private static readonly Color Dim = Color.FromArgb(120, 244, 244, 244);

    private readonly StudioLayer _layer;
    private readonly string _kind;
    private readonly string _design;
    private readonly Color _accent;
    private readonly Color _accentInk;
    private readonly Bitmap _bitmap;
    private readonly Graphics _g;
    private readonly List<Cap> _caps = new();
    private RectangleF _mouse;   // in key units, empty when the mouse isn't part of this overlay
    private RectangleF _capsBox; // where the key caps sit, used by the cat
    private RectangleF _catBox;
    private float _unitsW, _unitsH;

    public int Width { get; }
    public int Height { get; }

    public InputOverlayRenderer(StudioLayer layer, int width, int height)
    {
        _layer = layer;
        _kind = Kind(layer);
        _design = Design(layer);
        _accent = ParseColor(layer.Accent);
        _accentInk = Luminance(_accent) > 0.55 ? Color.FromArgb(10, 10, 12) : Color.FromArgb(244, 244, 244);
        Width = Math.Max(2, width);
        Height = Math.Max(2, height);
        _bitmap = new Bitmap(Width, Height, PixelFormat.Format32bppArgb);
        _g = Graphics.FromImage(_bitmap);
        _g.SmoothingMode = SmoothingMode.AntiAlias;
        _g.TextRenderingHint = TextRenderingHint.AntiAlias;
        _g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        Layout();
    }

    // ---------- what a layer is made of ----------

    public static string Kind(StudioLayer layer)
    {
        string kind = string.IsNullOrWhiteSpace(layer.Input) ? (layer.Style == "cat" ? "cat" : "keys") : layer.Input;
        return kind is "keys" or "keyboard" or "mouse" or "controller" or "cat" ? kind : "keys";
    }

    public static string Design(StudioLayer layer)
    {
        string kind = Kind(layer);
        string design = layer.Design ?? "";
        return kind switch
        {
            "keyboard" => design == "full" ? "full" : "compact",
            "mouse" => design == "simple" ? "simple" : "arrow",
            "controller" => design == "playstation" ? "playstation" : "xbox",
            _ => "outline",
        };
    }

    /// <summary>Keys this layer watches. Everything else you type is never even looked at.</summary>
    public static HashSet<int> KeysFor(StudioLayer layer)
    {
        string kind = Kind(layer);
        if (kind == "mouse" || kind == "controller") return new HashSet<int>();
        if (kind == "keyboard") return Board(Design(layer)).Select(c => c.Code).ToHashSet();
        return InputPresets.KeysFor(layer.Presets, layer.ExtraKeys);
    }

    public static bool NeedsGamepad(StudioLayer layer) => Kind(layer) == "controller";

    /// <summary>Width divided by height of the drawing, so a layer can keep its shape while being resized.</summary>
    public static double AspectFor(StudioLayer layer)
    {
        using var probe = new InputOverlayRenderer(layer, 16, 16);
        return probe._unitsW / probe._unitsH;
    }

    // ---------- layout ----------

    private void Layout()
    {
        switch (_kind)
        {
            case "keyboard":
                _caps.AddRange(Board(_design));
                break;
            case "keys":
                if (_layer.ShowKeys) _caps.AddRange(Chosen(_layer));
                break;
            case "cat":
                if (_layer.ShowKeys) _caps.AddRange(Pack(Chosen(_layer)));
                break;
        }
        var caps = Normalize();

        if (_kind == "controller")
        {
            _unitsW = 6.2f;
            _unitsH = 4.3f;
            return;
        }
        if (_kind == "mouse")
        {
            _unitsW = _design == "simple" ? 2.2f : 2.6f;
            _unitsH = _design == "simple" ? 3.1f : 3.9f;
            return;
        }
        if (_kind == "cat")
        {
            // The cat sits behind the keys you picked, with its paws reaching down onto them.
            const float mouseW = 2f, mouseH = 2.8f;
            float blockW = caps.Width + (_layer.ShowMouse ? mouseW + 0.4f : 0);
            if (blockW < 2.4f) blockW = 2.4f;
            float catW = Math.Clamp(blockW * 0.62f, 2.4f, 4.4f);
            float catH = catW * 0.75f;
            _catBox = new RectangleF((blockW - catW) / 2, 0, catW, catH);
            float top = Math.Max(0.2f, catH - 0.5f);
            _capsBox = new RectangleF(0, top, caps.Width, caps.Height);
            if (_layer.ShowMouse)
                _mouse = new RectangleF(caps.Width + 0.4f, top + Math.Max(0, (caps.Height - mouseH) / 2), mouseW, mouseH);
            _unitsW = blockW;
            _unitsH = Math.Max(_capsBox.Bottom, _layer.ShowMouse ? _mouse.Bottom : top + 1f);
            return;
        }

        _capsBox = caps;
        float width = caps.Width, height = caps.Height;
        if (_layer.ShowMouse)
        {
            float x = _caps.Count > 0 ? width + 0.5f : 0;
            const float mouseHeight = 3.1f;
            _mouse = new RectangleF(x, _caps.Count > 0 ? Math.Max(0, (Math.Max(height, mouseHeight) - mouseHeight) / 2) : 0, 2.2f, mouseHeight);
            width = x + _mouse.Width;
            height = Math.Max(height, mouseHeight);
        }
        _unitsW = Math.Max(width, 0.5f);
        _unitsH = Math.Max(height, 0.5f);
    }

    /// <summary>
    /// Squeezes the picked keys into a tight block, rows centred under each other. A real keyboard layout has big gaps,
    /// which looks lost behind the cat.
    /// </summary>
    private static List<Cap> Pack(List<Cap> caps)
    {
        var packed = new List<Cap>();
        float y = 0, widest = 0;
        foreach (var row in caps.GroupBy(c => c.Y).OrderBy(g => g.Key))
        {
            float x = 0;
            foreach (var cap in row.OrderBy(c => c.X))
            {
                float width = Math.Min(cap.W, 2.6f);
                packed.Add(cap with { X = x, Y = y, W = width });
                x += width;
            }
            widest = Math.Max(widest, x);
            y++;
        }
        for (int i = 0; i < packed.Count; i++)
        {
            float rowWidth = packed.Where(c => Math.Abs(c.Y - packed[i].Y) < 0.01f).Sum(c => c.W);
            packed[i] = packed[i] with { X = packed[i].X + (widest - rowWidth) / 2 };
        }
        return packed;
    }

    /// <summary>Moves the caps to start at zero and reports how much room they need.</summary>
    private RectangleF Normalize()
    {
        if (_caps.Count == 0) return RectangleF.Empty;
        float minX = _caps.Min(c => c.X), minY = _caps.Min(c => c.Y);
        for (int i = 0; i < _caps.Count; i++) _caps[i] = _caps[i] with { X = _caps[i].X - minX, Y = _caps[i].Y - minY };
        return new RectangleF(0, 0, _caps.Max(c => c.X + c.W), _caps.Max(c => c.Y + 1));
    }

    /// <summary>The keys you picked, sitting where they sit on a real keyboard.</summary>
    private static List<Cap> Chosen(StudioLayer layer)
    {
        var caps = new List<Cap>();
        float extraX = 0;
        foreach (int code in InputPresets.KeysFor(layer.Presets, layer.ExtraKeys).Order())
        {
            if (Positions.TryGetValue(code, out var p)) caps.Add(new Cap(code, p.X, p.Y, p.W, p.Label));
            else caps.Add(new Cap(code, extraX++, 5.2f, 1, KeyName(code)));
        }
        return caps;
    }

    /// <summary>A 60 percent board, or the same with a function row and arrow keys.</summary>
    private static List<Cap> Board(string design)
    {
        var caps = new List<Cap>();
        void Row(float y, params (int Code, float W, string Label)[] keys)
        {
            float x = 0;
            foreach (var (code, w, label) in keys)
            {
                caps.Add(new Cap(code, x, y, w, label));
                x += w;
            }
        }

        float top = 0;
        if (design == "full")
        {
            Row(0, (0x1B, 1, "Esc"), (0x70, 1, "F1"), (0x71, 1, "F2"), (0x72, 1, "F3"), (0x73, 1, "F4"), (0x74, 1, "F5"),
                (0x75, 1, "F6"), (0x76, 1, "F7"), (0x77, 1, "F8"), (0x78, 1, "F9"), (0x79, 1, "F10"), (0x7A, 1, "F11"), (0x7B, 1, "F12"));
            top = 1.25f;
        }
        Row(top, (0xC0, 1, "`"), (0x31, 1, "1"), (0x32, 1, "2"), (0x33, 1, "3"), (0x34, 1, "4"), (0x35, 1, "5"), (0x36, 1, "6"),
            (0x37, 1, "7"), (0x38, 1, "8"), (0x39, 1, "9"), (0x30, 1, "0"), (0xBD, 1, "-"), (0xBB, 1, "="), (0x08, 2, "Bksp"));
        Row(top + 1, (0x09, 1.5f, "Tab"), (0x51, 1, "Q"), (0x57, 1, "W"), (0x45, 1, "E"), (0x52, 1, "R"), (0x54, 1, "T"), (0x59, 1, "Y"),
            (0x55, 1, "U"), (0x49, 1, "I"), (0x4F, 1, "O"), (0x50, 1, "P"), (0xDB, 1, "["), (0xDD, 1, "]"), (0xDC, 1.5f, "\\"));
        Row(top + 2, (0x14, 1.75f, "Caps"), (0x41, 1, "A"), (0x53, 1, "S"), (0x44, 1, "D"), (0x46, 1, "F"), (0x47, 1, "G"), (0x48, 1, "H"),
            (0x4A, 1, "J"), (0x4B, 1, "K"), (0x4C, 1, "L"), (0xBA, 1, ";"), (0xDE, 1, "'"), (0x0D, 2.25f, "Enter"));
        Row(top + 3, (0x10, 2.25f, "Shift"), (0x5A, 1, "Z"), (0x58, 1, "X"), (0x43, 1, "C"), (0x56, 1, "V"), (0x42, 1, "B"), (0x4E, 1, "N"),
            (0x4D, 1, "M"), (0xBC, 1, ","), (0xBE, 1, "."), (0xBF, 1, "/"), (0x10, 2.75f, "Shift"));
        Row(top + 4, (0x11, 1.25f, "Ctrl"), (0x5B, 1.25f, "Win"), (0x12, 1.25f, "Alt"), (0x20, 6.25f, ""), (0x12, 1.25f, "Alt"),
            (0x5D, 1.25f, "Menu"), (0x11, 1.25f, "Ctrl"));

        if (design == "full")
        {
            caps.Add(new Cap(0x26, 16.25f, top + 3, 1, "up"));
            caps.Add(new Cap(0x25, 15.25f, top + 4, 1, "left"));
            caps.Add(new Cap(0x28, 16.25f, top + 4, 1, "down"));
            caps.Add(new Cap(0x27, 17.25f, top + 4, 1, "right"));
        }
        return caps;
    }

    // ---------- drawing ----------

    /// <summary>Renders one frame and copies it (BGRA, top down) into <paramref name="destination"/>.</summary>
    public void Render(InputState state, GamepadState? pad, byte[] destination)
    {
        Draw(state, pad);
        if (_layer.Opacity < 0.999) ApplyOpacity();
        var data = _bitmap.LockBits(new Rectangle(0, 0, Width, Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try { Marshal.Copy(data.Scan0, destination, 0, Width * Height * 4); }
        finally { _bitmap.UnlockBits(data); }
    }

    /// <summary>Renders one frame as a PNG, used by the Studio preview.</summary>
    public byte[] RenderPng(InputState state, GamepadState? pad)
    {
        Draw(state, pad);
        using var ms = new MemoryStream();
        _bitmap.Save(ms, ImageFormat.Png);
        return ms.ToArray();
    }

    private void Draw(InputState state, GamepadState? pad)
    {
        _g.Clear(Color.Transparent);
        float u = Math.Min(Width / (_unitsW + 0.2f), Height / (_unitsH + 0.2f));
        var saved = _g.Save();
        _g.TranslateTransform((Width - _unitsW * u) / 2, (Height - _unitsH * u) / 2);
        switch (_kind)
        {
            case "cat":
                DrawCaps(state, u, _capsBox.X, _capsBox.Y);
                if (_layer.ShowMouse) DrawMouse(state, _mouse, u, big: false);
                DrawCat(state, u);
                DrawPaws(state, u);
                break;
            case "controller":
                DrawController(pad, u);
                break;
            case "mouse":
                DrawMouse(state, new RectangleF(0, 0, _unitsW, _unitsH), u, big: _design != "simple");
                break;
            default:
                DrawCaps(state, u, 0, 0);
                if (_layer.ShowMouse) DrawMouse(state, _mouse, u, big: false);
                break;
        }
        _g.Restore(saved);
    }

    private void DrawCaps(InputState state, float u, float offsetX, float offsetY)
    {
        using var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        float stroke = Math.Max(1f, u * 0.055f);
        foreach (var cap in _caps)
        {
            bool on = state.Keys.Contains(cap.Code);
            float gap = u * 0.06f;
            var rect = new RectangleF((cap.X + offsetX) * u + gap, (cap.Y + offsetY) * u + gap, cap.W * u - gap * 2, u - gap * 2);
            using var path = Rounded(rect, u * 0.17f);
            using (var fill = new SolidBrush(on ? _accent : Shade)) _g.FillPath(fill, path);
            using (var pen = new Pen(on ? _accent : Paper, stroke)) _g.DrawPath(pen, path);
            if (cap.Label.Length == 0) continue;
            if (cap.Label is "up" or "down" or "left" or "right") DrawArrowGlyph(rect, cap.Label, on ? _accentInk : Paper, stroke);
            else
            {
                float size = Math.Max(1, u * (cap.Label.Length > 2 ? 0.26f : 0.36f));
                using var font = new Font("Segoe UI Semibold", size, GraphicsUnit.Pixel);
                using var text = new SolidBrush(on ? _accentInk : Paper);
                _g.DrawString(cap.Label, font, text, rect, format);
            }
        }
    }

    private void DrawArrowGlyph(RectangleF rect, string direction, Color color, float stroke)
    {
        float cx = rect.X + rect.Width / 2, cy = rect.Y + rect.Height / 2, s = Math.Min(rect.Width, rect.Height) * 0.22f;
        var points = direction switch
        {
            "up" => new[] { new PointF(cx - s, cy + s * 0.6f), new PointF(cx, cy - s * 0.7f), new PointF(cx + s, cy + s * 0.6f) },
            "down" => new[] { new PointF(cx - s, cy - s * 0.6f), new PointF(cx, cy + s * 0.7f), new PointF(cx + s, cy - s * 0.6f) },
            "left" => new[] { new PointF(cx + s * 0.6f, cy - s), new PointF(cx - s * 0.7f, cy), new PointF(cx + s * 0.6f, cy + s) },
            _ => new[] { new PointF(cx - s * 0.6f, cy - s), new PointF(cx + s * 0.7f, cy), new PointF(cx - s * 0.6f, cy + s) },
        };
        using var pen = new Pen(color, stroke * 1.3f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        _g.DrawLines(pen, points);
    }

    private void DrawMouse(InputState state, RectangleF box, float u, bool big)
    {
        float stroke = Math.Max(1.2f, u * (big ? 0.07f : 0.055f));
        float x = box.X * u + stroke, y = box.Y * u + stroke;
        float w = box.Width * u - stroke * 2, h = box.Height * u - stroke * 2;

        // A mouse shape: narrow at the top, widest around the palm, rounded at the bottom.
        using var shell = new GraphicsPath();
        shell.AddBezier(x + w * 0.5f, y, x + w * 0.78f, y + h * 0.005f, x + w, y + h * 0.22f, x + w, y + h * 0.55f);
        shell.AddBezier(x + w, y + h * 0.55f, x + w, y + h * 0.87f, x + w * 0.8f, y + h, x + w * 0.5f, y + h);
        shell.AddBezier(x + w * 0.5f, y + h, x + w * 0.2f, y + h, x, y + h * 0.87f, x, y + h * 0.55f);
        shell.AddBezier(x, y + h * 0.55f, x, y + h * 0.22f, x + w * 0.22f, y + h * 0.005f, x + w * 0.5f, y);
        shell.CloseFigure();
        using (var fill = new SolidBrush(Shade)) _g.FillPath(fill, shell);

        float split = y + h * 0.42f;
        var clip = _g.Clip;
        _g.SetClip(shell);
        using (var pressed = new SolidBrush(_accent))
        {
            if (state.Buttons.Contains(1)) _g.FillRectangle(pressed, x, y, w / 2, split - y);
            if (state.Buttons.Contains(2)) _g.FillRectangle(pressed, x + w / 2, y, w / 2, split - y);
        }
        _g.Clip = clip;

        using var pen = new Pen(Paper, stroke) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round };
        _g.DrawPath(pen, shell);
        _g.DrawLine(pen, x + w * 0.06f, split, x + w * 0.94f, split);
        _g.DrawLine(pen, x + w / 2, y + h * 0.03f, x + w / 2, split);

        // scroll wheel between the buttons
        float wheelW = w * 0.13f, wheelH = h * 0.14f;
        var wheel = new RectangleF(x + w / 2 - wheelW / 2, y + h * 0.13f, wheelW, wheelH);
        using (var path = Rounded(wheel, wheelW / 2))
        {
            using var fill = new SolidBrush(state.Buttons.Contains(3) || state.Wheel != 0 ? _accent : Dim);
            _g.FillPath(fill, path);
            _g.DrawPath(pen, path);
        }
        if (state.Wheel != 0)
        {
            float ax = wheel.X + wheel.Width / 2, ay = state.Wheel > 0 ? wheel.Y - u * 0.14f : wheel.Bottom + u * 0.14f;
            float tip = state.Wheel > 0 ? -u * 0.12f : u * 0.12f;
            using var arrow = new SolidBrush(_accent);
            _g.FillPolygon(arrow, new[] { new PointF(ax - u * 0.13f, ay), new PointF(ax + u * 0.13f, ay), new PointF(ax, ay + tip) });
        }

        // thumb buttons on the left edge
        if (big)
        {
            float sw = w * 0.11f, sh = h * 0.055f, sx = x - sw * 0.2f;
            bool sideOn = state.Buttons.Contains(4) || state.Buttons.Contains(5);
            foreach (float sy in new[] { y + h * 0.46f, y + h * 0.57f })
            {
                using var side = Rounded(new RectangleF(sx, sy, sw, sh), sh / 2);
                using var fill = new SolidBrush(sideOn ? _accent : Shade);
                _g.FillPath(fill, side);
                _g.DrawPath(pen, side);
            }
        }

        // movement
        double magnitude = Math.Sqrt(state.Vx * state.Vx + state.Vy * state.Vy);
        if (big)
        {
            if (magnitude < 4) return;
            double strength = Math.Min(1, magnitude / 140);
            float cx = x + w / 2, cy = y + h * 0.72f;
            float length = (float)(w * (0.20 + 0.14 * strength));
            var saved = _g.Save();
            _g.TranslateTransform(cx, cy);
            _g.RotateTransform((float)(Math.Atan2(state.Vy, state.Vx) * 180 / Math.PI));
            float head = length * 0.58f, thick = length * 0.3f;
            using (var brush = new SolidBrush(Color.FromArgb((int)(150 + 105 * strength), _accent)))
            {
                _g.FillPolygon(brush, new[]
                {
                    new PointF(length, 0), new PointF(length - head, -head * 0.78f), new PointF(length - head, -thick / 2),
                    new PointF(-length * 0.75f, -thick / 2), new PointF(-length * 0.75f, thick / 2),
                    new PointF(length - head, thick / 2), new PointF(length - head, head * 0.78f),
                });
            }
            _g.Restore(saved);
        }
        else
        {
            double k = magnitude > 0 ? Math.Min(1, magnitude / 160) / magnitude : 0;
            float cx = x + w / 2 + (float)(state.Vx * k * w * 0.28);
            float cy = y + h * 0.72f + (float)(state.Vy * k * h * 0.16);
            using var dot = new SolidBrush(magnitude > 3 ? _accent : Dim);
            _g.FillEllipse(dot, cx - u * 0.09f, cy - u * 0.09f, u * 0.18f, u * 0.18f);
        }
    }

    private void DrawController(GamepadState? pad, float u)
    {
        bool sony = _design == "playstation";
        float s = u * _unitsW / 320f; // drawn in a 320 x 230 box
        var saved = _g.Save();
        _g.ScaleTransform(s, s);
        using var pen = new Pen(Paper, 5.5f) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round };
        var state = pad ?? new GamepadState();

        DrawTrigger(new RectangleF(62, 4, 54, 21), state.LeftTrigger, pen, sony ? "L2" : "LT");
        DrawTrigger(new RectangleF(204, 4, 54, 21), state.RightTrigger, pen, sony ? "R2" : "RT");
        DrawShoulder(new RectangleF(56, 30, 66, 20), state.Has(GamepadButton.LeftBumper), pen, sony ? "L1" : "LB");
        DrawShoulder(new RectangleF(198, 30, 66, 20), state.Has(GamepadButton.RightBumper), pen, sony ? "R1" : "RB");

        using (var body = new GraphicsPath())
        {
            if (sony)
            {
                // Square shoulders, wings to the sides, two grips pointing straight down
                body.AddBezier(92, 66, 126, 52, 194, 52, 228, 66);
                body.AddBezier(228, 66, 288, 72, 312, 104, 300, 146);
                body.AddBezier(300, 146, 292, 192, 258, 224, 228, 208);
                body.AddBezier(228, 208, 206, 196, 198, 172, 182, 160);
                body.AddBezier(182, 160, 170, 152, 150, 152, 138, 160);
                body.AddBezier(138, 160, 122, 172, 114, 196, 92, 208);
                body.AddBezier(92, 208, 62, 224, 28, 192, 20, 146);
                body.AddBezier(20, 146, 8, 104, 32, 72, 92, 66);
            }
            else
            {
                // Rounded shoulders and long grips that angle outwards
                body.AddBezier(96, 70, 130, 52, 190, 52, 224, 70);
                body.AddBezier(224, 70, 282, 80, 312, 116, 302, 158);
                body.AddBezier(302, 158, 292, 208, 250, 230, 222, 200);
                body.AddBezier(222, 200, 206, 180, 192, 162, 168, 156);
                body.AddBezier(168, 156, 160, 154, 160, 154, 152, 156);
                body.AddBezier(152, 156, 128, 162, 114, 180, 98, 200);
                body.AddBezier(98, 200, 70, 230, 28, 208, 18, 158);
                body.AddBezier(18, 158, 8, 116, 38, 80, 96, 70);
            }
            body.CloseFigure();
            using var fill = new SolidBrush(Shade);
            _g.FillPath(fill, body);
            _g.DrawPath(pen, body);
        }

        PointF leftStick, rightStick, dpad, face = new(sony ? 230 : 234, sony ? 100 : 106);
        if (sony)
        {
            dpad = new PointF(80, 104);
            leftStick = new PointF(126, 180);
            rightStick = new PointF(196, 180);
            using var touch = Rounded(new RectangleF(126, 70, 68, 36), 8);
            using var fill = new SolidBrush(Color.FromArgb(80, 8, 8, 10));
            _g.FillPath(fill, touch);
            _g.DrawPath(pen, touch);
        }
        else
        {
            leftStick = new PointF(90, 110);
            dpad = new PointF(118, 186);
            rightStick = new PointF(204, 180);
            _g.DrawEllipse(pen, 147, 74, 26, 26);
        }

        DrawDpad(dpad, state, pen);
        DrawStick(leftStick, state.LeftX, state.LeftY, state.Has(GamepadButton.LeftStick), pen);
        DrawStick(rightStick, state.RightX, state.RightY, state.Has(GamepadButton.RightStick), pen);
        DrawFaceButtons(face, state, sony, pen);

        foreach (var (center, on) in new[]
                 {
                     (sony ? new PointF(106, 80) : new PointF(133, 124), state.Has(GamepadButton.Back)),
                     (sony ? new PointF(214, 80) : new PointF(187, 124), state.Has(GamepadButton.Start)),
                 })
        {
            var rect = new RectangleF(center.X - 10, center.Y - 6.5f, 20, 13);
            using var path = Rounded(rect, 6.5f);
            using var fill = new SolidBrush(on ? _accent : Shade);
            _g.FillPath(fill, path);
            _g.DrawPath(pen, path);
        }

        if (!state.Connected)
        {
            using var font = new Font("Segoe UI Semibold", 16, GraphicsUnit.Pixel);
            using var text = new SolidBrush(Dim);
            using var format = new StringFormat { Alignment = StringAlignment.Center };
            _g.DrawString("no controller", font, text, new RectangleF(0, 206, 320, 24), format);
        }
        _g.Restore(saved);
    }

    private void DrawShoulder(RectangleF rect, bool on, Pen pen, string label)
    {
        using var path = Rounded(rect, 9);
        using (var fill = new SolidBrush(on ? _accent : Shade)) _g.FillPath(fill, path);
        _g.DrawPath(pen, path);
        using var font = new Font("Segoe UI Semibold", 11, GraphicsUnit.Pixel);
        using var text = new SolidBrush(on ? _accentInk : Paper);
        using var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        _g.DrawString(label, font, text, rect, format);
    }

    private void DrawTrigger(RectangleF rect, float amount, Pen pen, string label)
    {
        using var path = Rounded(rect, 9);
        using (var fill = new SolidBrush(Shade)) _g.FillPath(fill, path);
        if (amount > 0.02f)
        {
            var clip = _g.Clip;
            _g.SetClip(path);
            using var fill = new SolidBrush(_accent);
            _g.FillRectangle(fill, rect.X, rect.Bottom - rect.Height * amount, rect.Width, rect.Height * amount);
            _g.Clip = clip;
        }
        _g.DrawPath(pen, path);
        using var font = new Font("Segoe UI Semibold", 11, GraphicsUnit.Pixel);
        using var text = new SolidBrush(amount > 0.5f ? _accentInk : Paper);
        using var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        _g.DrawString(label, font, text, rect, format);
    }

    private void DrawStick(PointF center, float x, float y, bool pressed, Pen pen)
    {
        const float well = 30, knob = 19, travel = 10;
        using (var wellFill = new SolidBrush(Color.FromArgb(90, 8, 8, 10)))
            _g.FillEllipse(wellFill, center.X - well, center.Y - well, well * 2, well * 2);
        _g.DrawEllipse(pen, center.X - well, center.Y - well, well * 2, well * 2);
        float kx = center.X + x * travel, ky = center.Y - y * travel;
        using (var fill = new SolidBrush(pressed ? _accent : Shade)) _g.FillEllipse(fill, kx - knob, ky - knob, knob * 2, knob * 2);
        _g.DrawEllipse(pen, kx - knob, ky - knob, knob * 2, knob * 2);
        using (var dish = new Pen(Color.FromArgb(150, Paper), 2.4f))
            _g.DrawEllipse(dish, kx - knob * 0.55f, ky - knob * 0.55f, knob * 1.1f, knob * 1.1f);
    }

    private void DrawDpad(PointF center, GamepadState state, Pen pen)
    {
        const float arm = 46, thick = 18, round = 4;
        using var path = new GraphicsPath();
        using (var vertical = Rounded(new RectangleF(center.X - thick / 2, center.Y - arm / 2, thick, arm), round))
        using (var horizontal = Rounded(new RectangleF(center.X - arm / 2, center.Y - thick / 2, arm, thick), round))
        {
            path.AddPath(vertical, false);
            path.AddPath(horizontal, false);
        }
        using (var fill = new SolidBrush(Shade)) _g.FillPath(fill, path);
        foreach (var (button, rect) in new[]
                 {
                     (GamepadButton.Up, new RectangleF(center.X - thick / 2, center.Y - arm / 2, thick, arm / 2 - thick / 2)),
                     (GamepadButton.Down, new RectangleF(center.X - thick / 2, center.Y + thick / 2, thick, arm / 2 - thick / 2)),
                     (GamepadButton.Left, new RectangleF(center.X - arm / 2, center.Y - thick / 2, arm / 2 - thick / 2, thick)),
                     (GamepadButton.Right, new RectangleF(center.X + thick / 2, center.Y - thick / 2, arm / 2 - thick / 2, thick)),
                 })
        {
            if (!state.Has(button)) continue;
            using var fill = new SolidBrush(_accent);
            _g.FillRectangle(fill, rect);
        }
        _g.DrawPath(pen, path);
    }

    private void DrawFaceButtons(PointF center, GamepadState state, bool sony, Pen pen)
    {
        const float spread = 31, radius = 15f;
        var buttons = new (GamepadButton Button, PointF At, string Label)[]
        {
            (GamepadButton.Y, new PointF(center.X, center.Y - spread), sony ? "triangle" : "Y"),
            (GamepadButton.B, new PointF(center.X + spread, center.Y), sony ? "circle" : "B"),
            (GamepadButton.A, new PointF(center.X, center.Y + spread), sony ? "cross" : "A"),
            (GamepadButton.X, new PointF(center.X - spread, center.Y), sony ? "square" : "X"),
        };
        foreach (var (button, at, label) in buttons)
        {
            bool on = state.Has(button);
            using (var fill = new SolidBrush(on ? _accent : Shade)) _g.FillEllipse(fill, at.X - radius, at.Y - radius, radius * 2, radius * 2);
            _g.DrawEllipse(pen, at.X - radius, at.Y - radius, radius * 2, radius * 2);
            var ink = on ? _accentInk : Paper;
            if (sony) DrawSonyGlyph(at, label, ink);
            else
            {
                using var font = new Font("Segoe UI Semibold", 16, GraphicsUnit.Pixel);
                using var text = new SolidBrush(ink);
                using var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                _g.DrawString(label, font, text, new RectangleF(at.X - radius, at.Y - radius + 1, radius * 2, radius * 2), format);
            }
        }
    }

    private void DrawSonyGlyph(PointF at, string glyph, Color color)
    {
        const float r = 7.5f;
        using var pen = new Pen(color, 2.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        switch (glyph)
        {
            case "triangle":
                _g.DrawPolygon(pen, new[] { new PointF(at.X, at.Y - r), new PointF(at.X + r, at.Y + r * 0.8f), new PointF(at.X - r, at.Y + r * 0.8f) });
                break;
            case "circle":
                _g.DrawEllipse(pen, at.X - r, at.Y - r, r * 2, r * 2);
                break;
            case "square":
                _g.DrawRectangle(pen, at.X - r * 0.85f, at.Y - r * 0.85f, r * 1.7f, r * 1.7f);
                break;
            default:
                _g.DrawLine(pen, at.X - r * 0.8f, at.Y - r * 0.8f, at.X + r * 0.8f, at.Y + r * 0.8f);
                _g.DrawLine(pen, at.X + r * 0.8f, at.Y - r * 0.8f, at.X - r * 0.8f, at.Y + r * 0.8f);
                break;
        }
    }

    // ---------- the cat ----------

    private void InkThenPaper(GraphicsPath path, float ink, Color? fill = null)
    {
        using (var outline = new Pen(Color.FromArgb(235, 10, 10, 12), ink) { LineJoin = LineJoin.Round }) _g.DrawPath(outline, path);
        using var brush = new SolidBrush(fill ?? Paper);
        _g.FillPath(brush, path);
    }

    /// <summary>Our own cat, drawn for Snappy. Left paw taps the keys, right paw rides the mouse.</summary>
    /// <summary>Our own cat, drawn for Snappy. The left paw taps the keys, the right paw rides the mouse.</summary>
    /// <summary>Our own cat, drawn for Snappy. It sits behind your keys and slaps the side you are using.</summary>
    private void DrawCat(InputState state, float u)
    {
        var saved = _g.Save();
        _g.TranslateTransform(_catBox.X * u, _catBox.Y * u);
        float s = _catBox.Width * u / 200f; // drawn in a 200 x 150 box
        _g.ScaleTransform(s, s);
        const float ink = 7f;
        var dark = Color.FromArgb(240, 12, 12, 14);

        // tail, behind the body
        using (var tail = new GraphicsPath())
        {
            tail.AddBezier(134, 118, 172, 124, 182, 92, 166, 74);
            using var outline = new Pen(dark, ink + 7) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            _g.DrawPath(outline, tail);
            using var inner = new Pen(Paper, ink + 1) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            _g.DrawPath(inner, tail);
        }

        using (var cat = new GraphicsPath())
        {
            cat.AddBezier(72, 132, 68, 104, 78, 90, 100, 90);
            cat.AddBezier(100, 90, 122, 90, 132, 104, 128, 132);
            cat.AddLine(128, 132, 72, 132);
            cat.CloseFigure();
            cat.AddEllipse(60, 28, 80, 68);
            cat.AddPolygon(new[] { new PointF(71, 44), new PointF(65, 11), new PointF(94, 30) });
            cat.AddPolygon(new[] { new PointF(129, 44), new PointF(135, 11), new PointF(106, 30) });
            InkThenPaper(cat, ink);
        }

        using (var inner = new SolidBrush(Color.FromArgb(70, 12, 12, 14)))
        {
            _g.FillPolygon(inner, new[] { new PointF(74, 41), new PointF(70, 21), new PointF(88, 32) });
            _g.FillPolygon(inner, new[] { new PointF(126, 41), new PointF(130, 21), new PointF(112, 32) });
        }

        bool blink = state.TimeMs % 4200 < 130;
        using (var brush = new SolidBrush(dark))
        {
            if (blink)
            {
                using var lids = new Pen(dark, 3.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
                _g.DrawLine(lids, 78, 58, 91, 58);
                _g.DrawLine(lids, 109, 58, 122, 58);
            }
            else
            {
                _g.FillEllipse(brush, 78, 50, 13, 16);
                _g.FillEllipse(brush, 109, 50, 13, 16);
                using var shine = new SolidBrush(Color.FromArgb(235, 255, 255, 255));
                _g.FillEllipse(shine, 85, 53, 4.5f, 4.5f);
                _g.FillEllipse(shine, 116, 53, 4.5f, 4.5f);
            }
            _g.FillPolygon(brush, new[] { new PointF(95, 70), new PointF(105, 70), new PointF(100, 76) });
        }
        using (var line = new Pen(dark, 2.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
        {
            using var mouth = new GraphicsPath();
            mouth.AddBezier(100, 76, 100, 82, 91, 83, 88, 77);
            mouth.AddBezier(100, 76, 100, 82, 109, 83, 112, 77);
            _g.DrawPath(line, mouth);
            foreach (float dy in new[] { -5f, 2f })
            {
                _g.DrawLine(line, 68, 64 + dy, 44, 60 + dy * 1.7f);
                _g.DrawLine(line, 132, 64 + dy, 156, 60 + dy * 1.7f);
            }
        }
        _g.Restore(saved);
    }

    /// <summary>The paws, drawn over the keys so they really look like they are hitting them.</summary>
    /// <summary>The paws, drawn over the keys so they really look like they are hitting them.</summary>
    private void DrawPaws(InputState state, float u)
    {
        bool leftDown = state.Keys.Any(LeftHand.Contains);
        bool rightKey = state.Keys.Any(k => !LeftHand.Contains(k));
        bool click = state.Buttons.Count > 0;

        float shoulderY = (_catBox.Bottom - 0.42f) * u;
        float rest = (_catBox.Bottom + 0.05f) * u;
        float hit = _capsBox.Height > 0 ? (_capsBox.Y + 0.4f) * u : rest + u * 0.45f;

        float leftX = Math.Max(_capsBox.X + _capsBox.Width * 0.18f, _catBox.X + _catBox.Width * 0.12f) * u;
        DrawPaw((_catBox.X + _catBox.Width * 0.3f) * u, shoulderY, leftX, leftDown ? hit : rest, -16, leftDown, u);

        bool rightDown = _layer.ShowMouse ? click : rightKey;
        float rightX = _layer.ShowMouse
            ? (_mouse.X + _mouse.Width * 0.5f) * u
            : Math.Min(_capsBox.Right - _capsBox.Width * 0.18f, _catBox.Right - _catBox.Width * 0.12f) * u;
        float rightY = _layer.ShowMouse ? (_mouse.Y + (click ? 0.55f : 0.35f)) * u : rightDown ? hit : rest;
        DrawPaw((_catBox.X + _catBox.Width * 0.7f) * u, shoulderY, rightX, rightY, 16, rightDown, u);
    }

    /// <summary>One arm: a short bent limb from under the chest into a paw.</summary>
    private void DrawPaw(float shoulderX, float shoulderY, float x, float y, float rotation, bool down, float u)
    {
        float thickness = u * 0.22f;
        using var arm = new GraphicsPath();
        float bendX = (shoulderX + x) / 2 + (x > shoulderX ? u * 0.12f : -u * 0.12f);
        float bendY = Math.Max(shoulderY, y) + u * 0.16f;
        arm.AddBezier(shoulderX, shoulderY, shoulderX, shoulderY + u * 0.1f, bendX, bendY, x, y);
        using (var outline = new Pen(Color.FromArgb(240, 12, 12, 14), thickness + u * 0.09f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            _g.DrawPath(outline, arm);
        using (var fill = new Pen(Paper, thickness) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            _g.DrawPath(fill, arm);
        using var paw = Ellipse(x, y, u * 0.2f, u * 0.15f, rotation);
        InkThenPaper(paw, u * 0.07f, down ? _accent : (Color?)null);
    }

    private void DrawPaw(float shoulderX, float shoulderY, float x, float y, float rotation, bool down, Color dark)
    {
        float arm = Math.Max(3f, Math.Abs(x - shoulderX) * 0.06f + 9f);
        using (var outline = new Pen(dark, arm + 5) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            _g.DrawLine(outline, shoulderX, shoulderY, x, y);
        using (var fill = new Pen(Paper, arm) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            _g.DrawLine(fill, shoulderX, shoulderY, x, y);
        using var paw = Ellipse(x, y, arm * 0.95f, arm * 0.72f, rotation);
        InkThenPaper(paw, 5f, down ? _accent : (Color?)null);
    }


    // ---------- helpers ----------

    private static GraphicsPath Rounded(RectangleF r, float radius)
    {
        float d = Math.Max(0.1f, Math.Min(radius * 2, Math.Min(r.Width, r.Height)));
        var path = new GraphicsPath();
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    private static GraphicsPath Ellipse(float cx, float cy, float rx, float ry, float rotation = 0)
    {
        var path = new GraphicsPath();
        path.AddEllipse(-rx, -ry, rx * 2, ry * 2);
        using var m = new Matrix();
        m.Translate(cx, cy);
        m.Rotate(rotation);
        path.Transform(m);
        return path;
    }

    private void ApplyOpacity()
    {
        var data = _bitmap.LockBits(new Rectangle(0, 0, Width, Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        try
        {
            unsafe
            {
                byte* p = (byte*)data.Scan0;
                int factor = (int)(Math.Clamp(_layer.Opacity, 0, 1) * 256);
                for (int i = 3; i < Width * Height * 4; i += 4) p[i] = (byte)(p[i] * factor >> 8);
            }
        }
        finally { _bitmap.UnlockBits(data); }
    }

    public static Color ParseColor(string? hex)
    {
        if (hex != null && hex.StartsWith('#') && hex.Length == 7 &&
            int.TryParse(hex[1..], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out int rgb))
            return Color.FromArgb(255, (rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
        return Color.FromArgb(255, 244, 244, 244);
    }

    private static double Luminance(Color c) => (0.2126 * c.R + 0.7152 * c.G + 0.0722 * c.B) / 255;

    /// <summary>Short label for a key, so an overlay never shows something like "Oemcomma".</summary>
    public static string KeyName(int code) =>
        Positions.TryGetValue(code, out var known) ? known.Label :
        Names.TryGetValue(code, out string? name) ? name :
        code >= 0x30 && code <= 0x5A ? ((char)code).ToString() : $"#{code}";

    private static readonly HashSet<int> LeftHand = new()
    {
        0x09, 0x10, 0x11, 0x12, 0x14, 0x20, 0x31, 0x32, 0x33, 0x34, 0x35, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,
        0x51, 0x52, 0x53, 0x54, 0x56, 0x57, 0x58, 0x5A, 0xC0,
    };

    private static readonly Dictionary<int, string> Names = new()
    {
        [0x08] = "Bksp", [0x0D] = "Enter", [0x1B] = "Esc", [0x21] = "PgUp", [0x22] = "PgDn", [0x23] = "End", [0x24] = "Home",
        [0x25] = "left", [0x26] = "up", [0x27] = "right", [0x28] = "down", [0x2D] = "Ins", [0x2E] = "Del",
        [0x5B] = "Win", [0x5D] = "Menu", [0xBA] = ";", [0xBB] = "=", [0xBC] = ",", [0xBD] = "-", [0xBE] = ".",
        [0xBF] = "/", [0xDB] = "[", [0xDC] = "\\", [0xDD] = "]", [0xDE] = "'",
    };

    private static readonly Dictionary<int, (float X, float Y, float W, string Label)> Positions = BuildPositions();

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
        map[0x25] = (10.5f, 4, 1, "left");
        map[0x28] = (11.5f, 4, 1, "down");
        map[0x27] = (12.5f, 4, 1, "right");
        map[0x26] = (11.5f, 3, 1, "up");
        for (int i = 1; i <= 12; i++) map[0x6F + i] = (i - 1 + (i > 4 ? 0.5f : 0) + (i > 8 ? 0.5f : 0), -1.3f, 1, $"F{i}");
        return map;
    }

    public void Dispose()
    {
        _g.Dispose();
        _bitmap.Dispose();
    }
}
