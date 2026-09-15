using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

namespace Snappy.UI;

/// <summary>Dark tray menu that matches the app instead of the default light Windows menu.</summary>
internal sealed class DarkMenuRenderer : ToolStripProfessionalRenderer
{
    private static readonly Color Background = Color.FromArgb(18, 18, 18);
    private static readonly Color Hover = Color.FromArgb(40, 40, 40);
    private static readonly Color Line = Color.FromArgb(48, 48, 48);
    private static readonly Color Text = Color.FromArgb(244, 244, 244);
    private static readonly Color Muted = Color.FromArgb(125, 125, 125);

    public DarkMenuRenderer() : base(new Palette())
    {
        RoundedEdges = false;
    }

    /// <summary>Applies padding and Windows 11 rounded corners to a menu or submenu.</summary>
    public static void Style(ToolStripDropDown dropDown)
    {
        dropDown.BackColor = Background;
        dropDown.ForeColor = Text;
        foreach (ToolStripItem item in dropDown.Items)
        {
            if (item is ToolStripMenuItem menuItem)
            {
                menuItem.Padding = new Padding(2, 5, 2, 5);
                if (menuItem.HasDropDownItems) Style(menuItem.DropDown);
            }
        }
        if (dropDown.IsHandleCreated) ApplyWindowStyle(dropDown.Handle);
        else dropDown.HandleCreated += (_, _) => ApplyWindowStyle(dropDown.Handle);
    }

    private static void ApplyWindowStyle(IntPtr hwnd)
    {
        int round = 2; // DWMWCP_ROUND
        DwmSetWindowAttribute(hwnd, 33, ref round, sizeof(int));
        int border = Line.R | (Line.G << 8) | (Line.B << 16);
        DwmSetWindowAttribute(hwnd, 34, ref border, sizeof(int));
    }

    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e) => e.Graphics.Clear(Background);

    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        // Windows 11 draws a rounded border for us; older versions get a plain one.
        if (Environment.OSVersion.Version.Build >= 22000) return;
        using var pen = new Pen(Line);
        e.Graphics.DrawRectangle(pen, 0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
    }

    protected override void OnRenderImageMargin(ToolStripRenderEventArgs e) { }

    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        if (!e.Item.Selected || !e.Item.Enabled) return;
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new RectangleF(5, 1, e.Item.Width - 10, e.Item.Height - 2);
        using var path = new GraphicsPath();
        const float d = 10;
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        using var brush = new SolidBrush(Hover);
        g.FillPath(brush, path);
    }

    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
    {
        bool shortcut = e.Item is ToolStripMenuItem m && !string.IsNullOrEmpty(e.Text) && m.ShortcutKeyDisplayString == e.Text;
        e.TextColor = !e.Item.Enabled || shortcut ? Muted : Text;
        base.OnRenderItemText(e);
    }

    protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
    {
        e.ArrowColor = e.Item?.Enabled == false ? Muted : Text;
        base.OnRenderArrow(e);
    }

    protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
    {
        int y = e.Item.Height / 2;
        using var pen = new Pen(Line);
        e.Graphics.DrawLine(pen, 12, y, e.Item.Width - 12, y);
    }

    protected override void OnRenderItemCheck(ToolStripItemImageRenderEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        float cx = e.ImageRectangle.X + e.ImageRectangle.Width / 2f, cy = e.ImageRectangle.Y + e.ImageRectangle.Height / 2f;
        using var pen = new Pen(Text, 1.8f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        g.DrawLines(pen, new[] { new PointF(cx - 4.5f, cy), new PointF(cx - 1.5f, cy + 3f), new PointF(cx + 4.5f, cy - 3.5f) });
    }

    private sealed class Palette : ProfessionalColorTable
    {
        public override Color ToolStripDropDownBackground => Background;
        public override Color ImageMarginGradientBegin => Background;
        public override Color ImageMarginGradientMiddle => Background;
        public override Color ImageMarginGradientEnd => Background;
        public override Color MenuBorder => Line;
        public override Color MenuItemBorder => Color.Transparent;
        public override Color MenuItemSelected => Hover;
        public override Color SeparatorDark => Line;
        public override Color SeparatorLight => Background;
        public override Color CheckBackground => Background;
        public override Color CheckSelectedBackground => Hover;
        public override Color CheckPressedBackground => Hover;
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
}
