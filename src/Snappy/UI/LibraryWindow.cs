using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Snappy.Audio;
using Snappy.Clips;
using Snappy.Core;
using Snappy.Library;
using Snappy.Input;
using Snappy.Platform;
using Snappy.Studio;
using Snappy.Video;

namespace Snappy.UI;

/// <summary>
/// The library window: a WebView2 page (wwwroot) talking to C# over a tiny JSON-RPC bridge.
/// Created on demand and fully disposed on close, so the Edge engine only uses memory while you're looking at it.
/// Locked down: only Snappy's own local pages load, every navigation elsewhere and every popup is blocked.
/// </summary>
public sealed class LibraryWindow : Form
{
    private const string AppHost = "app.snappy";
    private const string CacheHost = "cache.snappy";
    private const string MediaHost = "media.snappy";
    private const string LiveHost = "live.snappy";

    // The page may only ask to open these in the default browser.
    private static readonly string[] AllowedLinks =
    {
        "https://github.com/slashneck/Snappy", "https://ffmpeg.org/", "https://www.gyan.dev/ffmpeg/",
        "https://developer.microsoft.com/microsoft-edge/webview2", "https://github.com/dotnet/runtime", "https://opensource.org/license/",
        "https://www.gnu.org/licenses/",
    };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly Recorder _recorder;
    private readonly UpdateService _updates;
    private readonly Action<AppSettings> _applySettings;
    private readonly WebView2 _web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(10, 10, 10) };
    private readonly LibraryService _library;
    private readonly System.Windows.Forms.Timer _statusTimer = new() { Interval = 1000 };
    private readonly CancellationTokenSource _closing = new();
    private readonly System.Windows.Forms.Timer _inputTimer = new() { Interval = 33 };
    private StudioPreview? _studioPreview;
    private HotkeyListener? _snapHotkey;
    private string _lastInputState = "";
    private bool _ready;

    public LibraryWindow(Recorder recorder, Action<AppSettings> applySettings, Icon? icon, UpdateService updates)
    {
        _recorder = recorder;
        _updates = updates;
        _applySettings = applySettings;
        _library = new LibraryService(recorder.Settings.ClipsFolder);

        Text = "Snappy";
        if (icon != null) Icon = icon;
        BackColor = Color.FromArgb(10, 10, 10);
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(960, 640);
        Size = new Size(1360, 860);
        Controls.Add(_web);

        _library.Changed += () => PostEvent("libraryChanged", null);
        _recorder.ClipStarted += OnClipStarted;
        _recorder.ClipSaved += OnClipSaved;
        _recorder.ScreenshotSaved += OnScreenshotSaved;
        _recorder.MomentMarked += OnMomentMarked;
        _updates.Changed += OnUpdateChanged;
        _statusTimer.Tick += (_, _) => PostEvent("status", _recorder.GetStatus());
        _inputTimer.Tick += (_, _) => PushInputState();
        Load += async (_, _) => await InitAsync();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int on = 1;
        DwmSetWindowAttribute(Handle, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, ref on, sizeof(int));
        int caption = 0x000A0A0A; // COLORREF (BGR) of the app background
        DwmSetWindowAttribute(Handle, 35 /* DWMWA_CAPTION_COLOR */, ref caption, sizeof(int));
    }

    private async Task InitAsync()
    {
        try
        {
            string args = "--disable-background-networking --disable-component-update --disable-domain-reliability " +
                          "--disable-sync --no-pings --autoplay-policy=no-user-gesture-required " +
                          "--disable-features=msSmartScreenProtection,Translate,SpareRendererForSitePerProcess";
#if DEBUG
            // Development only: lets automated UI tests drive the page. Never compiled into Release builds.
            if (Environment.GetEnvironmentVariable("SNAPPY_CDP_PORT") is { Length: > 0 } cdpPort)
                args += $" --remote-debugging-address=127.0.0.1 --remote-debugging-port={cdpPort}";
#endif
            var options = new CoreWebView2EnvironmentOptions(args);
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(AppPaths.LocalDataDir, "webview"), options);
            await _web.EnsureCoreWebView2Async(env);
            var core = _web.CoreWebView2;

            var s = core.Settings;
            s.AreDefaultContextMenusEnabled = false;
            s.AreBrowserAcceleratorKeysEnabled = false;
            s.IsZoomControlEnabled = false;
            s.IsStatusBarEnabled = false;
            s.IsPasswordAutosaveEnabled = false;
            s.IsGeneralAutofillEnabled = false;
            s.IsSwipeNavigationEnabled = false;
            s.IsReputationCheckingRequired = false;
#if DEBUG
            s.AreDevToolsEnabled = true;
#else
            s.AreDevToolsEnabled = false;
#endif

            core.SetVirtualHostNameToFolderMapping(AppHost, AppPaths.WebRoot, CoreWebView2HostResourceAccessKind.DenyCors);
            MapLibraryHosts();
            core.SetVirtualHostNameToFolderMapping(MediaHost, StudioSetup.MediaDir, CoreWebView2HostResourceAccessKind.Allow);
            core.AddWebResourceRequestedFilter($"https://{LiveHost}/*", CoreWebView2WebResourceContext.Image);
            core.WebResourceRequested += OnLiveResource;
            _ = Task.Run(ClipMedia.PruneCache);

            core.NavigationStarting += (_, e) =>
            {
                if (!e.Uri.StartsWith($"https://{AppHost}/", StringComparison.OrdinalIgnoreCase)) e.Cancel = true;
            };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.ContainsFullScreenElementChanged += (_, _) => SetFullscreen(core.ContainsFullScreenElement);
            core.WebMessageReceived += OnWebMessage;
            core.Navigate($"https://{AppHost}/index.html");
            _ready = true;
            _statusTimer.Start();
        }
        catch (Exception ex)
        {
            Log.Error("Library window failed to start", ex);
            MessageBox.Show(this, $"The library window couldn't start:\n{ex.Message}\n\nThe recorder keeps running in the tray.",
                "Snappy", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            Close();
        }
    }

    private void MapLibraryHosts()
    {
        var core = _web.CoreWebView2;
        core.ClearVirtualHostNameToFolderMapping(LibraryService.VideoHost);
        core.ClearVirtualHostNameToFolderMapping(LibraryService.ThumbHost);
        core.ClearVirtualHostNameToFolderMapping(CacheHost);
        core.SetVirtualHostNameToFolderMapping(LibraryService.VideoHost, _library.Root, CoreWebView2HostResourceAccessKind.Allow);
        core.SetVirtualHostNameToFolderMapping(LibraryService.ThumbHost, _library.Thumbnails.Directory, CoreWebView2HostResourceAccessKind.Allow);
        core.SetVirtualHostNameToFolderMapping(CacheHost, ClipMedia.CacheDir, CoreWebView2HostResourceAccessKind.Allow);
    }

    private void OnScreenshotSaved(string path) =>
        PostEvent("screenshotSaved", new { name = Path.GetFileName(path), folder = Path.GetFileName(Path.GetDirectoryName(path)) });

    private void OnMomentMarked() => PostEvent("momentMarked", null);

    private void OnUpdateChanged() => PostEvent("updateChanged", _updates.Status);

    private void OnClipStarted(string app) => PostEvent("clipSaving", new { app });

    private void OnClipSaved(Clips.ClipResult r) => PostEvent("clipSaved", new
    {
        r.Success,
        r.Error,
        r.AppName,
        r.DurationSeconds,
        id = r.FilePath != null && r.FilePath.StartsWith(_library.Root, StringComparison.OrdinalIgnoreCase) ? _library.RelativeId(r.FilePath) : null,
    });

    private void PostEvent(string name, object? data)
    {
        if (!_ready || IsDisposed) return;
        string payload = JsonSerializer.Serialize(new { @event = name, data }, Json);
        try
        {
            if (InvokeRequired) BeginInvoke(() => { if (!IsDisposed) _web.CoreWebView2?.PostWebMessageAsJson(payload); });
            else _web.CoreWebView2?.PostWebMessageAsJson(payload);
        }
        catch (ObjectDisposedException) { }
        catch (InvalidOperationException) { }
    }

    private async void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        JsonNode? msg;
        try { msg = JsonNode.Parse(e.WebMessageAsJson); }
        catch { return; }
        var id = msg?["id"]?.GetValue<int>() ?? 0;
        string method = msg?["method"]?.GetValue<string>() ?? "";
        var p = msg?["params"] as JsonObject ?? new JsonObject();

        object? result = null;
        string? error = null;
        try
        {
            result = await Dispatch(method, p);
        }
        catch (Exception ex)
        {
            error = ex.Message;
            Log.Warn($"UI call {method} failed: {ex.Message}");
        }
        if (IsDisposed) return;
        _web.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new { id, result, error }, Json));
    }

    private async Task<object?> Dispatch(string method, JsonObject p)
    {
        string Str(string key) => p[key]?.GetValue<string>() ?? "";
        double Num(string key) => p[key]?.GetValue<double>() ?? 0;
        bool Bool(string key) => p[key]?.GetValue<bool>() ?? false;

        switch (method)
        {
            case "app.init":
                return new
                {
                    library = await Task.Run(_library.Scan),
                    settings = _recorder.Settings,
                    status = _recorder.GetStatus(),
                    version = Application.ProductVersion.Split('+')[0],
                    update = _updates.Status,
                };
            case "library.scan":
                return await Task.Run(_library.Scan);

            case "clip.move":
                return _library.MoveClip(Str("id"), Str("folder"));
            case "clip.moveMany":
                return p["ids"]!.AsArray().Select(n => _library.MoveClip(n!.GetValue<string>(), Str("folder"))).ToList();
            case "clip.rename":
                return _library.RenameClip(Str("id"), Str("title"));
            case "clip.delete":
                await Task.Run(() => _library.DeleteClips(p["ids"]!.AsArray().Select(n => n!.GetValue<string>()).ToList()));
                return true;
            case "clip.copy":
                ShellOps.CopyFileToClipboard(_library.ResolvePath(Str("id")));
                return true;
            case "clip.reveal":
                ShellOps.ShowInExplorer(_library.ResolvePath(Str("id")));
                return true;
            case "clip.trim":
            {
                string clipId = Str("id");
                string path = _library.ResolvePath(clipId);
                var progress = new Progress<double>(v => PostEvent("trimProgress", new { id = clipId, progress = v }));
                string output = await ClipTrimmer.TrimAsync(path, Num("start"), Num("end"),
                    Str("mode") == "precise" ? TrimMode.Precise : TrimMode.Fast, Bool("replace"),
                    _recorder.Encoder, progress, _closing.Token);
                return _library.RelativeId(output);
            }

            case "clip.info":
                return await ClipMedia.ProbeAsync(_library.ResolvePath(Str("id")));
            case "clip.waveform":
            {
                string path = _library.ResolvePath(Str("id"));
                var info = await ClipMedia.ProbeAsync(path);
                return await ClipMedia.WaveformAsync(path, (int)Num("track"), info.Duration);
            }
            case "clip.previewAudio":
                return $"https://{CacheHost}/{await ClipMedia.PreviewAudioAsync(_library.ResolvePath(Str("id")), (int)Num("track"))}";
            case "clip.export":
                return await ExportClipAsync(Str("id"), p["spec"]);
            case "clip.favorite":
                _library.SetFavorite(Str("id"), Bool("favorite"));
                return true;
            case "clip.screenshot":
            {
                string path = _library.ResolvePath(Str("id"));
                string dir = Path.GetDirectoryName(path)!;
                string sub = string.Equals(dir, _library.Root, StringComparison.OrdinalIgnoreCase) ? "" : Path.GetFileName(dir);
                return await Screenshots.CaptureFrameAsync(path, Num("time"), _recorder.Settings.ScreenshotsFolder, sub);
            }
            case "clip.shrink":
            {
                var spec = p["spec"].Deserialize<EditSpec>(Json) ?? throw new InvalidOperationException("Invalid edit");
                string clipId = Str("id");
                string path = _library.ResolvePath(clipId);
                var progress = new Progress<double>(v => PostEvent("exportProgress", new { id = clipId, progress = v }));
                string output = await Task.Run(() => ShrinkExporter.ExportAsync(path, spec, Num("targetMb"), _recorder.Encoder, progress, _closing.Token));
                ShellOps.CopyFileToClipboard(output);
                return _library.RelativeId(output);
            }
            case "clips.montage":
            {
                var paths = p["ids"]!.AsArray().Select(n => _library.ResolvePath(n!.GetValue<string>())).ToList();
                var progress = new Progress<double>(v => PostEvent("exportProgress", new { id = "montage", progress = v }));
                string output = await Task.Run(() => MontageBuilder.BuildAsync(paths, Bool("crossfade"), Path.Combine(_library.Root, "Montages"),
                    _recorder.Encoder, progress, _closing.Token));
                return _library.RelativeId(output);
            }
            case "screenshots.open":
                Directory.CreateDirectory(_recorder.Settings.ScreenshotsFolder);
                ShellOps.ShowInExplorer(_recorder.Settings.ScreenshotsFolder);
                return true;
            case "storage.usage":
                return await Task.Run(() => StorageLimiter.FolderSize(_library.Root));
            case "app.openLink":
            {
                string url = Str("url");
                if (!AllowedLinks.Any(prefix => url.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException("That link isn't allowed");
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                return true;
            }

            case "studio.get":
            {
                var display = _recorder.Video?.Display ?? Displays.Resolve(_recorder.Settings.MonitorDeviceName);
                var (width, height) = display == null ? (1920, 1080) : FfmpegArgs.OutputSize(_recorder.Settings, display);
                return new
                {
                    setup = _recorder.Studio,
                    liveSceneId = _recorder.LiveScene?.Id,
                    width,
                    height,
                    display = display?.Label ?? "",
                    error = _recorder.Video?.StudioError,
                    presets = InputPresets.BuiltIn.Select(pr => new { id = pr.Id, name = pr.Name, keys = pr.Keys.Select(k => (int)k) }),
                };
            }
            case "studio.open":
                _studioPreview ??= new StudioPreview();
                // Keeps this window out of the snapshot, so Studio never photographs itself.
                SetWindowDisplayAffinity(Handle, WDA_EXCLUDEFROMCAPTURE);
                StartSnapHotkey();
                _lastInputState = "";
                _inputTimer.Start();
                return new { hotkey = _recorder.Settings.StudioSnapHotkey.ToString(), hasSnapshot = _studioPreview.Snapshot != null };
            case "studio.snap":
                return TakeStudioSnapshot();
            case "studio.close":
                CloseStudioPreview();
                return true;
            case "studio.preview":
                _studioPreview?.Update(StudioScene.FromJson(JsonParam(p, "scene")));
                return true;
            case "studio.apply":
                _recorder.ApplyStudio(StudioSetup.FromJson(JsonParam(p, "setup")));
                return new { liveSceneId = _recorder.LiveScene?.Id };
            case "studio.apps":
                return await Task.Run(() => ForegroundApp.RunningApps().Select(a => new { exe = a.Exe, name = a.Name }).ToList());
            case "studio.pickApp":
            {
                using var dlg = new OpenFileDialog { Title = "Pick a game or program", Filter = "Programs|*.exe" };
                if (dlg.ShowDialog(this) != DialogResult.OK) return null;
                return new { exe = Path.GetFileNameWithoutExtension(dlg.FileName), name = ForegroundApp.NameForExe(dlg.FileName) };
            }
            case "studio.overlayAspect":
            {
                var layer = System.Text.Json.JsonSerializer.Deserialize<StudioLayer>(JsonParam(p, "layer"), Json) ?? new StudioLayer();
                return InputOverlayRenderer.AspectFor(layer);
            }
            case "studio.cameras":
                return await WebcamDevices.ListAsync();
            case "studio.cameraStatus":
                return WebcamHub.Get(Str("device"))?.LastError;
            case "studio.pickMedia":
            {
                using var dlg = new OpenFileDialog { Title = "Add an image or GIF", Filter = "Images and GIFs|*.png;*.jpg;*.jpeg;*.bmp;*.gif" };
                if (dlg.ShowDialog(this) != DialogResult.OK) return null;
                string source = dlg.FileName;
                var (file, width, height) = await Task.Run(() => StudioSetup.ImportMedia(source));
                return new
                {
                    file,
                    width,
                    height,
                    type = file.EndsWith(".gif", StringComparison.OrdinalIgnoreCase) ? "gif" : "image",
                    name = Path.GetFileNameWithoutExtension(source),
                };
            }

            case "update.check":
                await _updates.CheckAsync(download: true);
                return _updates.Status;
            case "update.install":
                _updates.Install();
                return true;

            case "folder.create":
                return _library.CreateFolder(Str("name"));
            case "folder.rename":
                return _library.RenameFolder(Str("oldName"), Str("newName"));
            case "folder.delete":
                await Task.Run(() => _library.DeleteFolder(Str("name")));
                return true;
            case "folder.reveal":
                ShellOps.ShowInExplorer(Str("name").Length == 0 ? _library.Root : _library.ResolvePath(Str("name")));
                return true;

            case "recorder.save":
            {
                int seconds = p["seconds"] is null ? _recorder.Settings.BufferSeconds : (int)Num("seconds");
                return await _recorder.SaveClipAsync(seconds);
            }
            case "recorder.pause":
                _recorder.SetPaused(Bool("paused"));
                return _recorder.GetStatus();

            case "settings.options":
                return new
                {
                    displays = Displays.Enumerate(),
                    microphones = AudioSource.ListDevices(capture: true),
                    outputs = AudioSource.ListDevices(capture: false),
                    encoders = new[] { "h264_nvenc", "hevc_nvenc", "av1_nvenc", "h264_amf", "hevc_amf", "h264_qsv", "hevc_qsv", "libx264" }
                        .Select(enc => new { id = enc, available = FfmpegArgs.Probe(enc) }).ToList(),
                    autostart = Autostart.IsEnabled(),
                    programAudio = ProcessLoopback.Supported,
                    totalMemoryBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes,
                    minClipSeconds = AppSettings.MinClipSeconds,
                    maxClipSeconds = AppSettings.MaxClipSeconds,
                };
            case "settings.advice":
                return await Task.Run(() => PerformanceAdvisor.For(_recorder.Settings, _recorder.Encoder, _recorder.LiveScene));
            case "audio.levels":
                return new
                {
                    // After the volume sliders, so the bars show what ends up in the clip.
                    desktop = _recorder.DesktopAudio is { State: AudioSourceState.Active } d
                        ? Math.Min(1f, d.RecentPeak() * _recorder.Settings.DesktopVolumePercent / 100f) : -1,
                    mic = _recorder.MicAudio is { State: AudioSourceState.Active } m
                        ? Math.Min(1f, m.RecentPeak() * _recorder.Settings.MicVolumePercent / 100f) : -1,
                };
            case "settings.save":
            {
                var updated = p["settings"].Deserialize<AppSettings>(Json) ?? throw new InvalidOperationException("Invalid settings");
                updated.Sanitize();
                bool rootChanged = !string.Equals(Path.GetFullPath(updated.ClipsFolder), _library.Root, StringComparison.OrdinalIgnoreCase);
                _applySettings(updated);
                if (rootChanged)
                {
                    _library.SetRoot(updated.ClipsFolder);
                    MapLibraryHosts();
                }
                return _recorder.Settings;
            }
            case "settings.pickFolder":
            {
                using var dlg = new FolderBrowserDialog { InitialDirectory = _recorder.Settings.ClipsFolder, UseDescriptionForTitle = true, Description = "Where should Snappy save clips?" };
                return dlg.ShowDialog(this) == DialogResult.OK ? dlg.SelectedPath : null;
            }
            case "app.openLog":
                ShellOps.ShowInExplorer(Log.FilePath);
                return true;
            default:
                throw new InvalidOperationException($"Unknown method {method}");
        }
    }

    private async Task<string> ExportClipAsync(string id, JsonNode? specNode)
    {
        var spec = specNode.Deserialize<EditSpec>(Json) ?? throw new InvalidOperationException("Invalid edit");
        string path = _library.ResolvePath(id);
        var progress = new Progress<double>(v => PostEvent("exportProgress", new { id, progress = v }));
        string output = await Task.Run(() => EditExporter.ExportAsync(path, spec, _recorder.Encoder, progress, _closing.Token));
        return _library.RelativeId(output);
    }

    private bool _fullscreen;
    private FormWindowState _restoreState;
    private Rectangle _restoreBounds;

    /// <summary>Player fullscreen covers the whole monitor (including the taskbar), not just the window.</summary>
    private void SetFullscreen(bool on)
    {
        if (on == _fullscreen) return;
        _fullscreen = on;
        if (on)
        {
            _restoreState = WindowState;
            if (WindowState != FormWindowState.Normal) WindowState = FormWindowState.Normal;
            _restoreBounds = Bounds;
            FormBorderStyle = FormBorderStyle.None;
            Bounds = Screen.FromControl(this).Bounds;
        }
        else
        {
            FormBorderStyle = FormBorderStyle.Sizable;
            Bounds = _restoreBounds;
            WindowState = _restoreState;
        }
    }

    private bool _asleep;

    /// <summary>
    /// A minimized window has nothing to show. The page already stops drawing on its own then, and Snappy stops
    /// feeding it status and input updates until it comes back, so nothing runs for it while you play.
    /// </summary>
    protected override void OnSizeChanged(EventArgs e)
    {
        base.OnSizeChanged(e);
        if (!_ready) return;
        bool minimized = WindowState == FormWindowState.Minimized;
        if (minimized == _asleep) return;
        _asleep = minimized;
        if (minimized)
        {
            _statusTimer.Stop();
            _inputTimer.Stop();
        }
        else
        {
            _statusTimer.Start();
            if (_studioPreview != null) _inputTimer.Start();
            PostEvent("status", _recorder.GetStatus());
        }
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        _closing.Cancel();
        _statusTimer.Stop();
        CloseStudioPreview();
        _recorder.ClipStarted -= OnClipStarted;
        _recorder.ClipSaved -= OnClipSaved;
        _recorder.ScreenshotSaved -= OnScreenshotSaved;
        _recorder.MomentMarked -= OnMomentMarked;
        _updates.Changed -= OnUpdateChanged;
        _library.Dispose();
        _web.Dispose();
        base.OnFormClosed(e);
    }

    private static int Int(string? value) => int.TryParse(value, out int n) ? n : 0;

    private static string JsonParam(JsonObject p, string key) =>
        p[key]?.ToJsonString() ?? throw new InvalidOperationException($"Missing {key}");

    /// <summary>The snap hotkey only exists while Studio is open, so it can't get in the way during a game.</summary>
    private void StartSnapHotkey()
    {
        _snapHotkey?.Dispose();
        _snapHotkey = null;
        var hotkey = _recorder.Settings.StudioSnapHotkey;
        if (!hotkey.IsSet) return;
        _snapHotkey = new HotkeyListener();
        _snapHotkey.SetHotkeys(hotkey);
        _snapHotkey.Pressed += _ =>
        {
            try
            {
                if (!IsDisposed) BeginInvoke(() => TakeStudioSnapshot());
            }
            catch (ObjectDisposedException) { }
            catch (InvalidOperationException) { }
        };
    }

    private bool TakeStudioSnapshot()
    {
        var display = _recorder.Video?.Display ?? Displays.Resolve(_recorder.Settings.MonitorDeviceName);
        bool taken = _studioPreview?.TakeSnapshot(display) ?? false;
        if (taken) PostEvent("studioSnapshot", null);
        return taken;
    }

    private void CloseStudioPreview()
    {
        _inputTimer.Stop();
        _snapHotkey?.Dispose();
        _snapHotkey = null;
        if (_studioPreview == null) return;
        _studioPreview.Dispose();
        _studioPreview = null;
        StudioPreview.ForgetLater(TimeSpan.FromMinutes(10));
        if (IsHandleCreated) SetWindowDisplayAffinity(Handle, 0);
        try { _recorder.Studio.CleanMedia(); }
        catch (Exception ex) { Log.Warn($"Studio media cleanup failed: {ex.Message}"); }
    }

    /// <summary>Serves the live monitor picture and camera frames to the Studio page.</summary>
    private void OnLiveResource(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var uri = new Uri(e.Request.Uri);
        byte[]? bytes = null;
        if (_studioPreview != null)
        {
            if (uri.AbsolutePath == "/screen.jpg")
                bytes = _studioPreview.Snapshot;
            else if (uri.AbsolutePath == "/camera.jpg" && System.Web.HttpUtility.ParseQueryString(uri.Query)["device"] is { } device)
                bytes = StudioPreview.CameraJpeg(device);
            else if (uri.AbsolutePath == "/overlay.png")
            {
                var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
                if (query["layer"] is { } layerId)
                    bytes = _studioPreview.OverlayPng(layerId, Int(query["w"]), Int(query["h"]));
            }
        }
        var env = _web.CoreWebView2.Environment;
        string type = uri.AbsolutePath.EndsWith(".png", StringComparison.Ordinal) ? "image/png" : "image/jpeg";
        e.Response = bytes == null
            ? env.CreateWebResourceResponse(null, 404, "Not Found", "Cache-Control: no-store")
            : env.CreateWebResourceResponse(new MemoryStream(bytes), 200, "OK", $"Content-Type: {type}\r\nCache-Control: no-store");
    }

    private void PushInputState()
    {
        var st = _studioPreview?.LiveInput();
        if (st == null) return;
        string key = $"{string.Join(',', st.Keys.Order())}|{string.Join(',', st.Buttons.Order())}|{st.Wheel}|{st.Vx}|{st.Vy}";
        if (key == _lastInputState) return;
        _lastInputState = key;
        PostEvent("inputState", new { keys = st.Keys.Order(), buttons = st.Buttons.Order(), wheel = st.Wheel, vx = st.Vx, vy = st.Vy });
    }

    private const uint WDA_EXCLUDEFROMCAPTURE = 0x11;

    [DllImport("user32.dll")]
    private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
}
