using System.Diagnostics;
using System.Media;
using Snappy.Audio;
using Snappy.Clips;
using Snappy.Core;
using Snappy.Platform;
using Snappy.Video;

namespace Snappy.UI;

/// <summary>
/// Tray front-end: the mascot icon shows the recorder's state, the menu has the essentials, and clips get a
/// "snap" sound plus a small Snappy pop-up in the corner of the screen.
/// </summary>
public sealed class TrayApp : ApplicationContext
{
    private readonly NotifyIcon _tray;
    private readonly Recorder _recorder;
    private readonly SynchronizationContext _ui;
    private readonly System.Windows.Forms.Timer _statusTimer;
    private readonly EventWaitHandle _showSignal;
    private readonly RegisteredWaitHandle _showWait;
    private LibraryWindow? _libraryWindow;
    private MascotOverlay? _overlay;
    private bool _overlayForCurrentClip;
    private UpdateService? _updates;

    public TrayApp(bool background)
    {
        _ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        var settings = AppSettings.Load(out bool migrated);
        if (!File.Exists(AppSettings.FilePath) || migrated) settings.Save();
        // Keeps the startup entry pointing at this exe, e.g. after Snappy was moved or updated.
        if (settings.StartWithWindows && !Autostart.IsEnabled()) Autostart.Apply(true);
#if DEBUG
        // Development only: point the library at a test folder without touching the real clips folder.
        if (Environment.GetEnvironmentVariable("SNAPPY_CLIPS_DIR") is { Length: > 0 } testClips) settings.ClipsFolder = testClips;
#endif

        _tray = new NotifyIcon { Icon = AppAssets.TrayIcon("idle"), Text = "Snappy is starting", Visible = true };
        ToolStripManager.Renderer = new DarkMenuRenderer();
        _tray.ContextMenuStrip = new ContextMenuStrip { Font = new Font("Segoe UI", 9.5f) };
        _tray.ContextMenuStrip.Opening += (_, _) => BuildMenu();
        _tray.DoubleClick += (_, _) => ShowLibrary();
        BuildMenu();

        _recorder = new Recorder(settings);
        _recorder.ClipStarted += app => Post(() => OnClipStarted(app));
        _recorder.ClipSaved += result => Post(() => OnClipSaved(result));
        _recorder.ScreenshotSaved += path => Post(() => OnScreenshotSaved(path));
        _recorder.MomentMarked += () => Post(OnMomentMarked);
        _recorder.Start();
        _updates = new UpdateService(() => _recorder.Settings, () => _recorder.SavesInProgress > 0, () => Post(ExitThread));

        _statusTimer = new System.Windows.Forms.Timer { Interval = 2000 };
        _statusTimer.Tick += (_, _) => RefreshStatus();
        _statusTimer.Start();

        _showSignal = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\Snappy-Show" + AppPaths.InstanceSuffix);
        _showWait = ThreadPool.RegisterWaitForSingleObject(_showSignal, (_, _) => Post(ShowLibrary), null, -1, false);

        // Started by hand, the library opens. Started with Windows (--background), Snappy stays in the tray.
        if (!background) Post(ShowLibrary);
    }

    private void ShowLibrary()
    {
        if (_libraryWindow == null || _libraryWindow.IsDisposed)
        {
            _libraryWindow = new LibraryWindow(_recorder, ApplySettings, AppAssets.AppIcon(), _updates!);
            _libraryWindow.FormClosed += (_, _) =>
            {
                _libraryWindow = null;
                // Hand the Edge engine's memory back right away; the recorder keeps running.
                GC.Collect();
                GC.WaitForPendingFinalizers();
            };
            _libraryWindow.Show();
        }
        else
        {
            if (_libraryWindow.WindowState == FormWindowState.Minimized) _libraryWindow.WindowState = FormWindowState.Normal;
            _libraryWindow.Activate();
        }
    }

    private void Post(Action a) => _ui.Post(_ => a(), null);

    private void RefreshStatus()
    {
        string text = "Snappy · " + _recorder.StatusText();
        _tray.Text = text.Length > 63 ? text[..63] : text;
        if (_recorder.SavesInProgress > 0) return;
        string state = _recorder.Paused ? "paused"
            : _recorder.Video?.State == VideoEngineState.Recording ? "recording"
            : "idle";
        _tray.Icon = AppAssets.TrayIcon(state);
    }

    /// <summary>The pop-up is for when you're in a game; inside Snappy's own window the in-app mascot reacts instead.</summary>
    private bool OverlayWanted() =>
        _recorder.Settings.ShowNotificationOnSave && (_libraryWindow == null || Form.ActiveForm != _libraryWindow);

    private MascotOverlay Overlay => _overlay ??= new MascotOverlay();

    private void OnClipStarted(string app)
    {
        _tray.Icon = AppAssets.TrayIcon("saving");
        _overlayForCurrentClip = OverlayWanted();
        if (!_overlayForCurrentClip) return;
        try { Overlay.ShowSaving(app); }
        catch (Exception ex) { Log.Error("Overlay failed", ex); }
    }

    private void OnClipSaved(ClipResult r)
    {
        RefreshStatus();
        var s = _recorder.Settings;
        bool overlay = _overlayForCurrentClip || OverlayWanted();
        _overlayForCurrentClip = false;

        if (r.Success)
        {
            if (s.PlaySoundOnSave) AppAssets.PlaySnap();
            if (overlay) TryOverlay(true, "Clip saved", $"{FormatSeconds((int)Math.Round(r.DurationSeconds))} · {r.AppName}");
        }
        else
        {
            SystemSounds.Hand.Play();
            if (overlay) TryOverlay(false, "Couldn't save clip", r.Error ?? "Unknown error");
            else if (_libraryWindow == null) _tray.ShowBalloonTip(5000, "Couldn't save clip", r.Error ?? "Unknown error", ToolTipIcon.Warning);
        }
    }

    private void OnScreenshotSaved(string path)
    {
        if (_recorder.Settings.PlaySoundOnSave) AppAssets.PlaySnap();
        if (OverlayWanted()) TryOverlay(true, "Screenshot saved", Path.GetFileName(Path.GetDirectoryName(path)) ?? "");
    }

    private void OnMomentMarked()
    {
        if (OverlayWanted()) TryOverlay(true, "Moment marked", "It shows on the timeline of your next clip");
    }

    private void TryOverlay(bool success, string title, string sub)
    {
        try { Overlay.ShowResult(success, title, sub); }
        catch (Exception ex)
        {
            Log.Error("Overlay failed", ex);
            _tray.ShowBalloonTip(3000, title, sub, success ? ToolTipIcon.None : ToolTipIcon.Warning);
        }
    }

    private void BuildMenu()
    {
        var s = _recorder?.Settings ?? AppSettings.Load();
        var menu = _tray.ContextMenuStrip!;
        menu.Items.Clear();

        menu.Items.Add(new ToolStripMenuItem("Open Snappy", null, (_, _) => ShowLibrary()) { Font = new Font(menu.Font, FontStyle.Bold) });
        menu.Items.Add(new ToolStripMenuItem(_recorder?.StatusText() ?? "Starting…") { Enabled = false });
        if (_updates?.Status is { State: "ready" } update)
            menu.Items.Add(new ToolStripMenuItem($"Restart to update to {update.Available}", null, (_, _) => _updates.Install()));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem($"Save last {FormatSeconds(s.BufferSeconds)}", null, (_, _) => _ = _recorder!.SaveClipAsync(s.BufferSeconds))
            { ShortcutKeyDisplayString = s.SaveClipHotkey.IsSet ? s.SaveClipHotkey.ToString() : "", ShowShortcutKeys = true });
        if (s.SaveShortClipHotkey.IsSet)
            menu.Items.Add(new ToolStripMenuItem($"Save last {FormatSeconds(s.ShortClipSeconds)}", null, (_, _) => _ = _recorder!.SaveClipAsync(s.ShortClipSeconds))
                { ShortcutKeyDisplayString = s.SaveShortClipHotkey.ToString(), ShowShortcutKeys = true });
        menu.Items.Add(new ToolStripMenuItem("Take screenshot", null, (_, _) => Task.Delay(250).ContinueWith(_ => _recorder!.TakeScreenshot()))
            { ShortcutKeyDisplayString = s.ScreenshotHotkey.IsSet ? s.ScreenshotHotkey.ToString() : "", ShowShortcutKeys = true });
        menu.Items.Add("Open clips folder", null, (_, _) => OpenFolder(s.ClipsFolder));
        menu.Items.Add("Open screenshots folder", null, (_, _) => OpenFolder(s.ScreenshotsFolder));
        menu.Items.Add(new ToolStripSeparator());

        var monitor = new ToolStripMenuItem("Monitor");
        foreach (var d in Displays.Enumerate())
        {
            bool selected = s.MonitorDeviceName == d.DeviceName || (s.MonitorDeviceName == "" && d.IsPrimary);
            monitor.DropDownItems.Add(new ToolStripMenuItem(d.Label, null, (_, _) => Change(x => x.MonitorDeviceName = d.DeviceName)) { Checked = selected });
        }
        menu.Items.Add(monitor);

        var mic = new ToolStripMenuItem("Microphone");
        mic.DropDownItems.Add(new ToolStripMenuItem("Off", null, (_, _) => Change(x => x.MicEnabled = false)) { Checked = !s.MicEnabled });
        mic.DropDownItems.Add(new ToolStripMenuItem("Windows default", null, (_, _) => Change(x => { x.MicEnabled = true; x.MicDeviceId = ""; }))
            { Checked = s.MicEnabled && s.MicDeviceId == "" });
        foreach (var dev in AudioSource.ListDevices(capture: true))
            mic.DropDownItems.Add(new ToolStripMenuItem(dev.Name, null, (_, _) => Change(x => { x.MicEnabled = true; x.MicDeviceId = dev.Id; }))
                { Checked = s.MicEnabled && s.MicDeviceId == dev.Id });
        menu.Items.Add(mic);

        var desktop = new ToolStripMenuItem("Desktop audio");
        desktop.DropDownItems.Add(new ToolStripMenuItem("Off", null, (_, _) => Change(x => x.DesktopAudioEnabled = false)) { Checked = !s.DesktopAudioEnabled });
        desktop.DropDownItems.Add(new ToolStripMenuItem("Windows default output", null, (_, _) => Change(x => { x.DesktopAudioEnabled = true; x.DesktopAudioDeviceId = ""; }))
            { Checked = s.DesktopAudioEnabled && s.DesktopAudioDeviceId == "" });
        foreach (var dev in AudioSource.ListDevices(capture: false))
            desktop.DropDownItems.Add(new ToolStripMenuItem(dev.Name, null, (_, _) => Change(x => { x.DesktopAudioEnabled = true; x.DesktopAudioDeviceId = dev.Id; }))
                { Checked = s.DesktopAudioEnabled && s.DesktopAudioDeviceId == dev.Id });
        menu.Items.Add(desktop);

        var length = new ToolStripMenuItem("Replay length");
        int[] presets = { 300, 600, 900, 1200 };
        foreach (int sec in presets)
            length.DropDownItems.Add(new ToolStripMenuItem(FormatSeconds(sec), null, (_, _) => Change(x => x.BufferSeconds = sec)) { Checked = s.BufferSeconds == sec });
        length.DropDownItems.Add(new ToolStripMenuItem(presets.Contains(s.BufferSeconds) ? "Custom…" : $"Custom ({FormatSeconds(s.BufferSeconds)})…",
            null, (_, _) => ShowLibrary()) { Checked = !presets.Contains(s.BufferSeconds) });
        menu.Items.Add(length);
        if (_recorder?.Studio.HasLayers == true)
            menu.Items.Add(new ToolStripMenuItem("Studio layers", null, (_, _) => Change(x => x.StudioEnabled = !x.StudioEnabled)) { Checked = s.StudioEnabled });

        menu.Items.Add(new ToolStripSeparator());
        bool autostart = Autostart.IsEnabled();
        menu.Items.Add(new ToolStripMenuItem("Start with Windows", null, (_, _) => Change(x => x.StartWithWindows = !autostart)) { Checked = autostart });
        menu.Items.Add(new ToolStripMenuItem(_recorder?.Paused == true ? "Resume recording" : "Pause recording", null,
            (_, _) => { _recorder!.SetPaused(!_recorder.Paused); RefreshStatus(); }));
        menu.Items.Add("Open log", null, (_, _) => Process.Start(new ProcessStartInfo(Log.FilePath) { UseShellExecute = true }));
        menu.Items.Add("Exit", null, (_, _) => ExitThread());
        DarkMenuRenderer.Style(menu);
    }

    private void Change(Action<AppSettings> mutate)
    {
        var updated = _recorder.Settings.Clone();
        mutate(updated);
        ApplySettings(updated);
    }

    private void ApplySettings(AppSettings updated)
    {
        updated.Save();
        Autostart.Apply(updated.StartWithWindows);
        _recorder.ApplySettings(updated);
        RefreshStatus();
    }

    private static void OpenFolder(string folder)
    {
        Directory.CreateDirectory(folder);
        Process.Start(new ProcessStartInfo(folder) { UseShellExecute = true });
    }

    public static string FormatSeconds(int seconds) =>
        seconds < 60 ? $"{seconds}s" : seconds % 60 == 0 ? $"{seconds / 60} min" : $"{seconds / 60}m {seconds % 60}s";

    protected override void ExitThreadCore()
    {
        _statusTimer.Stop();
        _showWait.Unregister(null);
        _tray.Visible = false;
        _tray.Dispose();
        _overlay?.Dispose();
        _updates?.Dispose();
        _recorder.Dispose();
        base.ExitThreadCore();
    }
}
