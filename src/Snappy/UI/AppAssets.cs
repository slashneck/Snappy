using System.Media;
using System.Text.Json;

namespace Snappy.UI;

/// <summary>Icons, overlay animation strips and the save sound, all embedded in Snappy.exe.</summary>
internal static class AppAssets
{
    private static readonly Dictionary<string, Icon> Icons = new();
    private static SoundPlayer? _snap;

    public static Stream Open(string name) =>
        typeof(AppAssets).Assembly.GetManifestResourceStream("Snappy.Assets." + name)
        ?? throw new FileNotFoundException($"Embedded asset missing: {name}");

    /// <summary>Tray icon for a state (recording, paused, saving, idle) at the exact size Windows wants for this DPI.</summary>
    public static Icon TrayIcon(string state)
    {
        var size = SystemInformation.SmallIconSize;
        string key = $"tray-{state}-{size.Width}";
        lock (Icons)
        {
            if (!Icons.TryGetValue(key, out var icon))
            {
                using var s = Open($"tray-{state}.ico");
                icon = new Icon(s, size);
                Icons[key] = icon;
            }
            return icon;
        }
    }

    public static Icon AppIcon()
    {
        lock (Icons)
        {
            if (!Icons.TryGetValue("app", out var icon))
            {
                using var s = Open("snappy.ico");
                icon = new Icon(s);
                Icons["app"] = icon;
            }
            return icon;
        }
    }

    /// <summary>Loads a PNG into a standalone 32-bit ARGB bitmap (the resource stream can be closed afterwards).</summary>
    public static Bitmap LoadBitmap(string name)
    {
        using var s = Open(name);
        using var tmp = new Bitmap(s);
        var copy = new Bitmap(tmp.Width, tmp.Height, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(copy))
        {
            g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
            g.DrawImage(tmp, 0, 0, tmp.Width, tmp.Height);
        }
        return copy;
    }

    public sealed record StripInfo(int Frames, int Size, int Cols, int Fps);

    public static Dictionary<string, StripInfo> OverlayStrips()
    {
        using var s = Open("overlay.json");
        return JsonSerializer.Deserialize<Dictionary<string, StripInfo>>(s, new JsonSerializerOptions(JsonSerializerDefaults.Web))
               ?? new Dictionary<string, StripInfo>();
    }

    public static void PlaySnap()
    {
        try
        {
            if (_snap == null)
            {
                _snap = new SoundPlayer(Open("snap.wav"));
                _snap.Load();
            }
            _snap.Play();
        }
        catch
        {
            SystemSounds.Asterisk.Play();
        }
    }
}
