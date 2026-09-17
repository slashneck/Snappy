using Microsoft.Win32;
using Snappy.Audio;
using Snappy.Clips;
using Snappy.Core;
using Snappy.Library;
using Snappy.Platform;
using Snappy.Studio;
using Snappy.Video;

namespace Snappy;

public sealed record RecorderStatus(string State, string Text, double BufferedSeconds, int BufferSeconds, double MemoryMb,
    string Encoder, bool Saving, string DesktopDevice, string MicDevice, List<string> Warnings, string LiveSceneId);

/// <summary>Owns the always-on pipeline (video, audio, hotkeys) and saves clips.</summary>
public sealed class Recorder : IDisposable
{
    private readonly SemaphoreSlim _saveLock = new(1, 1);
    private readonly HotkeyListener _hotkeys = new();
    private readonly object _gate = new();
    private VideoEngine? _video;
    private AudioSource? _desktop;
    private AudioSource? _mic;
    private ProgramAudio? _programs;
    private string _videoKey = "", _audioKey = "", _studioKey = "", _programKey = "";
    private readonly List<long> _markers = new();
    private readonly SceneTracker _sceneTracker = new();
    private StudioSetup _studio = StudioSetup.Load();
    private StudioScene? _liveScene;
    private System.Threading.Timer? _sceneTimer;

    public AppSettings Settings { get; private set; }
    public bool Paused { get; private set; }
    public string Encoder { get; private set; } = "";
    public int SavesInProgress;

    public event Action<ClipResult>? ClipSaved;
    public event Action<string>? ClipStarted; // app name
    public event Action? StatusChanged;
    public event Action<string>? ScreenshotSaved; // file path
    public event Action? MomentMarked;

    public Recorder(AppSettings settings)
    {
        Settings = settings;
        _hotkeys.Pressed += index =>
        {
            switch (index)
            {
                case 0: _ = SaveClipAsync(Settings.BufferSeconds); break;
                case 1: _ = SaveClipAsync(Settings.ShortClipSeconds); break;
                case 2: TakeScreenshot(); break;
                case 3: MarkMoment(); break;
            }
        };
        SystemEvents.DisplaySettingsChanged += OnDisplaySettingsChanged;
        SystemEvents.PowerModeChanged += OnPowerModeChanged;
    }

    public VideoEngine? Video => _video;
    public AudioSource? DesktopAudio => _desktop;
    public AudioSource? MicAudio => _mic;
    public StudioSetup Studio => _studio;
    /// <summary>The scene whose layers go into clips right now, or null while Studio is switched off.</summary>
    public StudioScene? LiveScene => _liveScene;

    public void Start()
    {
        _hotkeys.SetHotkeys(Settings.SaveClipHotkey, Settings.SaveShortClipHotkey, Settings.ScreenshotHotkey, Settings.MarkMomentHotkey);
        Encoder = FfmpegArgs.ResolveEncoder(Settings.Encoder, Displays.Resolve(Settings.MonitorDeviceName));
        Log.Info($"Using encoder {Encoder}");
        _liveScene = PickScene();
        StartVideo();
        StartAudio();
        _sceneTimer = new System.Threading.Timer(_ => UpdateLiveScene(), null, 1500, 1500);
    }

    public void ApplySettings(AppSettings updated)
    {
        lock (_gate)
        {
            Settings = updated;
            _hotkeys.SetHotkeys(updated.SaveClipHotkey, updated.SaveShortClipHotkey, updated.ScreenshotHotkey, updated.MarkMomentHotkey);
            if (Paused) return;
            if (updated.VideoPipelineKey() != _videoKey)
            {
                Encoder = FfmpegArgs.ResolveEncoder(updated.Encoder, Displays.Resolve(updated.MonitorDeviceName));
                StopVideo();
                StartVideo();
            }
            if (updated.AudioPipelineKey() != _audioKey)
            {
                StopAudio();
                StartAudio();
            }
            else if (updated.ProgramAudioKey() != _programKey)
            {
                StopPrograms();
                StartPrograms();
            }
        }
        UpdateLiveScene();
        StatusChanged?.Invoke();
    }

    /// <summary>Saves the Studio setup. If the layers that go into clips change, FFmpeg restarts with them and the replay buffer is kept.</summary>
    public void ApplyStudio(StudioSetup setup)
    {
        lock (_gate)
        {
            _studio = setup;
            setup.Save();
        }
        UpdateLiveScene();
        StatusChanged?.Invoke();
    }

    private StudioScene? PickScene()
    {
        if (!Settings.StudioEnabled) return null;
        var gameScene = Settings.StudioAutoSwitch ? _sceneTracker.Update(_studio) : null;
        return gameScene ?? _studio.DefaultScene;
    }

    /// <summary>Follows the quick switch and the game in front. FFmpeg only restarts when the layers really change.</summary>
    private void UpdateLiveScene()
    {
        try
        {
            string? switchedTo = null;
            lock (_gate)
            {
                var scene = PickScene();
                if (scene?.Id != _liveScene?.Id) switchedTo = scene?.Name ?? "";
                _liveScene = scene;
                string key = scene?.PipelineKey() ?? "";
                if (key != _studioKey)
                {
                    _studioKey = key;
                    if (!Paused) _video?.SetStudio(scene);
                }
            }
            if (switchedTo != null)
            {
                Log.Info(switchedTo.Length > 0 ? $"Studio scene: {switchedTo}" : "Studio layers off");
                StatusChanged?.Invoke();
            }
        }
        catch (Exception ex)
        {
            Log.Error("Switching Studio scenes failed", ex);
        }
    }

    public void SetPaused(bool paused)
    {
        lock (_gate)
        {
            if (paused == Paused) return;
            Paused = paused;
            if (paused) { StopVideo(); StopAudio(); }
            else { StartVideo(); StartAudio(); }
        }
        Log.Info(paused ? "Recording paused by user" : "Recording resumed");
        StatusChanged?.Invoke();
    }

    public async Task<ClipResult> SaveClipAsync(int seconds)
    {
        // Grab the app name right away. By the time the save finishes you might have alt-tabbed.
        string app = ForegroundApp.DetectFolderName();
        var video = _video;
        if (Paused || video == null)
        {
            var paused = new ClipResult(false, null, 0, app, "Recording is paused");
            ClipSaved?.Invoke(paused);
            return paused;
        }

        Interlocked.Increment(ref SavesInProgress);
        ClipStarted?.Invoke(app);
        await _saveLock.WaitAsync();
        try
        {
            long[] markers;
            lock (_markers) markers = _markers.ToArray();
            var programs = _programs?.Sources();
            var result = await Task.Run(() => ClipWriter.SaveAsync(video, _desktop, _mic, programs, Settings, seconds, app, markers));
            ClipSaved?.Invoke(result);
            if (result.Success && Settings.StorageLimitEnabled)
            {
                long limit = Settings.StorageLimitGb * 1024L * 1024 * 1024;
                string root = Settings.ClipsFolder;
                _ = Task.Run(() => StorageLimiter.Enforce(root, limit));
            }
            return result;
        }
        finally
        {
            _saveLock.Release();
            Interlocked.Decrement(ref SavesInProgress);
            StatusChanged?.Invoke();
        }
    }

    public string? TakeScreenshot()
    {
        try
        {
            var display = _video?.Display ?? Displays.Resolve(Settings.MonitorDeviceName);
            if (display == null) return null;
            string path = Screenshots.CaptureScreen(display, Settings.ScreenshotsFolder, ForegroundApp.DetectFolderName());
            ScreenshotSaved?.Invoke(path);
            return path;
        }
        catch (Exception ex)
        {
            Log.Error("Screenshot failed", ex);
            return null;
        }
    }

    /// <summary>Remembers this moment. Clips saved later that contain it show a marker on the timeline.</summary>
    public void MarkMoment()
    {
        long now = Clock.NowHns();
        lock (_markers)
        {
            _markers.Add(now);
            long oldest = now - Clock.SecondsToHns(Settings.BufferSeconds + 30);
            _markers.RemoveAll(m => m < oldest);
        }
        Log.Info("Moment marked");
        MomentMarked?.Invoke();
    }

    public string StatusText() => GetStatus().Text;

    public RecorderStatus GetStatus()
    {
        var v = _video;
        bool saving = SavesInProgress > 0;
        string desktopName = _desktop?.State == AudioSourceState.Active ? _desktop.DeviceName : "";
        string micName = _mic?.State == AudioSourceState.Active ? _mic.DeviceName : "";
        var warnings = new List<string>();
        if (_mic is { State: AudioSourceState.DeviceMissing or AudioSourceState.Error }) warnings.Add($"Mic: {_mic.LastError}");
        if (_desktop is { State: AudioSourceState.DeviceMissing or AudioSourceState.Error }) warnings.Add($"Desktop audio: {_desktop.LastError}");
        if (v?.StudioError is { } studioError) warnings.Add($"Studio layers are off: {studioError}");

        if (Paused || v == null)
            return new RecorderStatus("paused", "Paused", 0, Settings.BufferSeconds, 0, Encoder, saving, desktopName, micName, warnings, _liveScene?.Id ?? "");

        double buffered = Math.Min(Clock.HnsToSeconds(v.Ring.SpanHns()), Settings.BufferSeconds);
        double memMb = (v.Ring.UsedBytes + (_desktop?.Ring.UsedBytes ?? 0) + (_mic?.Ring.UsedBytes ?? 0)
            + (_programs?.UsedBytes ?? 0)) / (1024.0 * 1024);

        var (state, text) = v.State switch
        {
            VideoEngineState.Recording => ("recording", $"Recording · {buffered:F0}s buffered · {memMb:F0} MB"),
            VideoEngineState.Starting or VideoEngineState.Restarting => ("starting", "Starting capture…"),
            VideoEngineState.Failed => ("problem", "Recording didn't start, trying again"),
            _ => ("starting", v.State.ToString()),
        };
        if (state == "problem") warnings.Insert(0, "Recording didn't start. Snappy keeps trying other ways to record. The details are in the log file (Settings, About).");
        if (v.FallbackNote != null) warnings.Add(v.FallbackNote);
        return new RecorderStatus(state, text, buffered, Settings.BufferSeconds, memMb, v.EncoderName, saving, desktopName, micName, warnings, _liveScene?.Id ?? "");
    }

    private void StartVideo()
    {
        _videoKey = Settings.VideoPipelineKey();
        _studioKey = _liveScene?.PipelineKey() ?? "";
        _video = new VideoEngine(Settings, Encoder, _liveScene);
        _video.StateChanged += () => StatusChanged?.Invoke();
        _video.Start();
    }

    private void StopVideo()
    {
        _video?.Dispose();
        _video = null;
    }

    private void StartAudio()
    {
        _audioKey = Settings.AudioPipelineKey();
        if (Settings.DesktopAudioEnabled)
        {
            _desktop = new AudioSource("desktop", loopback: true, Settings.DesktopAudioDeviceId, Settings.BufferSeconds);
            _desktop.Start();
        }
        if (Settings.MicEnabled)
        {
            _mic = new AudioSource("mic", loopback: false, Settings.MicDeviceId, Settings.BufferSeconds);
            _mic.Start();
        }
        StartPrograms();
    }

    private void StopAudio()
    {
        _desktop?.Dispose();
        _mic?.Dispose();
        _desktop = null;
        _mic = null;
        StopPrograms();
    }

    private void StartPrograms()
    {
        _programKey = Settings.ProgramAudioKey();
        if (!Settings.SeparateAudioTracks || !Settings.SplitAudioByProgram || !ProcessLoopback.Supported) return;
        _programs = new ProgramAudio(Settings.DesktopAudioDeviceId, Settings.BufferSeconds);
        _programs.Start();
    }

    private void StopPrograms()
    {
        _programs?.Dispose();
        _programs = null;
    }

    private void OnDisplaySettingsChanged(object? sender, EventArgs e) =>
        _video?.RequestRestart("display configuration changed");

    private void OnPowerModeChanged(object? sender, PowerModeChangedEventArgs e)
    {
        if (e.Mode == PowerModes.Resume) _video?.RequestRestart("resumed from sleep");
    }

    public void Dispose()
    {
        SystemEvents.DisplaySettingsChanged -= OnDisplaySettingsChanged;
        SystemEvents.PowerModeChanged -= OnPowerModeChanged;
        _sceneTimer?.Dispose();
        _hotkeys.Dispose();
        StopVideo();
        StopAudio();
    }
}
