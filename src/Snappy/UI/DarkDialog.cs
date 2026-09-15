using System.Runtime.InteropServices;

namespace Snappy.UI;

/// <summary>A small question box in Snappy's black and white look, for the few prompts shown outside the main window.</summary>
public sealed class DarkDialog : Form
{
    private static readonly Color Background = Color.FromArgb(14, 14, 14);
    private static readonly Color Foreground = Color.FromArgb(244, 244, 244);
    private static readonly Color Muted = Color.FromArgb(163, 163, 163);
    private static readonly Color Line = Color.FromArgb(58, 58, 58);

    private DarkDialog(string title, string message, string ok, string? cancel)
    {
        SuspendLayout();
        AutoScaleDimensions = new SizeF(96, 96);
        AutoScaleMode = AutoScaleMode.Dpi;
        Text = "Snappy";
        Icon = AppAssets.AppIcon();
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Background;
        ForeColor = Foreground;
        Font = new Font("Segoe UI", 10f);

        var picture = new PictureBox { Location = new Point(24, 26), Size = new Size(44, 44), SizeMode = PictureBoxSizeMode.Zoom };
        if (Icon != null) picture.Image = new Icon(Icon, 64, 64).ToBitmap();
        var titleLabel = new Label
        {
            Text = title, AutoSize = true, MaximumSize = new Size(340, 0), Location = new Point(84, 24),
            Font = new Font("Segoe UI Semibold", 13f), ForeColor = Foreground,
        };
        Controls.Add(picture);
        Controls.Add(titleLabel);
        var messageLabel = new Label
        {
            Text = message, AutoSize = true, MaximumSize = new Size(340, 0), ForeColor = Muted,
            Location = new Point(84, titleLabel.Location.Y + titleLabel.PreferredHeight + 8),
        };
        Controls.Add(messageLabel);

        int buttonsTop = Math.Max(picture.Bottom, messageLabel.Location.Y + messageLabel.PreferredHeight) + 24;
        int right = 448 - 24;
        var okButton = MakeButton(ok, primary: true);
        okButton.Location = new Point(right - okButton.Width, buttonsTop);
        okButton.DialogResult = DialogResult.OK;
        Controls.Add(okButton);
        AcceptButton = okButton;
        if (cancel != null)
        {
            var cancelButton = MakeButton(cancel, primary: false);
            cancelButton.Location = new Point(okButton.Left - 8 - cancelButton.Width, buttonsTop);
            cancelButton.DialogResult = DialogResult.Cancel;
            Controls.Add(cancelButton);
            CancelButton = cancelButton;
        }
        ClientSize = new Size(448, buttonsTop + okButton.Height + 20);
        ResumeLayout(true);
    }

    /// <summary>Returns true when the main button was clicked.</summary>
    public static bool Ask(string title, string message, string ok, string? cancel = "Cancel", IWin32Window? owner = null)
    {
        using var dialog = new DarkDialog(title, message, ok, cancel);
        return dialog.ShowDialog(owner) == DialogResult.OK;
    }

    private Button MakeButton(string text, bool primary)
    {
        var button = new Button
        {
            Text = text,
            FlatStyle = FlatStyle.Flat,
            Size = new Size(Math.Max(96, TextRenderer.MeasureText(text, Font).Width + 36), 36),
            BackColor = primary ? Foreground : Background,
            ForeColor = primary ? Color.FromArgb(10, 10, 10) : Foreground,
            Font = new Font("Segoe UI Semibold", 10f),
            Cursor = Cursors.Hand,
            UseVisualStyleBackColor = false,
        };
        button.FlatAppearance.BorderSize = 1;
        button.FlatAppearance.BorderColor = primary ? Foreground : Line;
        button.FlatAppearance.MouseOverBackColor = primary ? Color.White : Color.FromArgb(34, 34, 34);
        button.FlatAppearance.MouseDownBackColor = primary ? Color.FromArgb(220, 220, 220) : Color.FromArgb(44, 44, 44);
        return button;
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int on = 1;
        DwmSetWindowAttribute(Handle, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, ref on, sizeof(int));
        int caption = 0x000E0E0E;
        DwmSetWindowAttribute(Handle, 35 /* DWMWA_CAPTION_COLOR */, ref caption, sizeof(int));
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
}
