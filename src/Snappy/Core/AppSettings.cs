using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Forms;

namespace Snappy.Core;

/// <summary>
/// All user settings. Stored in %AppData%\Snappy\settings.json and changed only through the settings window.
/// Snappy never rewrites your devices, volumes or hotkeys behind your back.
/// </summary>
public sealed class AppSettings
{
    public const int CurrentVersion = 2;
    public const int MinClipSeconds = 5;
    public const int MaxClipSeconds = 30 * 60;

    /// <summary>0 when read from a file written before versioning existed.</summary>
    public int SettingsVersion { get; set; }

    // Replay buffer
    public int BufferSeconds { get; set; } = 300;
    public int ShortClipSeconds { get; set; } = 30;
    public string ClipsFolder { get; set; } = AppPaths.DefaultClipsDir;

    // Video
    public string MonitorDeviceName { get; set; } = ""; // e.g. \\.\DISPLAY1; empty = primary monitor
    public int Fps { get; set; } = 60;
    public int OutputHeight { get; set; } = 0;          // 0 = native resolution
    public string Encoder { get; set; } = "auto";       // auto | h264_nvenc | hevc_nvenc | av1_nvenc | h264_amf | hevc_amf | libx264
    public int BitrateMbps { get; set; } = 20;
    public bool CaptureCursor { get; set; } = true;

    // Audio
    public bool DesktopAudioEnabled { get; set; } = true;
    public string DesktopAudioDeviceId { get; set; } = ""; // empty = follow Windows default output
    public int DesktopVolumePercent { get; set; } = 100;
    public bool MicEnabled { get; set; } = false;
    public string MicDeviceId { get; set; } = "";          // empty = follow Windows default mic
    public int MicVolumePercent { get; set; } = 100;
    public bool SeparateAudioTracks { get; set; } = true;  // track 1 = mix, 2 = desktop, 3 = mic
    public bool SplitAudioByProgram { get; set; }          // one track per program that made sound, instead of one desktop track

    // Hotkeys
    public HotkeySetting SaveClipHotkey { get; set; } = new() { Key = Keys.F10, Alt = true };
    public HotkeySetting SaveShortClipHotkey { get; set; } = new() { Key = Keys.F9, Alt = true };
    public HotkeySetting ScreenshotHotkey { get; set; } = new() { Key = Keys.F1, Alt = true };
    public HotkeySetting MarkMomentHotkey { get; set; } = new() { Key = Keys.None };
    public HotkeySetting StudioSnapHotkey { get; set; } = new() { Key = Keys.F2, Alt = true };

    // Screenshots and storage
    public string ScreenshotsFolder { get; set; } = AppPaths.DefaultScreenshotsDir;
    public bool StorageLimitEnabled { get; set; }
    public int StorageLimitGb { get; set; } = 100;

    // Updates
    public bool CheckForUpdates { get; set; } = true;

    // Studio
    public bool StudioEnabled { get; set; } = true;    // the quick switch: off records raw clips and keeps every scene
    public bool StudioAutoSwitch { get; set; } = true; // use the scene linked to the game in front

    // Behaviour
    public bool PlaySoundOnSave { get; set; } = true;
    public string TrimMode { get; set; } = "fast"; // fast (lossless, keyframe) | precise (re-encode)
    public bool ShowNotificationOnSave { get; set; } = true;
    public bool StartWithWindows { get; set; } = true;

    [JsonIgnore]
    public static string FilePath => Path.Combine(AppPaths.DataDir, "settings.json");

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() },
    };

    public static AppSettings Load() => Load(out _);

    /// <param name="migrated">True when an older settings file was upgraded and should be saved back.</param>
    public static AppSettings Load(out bool migrated)
    {
        migrated = false;
        try
        {
            if (File.Exists(FilePath))
            {
                var loaded = JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(FilePath), JsonOptions);
                if (loaded != null)
                {
                    if (loaded.SettingsVersion < 2)
                    {
                        // v2: "Start with Windows" became the default so Snappy is always ready to clip.
                        loaded.StartWithWindows = true;
                        migrated = true;
                    }
                    loaded.SettingsVersion = CurrentVersion;
                    loaded.Sanitize();
                    return loaded;
                }
            }
        }
        catch (Exception ex)
        {
            Log.Error("settings.json is unreadable; keeping a backup and using defaults", ex);
            try { File.Copy(FilePath, FilePath + ".broken", overwrite: true); } catch { }
        }
        return new AppSettings { SettingsVersion = CurrentVersion };
    }

    public void Save()
    {
        Sanitize();
        string tmp = FilePath + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(this, JsonOptions));
        File.Move(tmp, FilePath, overwrite: true); // atomic replace: a crash can't leave half a file
    }

    public AppSettings Clone() =>
        JsonSerializer.Deserialize<AppSettings>(JsonSerializer.Serialize(this, JsonOptions), JsonOptions)!;

    public void Sanitize()
    {
        BufferSeconds = Math.Clamp(BufferSeconds, MinClipSeconds, MaxClipSeconds);
        ShortClipSeconds = Math.Clamp(ShortClipSeconds, MinClipSeconds, BufferSeconds);
        Fps = Math.Clamp(Fps, 10, 240);
        BitrateMbps = Math.Clamp(BitrateMbps, 2, 150);
        DesktopVolumePercent = Math.Clamp(DesktopVolumePercent, 0, 400);
        MicVolumePercent = Math.Clamp(MicVolumePercent, 0, 400);
        if (string.IsNullOrWhiteSpace(ClipsFolder)) ClipsFolder = AppPaths.DefaultClipsDir;
        SaveClipHotkey ??= new HotkeySetting { Key = Keys.F10, Alt = true };
        SaveShortClipHotkey ??= new HotkeySetting { Key = Keys.None };
        MonitorDeviceName ??= "";
        DesktopAudioDeviceId ??= "";
        MicDeviceId ??= "";
        Encoder ??= "auto";
        TrimMode = TrimMode == "precise" ? "precise" : "fast";
        ScreenshotHotkey ??= new HotkeySetting { Key = Keys.None };
        MarkMomentHotkey ??= new HotkeySetting { Key = Keys.None };
        StudioSnapHotkey ??= new HotkeySetting { Key = Keys.None };
        if (string.IsNullOrWhiteSpace(ScreenshotsFolder)) ScreenshotsFolder = AppPaths.DefaultScreenshotsDir;
        StorageLimitGb = Math.Clamp(StorageLimitGb, 5, 100_000);
    }

    /// <summary>Settings that require restarting the capture pipeline when they change.</summary>
    public string VideoPipelineKey() =>
        $"{MonitorDeviceName}|{Fps}|{OutputHeight}|{Encoder}|{BitrateMbps}|{CaptureCursor}|{BufferSeconds}";

    public string AudioPipelineKey() =>
        $"{DesktopAudioEnabled}|{DesktopAudioDeviceId}|{MicEnabled}|{MicDeviceId}|{BufferSeconds}";

    /// <summary>Kept apart from the audio key so turning the split on or off never empties the replay buffer.</summary>
    public string ProgramAudioKey() =>
        $"{SeparateAudioTracks && SplitAudioByProgram}|{DesktopAudioDeviceId}|{BufferSeconds}";
}

public sealed class HotkeySetting
{
    public Keys Key { get; set; } = Keys.None;
    public bool Ctrl { get; set; }
    public bool Alt { get; set; }
    public bool Shift { get; set; }
    public bool Win { get; set; }

    [JsonIgnore] public bool IsSet => Key != Keys.None;

    public override string ToString()
    {
        if (!IsSet) return "None";
        var parts = new List<string>();
        if (Ctrl) parts.Add("Ctrl");
        if (Alt) parts.Add("Alt");
        if (Shift) parts.Add("Shift");
        if (Win) parts.Add("Win");
        parts.Add(Key.ToString());
        return string.Join(" + ", parts);
    }
}
