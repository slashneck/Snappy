using System.Drawing.Imaging;
using System.Text.Json;
using Snappy.Core;

namespace Snappy.UI;

/// <summary>
/// Whatever outfit Snappy wears in the app, she wears on the clip pop-up too. The page draws the pop-up's animation
/// strips again with the outfit on (same moods, frames and layout as the built-in ones) and hands them over as PNGs.
/// They're kept in the local cache folder, so she still has it on when the library window isn't open, and an outfit
/// that's only for today comes off at midnight.
/// </summary>
internal static class OverlayOutfit
{
    private sealed record Meta(string Key, long Until, string Voice = "", PopupStyle? Style = null);

    /// <summary>A skin's own pop-up: bubble colours (#rrggbb), font, corner radius, and what it says instead of Snappy
    /// (any line left out stays hers). Depth gives the lettering a solid edge in that colour, as if cut from something.</summary>
    public sealed record PopupStyle(string Bg, string Ink, string Sub, string Error, string? Edge, string Font, bool Bold, double Radius,
        string? Saving, string[]? Saved, string? Failed, string? Shiny, string? Screenshot, string? Moment, string? Depth = null);

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private static readonly object Gate = new();
    private static readonly Dictionary<string, Bitmap> Sheets = new();
    private static string _key = "", _voice = "";
    private static PopupStyle? _style;
    private static long _until;
    private static bool _loaded;

    private static string Dir => Path.Combine(AppPaths.LocalDataDir, "overlay-outfit");
    private static string MetaPath => Path.Combine(Dir, "outfit.json");

    private static bool Expired => _until > 0 && DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() > _until;

    /// <summary>What the strips on hand were drawn from ("" for none), so the page only draws them again when it changed.</summary>
    public static string Key
    {
        get { lock (Gate) { Load(); return Expired ? "" : _key; } }
    }

    /// <summary>Who the pop-up is in that outfit: "program" in the Program's skin (it talks and looks like the Program
    /// then), "" for Snappy.</summary>
    public static string Voice
    {
        get { lock (Gate) { Load(); return Expired || _key.Length == 0 ? "" : _voice; } }
    }

    /// <summary>The bubble and lines of the skin she's in, or null for Snappy's own.</summary>
    public static PopupStyle? Style
    {
        get { lock (Gate) { Load(); return Expired || _key.Length == 0 ? null : _style; } }
    }

    /// <summary>The strip to play instead of the built-in one, or null.</summary>
    public static Bitmap? Sheet(string name)
    {
        lock (Gate)
        {
            Load();
            return Expired ? null : Sheets.GetValueOrDefault(name);
        }
    }

    /// <summary>New strips (base64 PNGs by strip name), or null to take the outfit off again.</summary>
    public static void Set(string key, long until, string voice, string? styleJson, IReadOnlyDictionary<string, string>? pngs)
    {
        var strips = AppAssets.OverlayStrips();
        var fresh = new Dictionary<string, Bitmap>();
        try
        {
            foreach (var (name, b64) in pngs ?? new Dictionary<string, string>())
            {
                // only the pop-up's own strips, in exactly the layout it plays them in
                if (name == "faces" || !strips.TryGetValue(name, out var info) || b64.Length > 12_000_000) continue;
                var sheet = Decode(Convert.FromBase64String(b64));
                int rows = (info.Frames + info.Cols - 1) / info.Cols;
                if (sheet.Width == info.Cols * info.Size && sheet.Height == rows * info.Size) fresh[name] = sheet;
                else sheet.Dispose();
            }
        }
        catch (Exception ex)
        {
            Log.Warn($"Outfit strips for the pop-up were not usable: {ex.Message}");
            foreach (var b in fresh.Values) b.Dispose();
            return;
        }

        lock (Gate)
        {
            _loaded = true;
            foreach (var b in Sheets.Values) b.Dispose();
            Sheets.Clear();
            foreach (var (name, b) in fresh) Sheets[name] = b;
            _key = Sheets.Count > 0 ? key : "";
            _voice = voice;
            _style = null;
            try { if (!string.IsNullOrEmpty(styleJson) && styleJson != "null") _style = JsonSerializer.Deserialize<PopupStyle>(styleJson, Web); }
            catch (Exception ex) { Log.Warn($"The pop-up style was not usable: {ex.Message}"); }
            _until = until;
            try
            {
                Directory.CreateDirectory(Dir);
                foreach (var name in strips.Keys)
                {
                    string png = Path.Combine(Dir, $"{name}.png");
                    if (Sheets.TryGetValue(name, out var b)) b.Save(png, ImageFormat.Png);
                    else if (File.Exists(png)) File.Delete(png);
                }
                File.WriteAllText(MetaPath, JsonSerializer.Serialize(new Meta(_key, _until, _voice, _style), Web));
            }
            catch (Exception ex)
            {
                Log.Warn($"Could not keep the pop-up's outfit: {ex.Message}");
            }
        }
    }

    /// <summary>A PNG as a standalone premultiplied bitmap, like the built-in strips.</summary>
    private static Bitmap Decode(byte[] png)
    {
        using var ms = new MemoryStream(png);
        using var tmp = new Bitmap(ms);
        var copy = new Bitmap(tmp.Width, tmp.Height, PixelFormat.Format32bppPArgb);
        using (var g = Graphics.FromImage(copy))
        {
            g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
            g.DrawImage(tmp, 0, 0, tmp.Width, tmp.Height);
        }
        return copy;
    }

    // What was kept from last time, the first time it's needed.
    private static void Load()
    {
        if (_loaded) return;
        _loaded = true;
        try
        {
            if (!File.Exists(MetaPath)) return;
            var meta = JsonSerializer.Deserialize<Meta>(File.ReadAllText(MetaPath), Web);
            if (meta == null || meta.Key.Length == 0) return;
            foreach (var name in AppAssets.OverlayStrips().Keys)
            {
                string png = Path.Combine(Dir, $"{name}.png");
                if (File.Exists(png)) Sheets[name] = Decode(File.ReadAllBytes(png));
            }
            _key = meta.Key;
            _until = meta.Until;
            _voice = meta.Voice;
            _style = meta.Style;
        }
        catch (Exception ex)
        {
            Log.Warn($"Could not read the pop-up's outfit: {ex.Message}");
        }
    }
}
