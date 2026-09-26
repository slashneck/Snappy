using System.Text.Json;
using System.Text.Json.Serialization;
using Snappy.Core;

namespace Snappy.Studio;

/// <summary>One thing placed on top of the recording. Position and size are fractions of the output frame.</summary>
public sealed class StudioLayer
{
    public string Id { get; set; } = StudioSetup.NewId();
    public string Type { get; set; } = "image"; // image | gif | webcam | inputs
    public string Name { get; set; } = "";
    public bool Visible { get; set; } = true;
    public double X { get; set; } = 0.05;
    public double Y { get; set; } = 0.05;
    public double W { get; set; } = 0.2;
    public double H { get; set; } = 0.2;
    public double Opacity { get; set; } = 1;
    public double Rotation { get; set; }   // degrees clockwise, around the middle of the box

    // image, gif, webcam: how much of the picture is cut off on each side (0 to 0.9), and flips
    public double CropL { get; set; }
    public double CropT { get; set; }
    public double CropR { get; set; }
    public double CropB { get; set; }
    public bool FlipX { get; set; }        // a webcam uses Mirror for this
    public bool FlipY { get; set; }

    // image, gif
    public string File { get; set; } = "";
    public string Fit { get; set; } = "fill"; // fill stretches into the box, fit keeps the picture's shape

    // webcam
    public string Device { get; set; } = "";
    public string Shape { get; set; } = "rounded"; // rect | rounded | circle
    public bool Mirror { get; set; }

    // inputs
    public string Input { get; set; } = "keys";  // keys | keyboard | mouse | controller | cat
    public string Design { get; set; } = "";     // depends on the kind, empty picks the default
    public string Accent { get; set; } = "#f4f4f4";
    public string Style { get; set; } = "keys";  // older scenes said keys or cat, Input took over
    public List<string> Presets { get; set; } = new() { "shooter" };
    public List<int> ExtraKeys { get; set; } = new(); // virtual key codes
    public bool ShowKeys { get; set; } = true;
    public bool ShowMouse { get; set; } = true;
}

/// <summary>A game or program that a scene belongs to, matched by process name.</summary>
public sealed class SceneApp
{
    public string Exe { get; set; } = "";
    public string Name { get; set; } = "";
}

/// <summary>One layout of layers, like a scene in OBS.</summary>
public sealed class StudioScene
{
    private static readonly HashSet<string> Types = new() { "image", "gif", "webcam", "inputs" };
    private static readonly JsonSerializerOptions KeyJson = new(JsonSerializerDefaults.Web);
    private const int MaxLayers = 20;

    public string Id { get; set; } = StudioSetup.NewId();
    public string Name { get; set; } = "Scene";
    public List<SceneApp> Apps { get; set; } = new();
    public List<StudioLayer> Layers { get; set; } = new();

    [JsonIgnore] public bool IsActive => ActiveLayers.Any();

    [JsonIgnore]
    public IEnumerable<StudioLayer> ActiveLayers => Layers.Where(l => l.Visible && l.Opacity > 0.001 &&
        (l.Type == "inputs" || (l.Type == "webcam" && l.Device.Length > 0) ||
         (l.File.Length > 0 && System.IO.File.Exists(Path.Combine(StudioSetup.MediaDir, l.File)))));

    /// <summary>When this string changes, FFmpeg has to be restarted with the new layers.</summary>
    public string PipelineKey() => IsActive ? JsonSerializer.Serialize(ActiveLayers.ToList(), KeyJson) : "";

    public static StudioScene FromJson(string json) =>
        (JsonSerializer.Deserialize<StudioScene>(json, StudioSetup.Json) ?? new StudioScene()).Sanitize();

    internal StudioScene Sanitize()
    {
        Id = StudioSetup.CleanId(Id);
        Name = string.IsNullOrWhiteSpace(Name) ? "Scene" : Name.Trim()[..Math.Min(Name.Trim().Length, 40)];
        Apps ??= new List<SceneApp>();
        Apps.RemoveAll(a => a == null || string.IsNullOrWhiteSpace(a.Exe));
        foreach (var a in Apps)
        {
            a.Exe = new string(a.Exe.Trim().Where(c => c is not ('\\' or '/' or ':')).Take(100).ToArray());
            a.Name = string.IsNullOrWhiteSpace(a.Name) ? a.Exe : a.Name.Trim();
        }
        Layers ??= new List<StudioLayer>();
        Layers.RemoveAll(l => l == null || !Types.Contains(l.Type));
        if (Layers.Count > MaxLayers) Layers.RemoveRange(MaxLayers, Layers.Count - MaxLayers);
        var ids = new HashSet<string>();
        foreach (var l in Layers)
        {
            l.Id = StudioSetup.CleanId(l.Id);
            while (!ids.Add(l.Id)) l.Id = StudioSetup.NewId();
            l.Name ??= "";
            l.X = Math.Clamp(l.X, -1, 2);
            l.Y = Math.Clamp(l.Y, -1, 2);
            l.W = Math.Clamp(l.W, 0.005, 2);
            l.H = Math.Clamp(l.H, 0.005, 2);
            l.Opacity = Math.Clamp(l.Opacity, 0, 1);
            l.Rotation = double.IsFinite(l.Rotation) ? Math.IEEERemainder(l.Rotation, 360) : 0;
            if (Math.Abs(l.Rotation) < 0.05) l.Rotation = 0;
            l.CropL = Math.Clamp(double.IsFinite(l.CropL) ? l.CropL : 0, 0, 0.9);
            l.CropR = Math.Clamp(double.IsFinite(l.CropR) ? l.CropR : 0, 0, 0.9 - l.CropL);
            l.CropT = Math.Clamp(double.IsFinite(l.CropT) ? l.CropT : 0, 0, 0.9);
            l.CropB = Math.Clamp(double.IsFinite(l.CropB) ? l.CropB : 0, 0, 0.9 - l.CropT);
            if (l.Type == "inputs") { l.CropL = l.CropT = l.CropR = l.CropB = 0; l.FlipX = l.FlipY = false; }
            l.File = Path.GetFileName(l.File ?? ""); // only ever a file inside the Studio folder
            l.Device ??= "";
            l.Shape = l.Shape is "rect" or "circle" ? l.Shape : "rounded";
            l.Fit = l.Fit == "fit" ? "fit" : "fill";
            l.Style = l.Style == "cat" ? "cat" : "keys";
            l.Input = InputOverlayRenderer.Kind(l);
            l.Design = InputOverlayRenderer.Design(l);
            l.Accent = StudioSetup.Hex(l.Accent);
            l.Presets ??= new List<string>();
            l.ExtraKeys ??= new List<int>();
            l.ExtraKeys.RemoveAll(k => k is < 1 or > 254);
        }
        return this;
    }
}

/// <summary>
/// Every Studio scene. Stored in %AppData%\Snappy\studio.json, imported pictures live in %AppData%\Snappy\studio.
/// A scene without layers leaves recording exactly as it is without Studio.
/// </summary>
public sealed class StudioSetup
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private const int MaxScenes = 30;

    public List<StudioScene> Scenes { get; set; } = new();

    /// <summary>Used when no linked game is running, and always when automatic switching is off.</summary>
    public string DefaultSceneId { get; set; } = "";

    [JsonIgnore] public static string FilePath => Path.Combine(AppPaths.DataDir, "studio.json");

    [JsonIgnore]
    public static string MediaDir
    {
        get
        {
            string dir = Path.Combine(AppPaths.DataDir, "studio");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    [JsonIgnore] public StudioScene? DefaultScene => Scenes.FirstOrDefault(s => s.Id == DefaultSceneId) ?? Scenes.FirstOrDefault();

    [JsonIgnore] public bool HasLayers => Scenes.Any(s => s.Layers.Count > 0);

    public StudioScene? SceneForApp(string processName) =>
        Scenes.FirstOrDefault(s => s.Apps.Any(a => string.Equals(a.Exe, processName, StringComparison.OrdinalIgnoreCase)));

    public static StudioSetup Load()
    {
        try
        {
            if (System.IO.File.Exists(FilePath))
                return FromJson(System.IO.File.ReadAllText(FilePath));
        }
        catch (Exception ex)
        {
            Log.Error("studio.json is unreadable, starting with an empty Studio", ex);
            try { System.IO.File.Copy(FilePath, FilePath + ".broken", overwrite: true); } catch { }
        }
        return new StudioSetup().Sanitize();
    }

    public void Save()
    {
        string tmp = FilePath + ".tmp";
        System.IO.File.WriteAllText(tmp, JsonSerializer.Serialize(this, Json));
        System.IO.File.Move(tmp, FilePath, overwrite: true);
    }

    public static StudioSetup FromJson(string json) =>
        (JsonSerializer.Deserialize<StudioSetup>(json, Json) ?? new StudioSetup()).Sanitize();

    public StudioSetup Sanitize()
    {
        Scenes ??= new List<StudioScene>();
        Scenes.RemoveAll(s => s == null);
        if (Scenes.Count > MaxScenes) Scenes.RemoveRange(MaxScenes, Scenes.Count - MaxScenes);
        if (Scenes.Count == 0) Scenes.Add(new StudioScene { Name = "Main" });

        var sceneIds = new HashSet<string>();
        var claimedApps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var scene in Scenes)
        {
            scene.Sanitize();
            while (!sceneIds.Add(scene.Id)) scene.Id = NewId();
            scene.Apps.RemoveAll(a => !claimedApps.Add(a.Exe)); // a game can only belong to one scene
        }
        if (Scenes.All(s => s.Id != DefaultSceneId)) DefaultSceneId = Scenes[0].Id;
        return this;
    }

    /// <summary>Copies a picture into the Studio folder so scenes keep working if the original is moved.</summary>
    public static (string File, int Width, int Height) ImportMedia(string source)
    {
        string name = NewId() + NewId() + Path.GetExtension(source).ToLowerInvariant();
        string dest = Path.Combine(MediaDir, name);
        System.IO.File.Copy(source, dest);
        try
        {
            using var img = Image.FromFile(dest);
            return (name, img.Width, img.Height);
        }
        catch
        {
            System.IO.File.Delete(dest);
            throw new InvalidOperationException("That file isn't a picture Snappy can read");
        }
    }

    /// <summary>Removes imported pictures that no layer in any scene uses anymore.</summary>
    public void CleanMedia()
    {
        var used = Scenes.SelectMany(s => s.Layers).Select(l => l.File).Where(f => f.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var file in new DirectoryInfo(MediaDir).EnumerateFiles())
        {
            if (used.Contains(file.Name)) continue;
            try { file.Delete(); } catch { }
        }
    }

    public static string NewId() => Guid.NewGuid().ToString("N")[..8];

    internal static string Hex(string? color) =>
        color != null && color.Length == 7 && color[0] == '#' && color[1..].All(Uri.IsHexDigit) ? color.ToLowerInvariant() : "#f4f4f4";

    internal static string CleanId(string? id)
    {
        string clean = new((id ?? "").Where(char.IsLetterOrDigit).Take(16).ToArray());
        return clean.Length == 0 ? NewId() : clean;
    }
}
