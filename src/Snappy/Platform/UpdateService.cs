using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.Platform;

public sealed record UpdateStatus(string State, string Current, string? Available, double Progress, string? Error, bool CanInstall, string PageUrl);

/// <summary>
/// Asks GitHub for a new version every few hours, downloads it in the background and installs it when the PC has been
/// idle for a while, so a replay you might still want is never thrown away in the middle of a game.
/// </summary>
public sealed class UpdateService : IDisposable
{
    private static readonly TimeSpan CheckEvery = TimeSpan.FromHours(6);
    private static readonly TimeSpan IdleBeforeInstall = TimeSpan.FromMinutes(10);

    private readonly Func<AppSettings> _settings;
    private readonly Func<bool> _busy;
    private readonly Action _exitForInstall;
    private readonly System.Threading.Timer _timer;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTime _lastCheck = DateTime.MinValue;
    private UpdateInfo? _available;
    private string? _staged;
    private string _state = "idle"; // idle | checking | latest | downloading | ready | error
    private double _progress;
    private string? _error;

    public event Action? Changed;

    /// <param name="busy">True while installing now would interrupt something, like a clip being saved.</param>
    /// <param name="exitForInstall">Closes Snappy so the downloaded copy can replace the files.</param>
    public UpdateService(Func<AppSettings> settings, Func<bool> busy, Action exitForInstall)
    {
        _settings = settings;
        _busy = busy;
        _exitForInstall = exitForInstall;
        _timer = new System.Threading.Timer(_ => _ = TickAsync(), null, TimeSpan.FromSeconds(45), TimeSpan.FromMinutes(10));
    }

    public UpdateStatus Status => new(_state, Updater.Current.ToString(), _available?.Version, _progress, _error,
        Updater.CanSelfUpdate, _available?.PageUrl ?? Updater.RepoUrl + "/releases");

    private async Task TickAsync()
    {
        try
        {
            if (_staged != null)
            {
                if (IdleTime() >= IdleBeforeInstall && !_busy()) Install();
                return;
            }
            if (_settings().CheckForUpdates && DateTime.UtcNow - _lastCheck >= CheckEvery) await CheckAsync(download: true);
        }
        catch (Exception ex)
        {
            Log.Warn($"Update check failed: {ex.Message}");
        }
    }

    /// <summary>Checks now. With <paramref name="download"/>, a new version is also downloaded when this copy can update itself.</summary>
    public async Task CheckAsync(bool download)
    {
        if (!await _gate.WaitAsync(0)) return; // already running
        try
        {
            if (_staged != null) return;
            Set("checking");
            _lastCheck = DateTime.UtcNow;
            _available = await Updater.CheckAsync();
            if (_available == null)
            {
                Set("latest");
                return;
            }
            Log.Info($"Snappy {_available.Version} is available");
            if (!download || !Updater.CanSelfUpdate)
            {
                Set("available");
                return;
            }
            _progress = 0;
            Set("downloading");
            var progress = new Progress<double>(p =>
            {
                if (p - _progress < 0.02 && p < 1) return;
                _progress = p;
                Changed?.Invoke();
            });
            _staged = await Updater.DownloadAsync(_available, progress, CancellationToken.None);
            Set("ready");
        }
        catch (Exception ex)
        {
            _error = ex is HttpRequestException ? "GitHub couldn't be reached" : ex.Message;
            Log.Warn($"Update failed: {ex.Message}");
            Set("error");
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Restarts into the downloaded version. Only does something once an update is ready.</summary>
    public void Install()
    {
        if (_staged == null) return;
        Log.Info($"Installing Snappy {_available?.Version}");
        Updater.StartInstall(_staged);
        _exitForInstall();
    }

    private void Set(string state)
    {
        _state = state;
        if (state != "error") _error = null;
        Changed?.Invoke();
    }

    private static TimeSpan IdleTime()
    {
        var info = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
        if (!GetLastInputInfo(ref info)) return TimeSpan.Zero;
        return TimeSpan.FromMilliseconds(unchecked((uint)Environment.TickCount - info.dwTime));
    }

    public void Dispose() => _timer.Dispose();

    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }

    [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
}
