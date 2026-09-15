using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Snappy.Core;
using Snappy.Studio;

namespace Snappy.Video;

public enum VideoEngineState { Stopped, Starting, Recording, Restarting, Failed }

/// <summary>Per-FFmpeg-run facts needed to turn buffered frames back into a playable clip.</summary>
public sealed class CaptureSession
{
    public required int Id { get; init; }
    public required string CodecKey { get; init; } // frames from different codecs/resolutions can't share one file
    public byte[]? PatPacket;
    public byte[]? PmtPacket;
    public long FrameDurationHns;

    // hostTime = pts + offset. Offset = minimum observed (arrival - pts): both clocks are QPC, so this converges
    // to the real delay between capture and pipe within a second and never drifts.
    private long _offsetHns = long.MaxValue;
    public long OffsetHns => Interlocked.Read(ref _offsetHns);

    public void Observe(long arrivalHns, long ptsHns)
    {
        long candidate = arrivalHns - ptsHns;
        long current;
        while (candidate < (current = Interlocked.Read(ref _offsetHns)))
            if (Interlocked.CompareExchange(ref _offsetHns, candidate, current) == current) break;
    }

    public long HostTimeHns(long pts90k) => OffsetHns + Pts90kToHns(pts90k);

    public static long Pts90kToHns(long pts90k) => pts90k * 1000 / 9;
}

/// <summary>
/// Runs FFmpeg for the replay: ddagrab captures on the GPU, the hardware encoder compresses, and MPEG-TS comes back over a pipe into the RAM ring.
/// If FFmpeg exits, stalls or the display setup changes, it is restarted automatically and the buffer survives.
/// </summary>
public sealed class VideoEngine : IDisposable
{
    private readonly AppSettings _settings;
    private readonly long _bufferHns;
    private readonly Dictionary<int, CaptureSession> _sessions = new();
    private readonly object _sessionsGate = new();
    private readonly Thread _supervisor;
    private readonly ManualResetEventSlim _wake = new(false);
    private volatile bool _stop;
    private volatile bool _restartRequested;
    private Process? _proc;
    private long _lastDataHns;
    private int _sessionCounter;
    private readonly Queue<string> _stderrTail = new();
    private volatile StudioScene? _studio;
    private bool _runUsedStudio;
    private int _studioFailures;

    public RingArena Ring { get; }
    /// <summary>Set when FFmpeg kept failing with the Studio layers. Capture then carries on without them.</summary>
    public string? StudioError { get; private set; }
    public volatile VideoEngineState State = VideoEngineState.Stopped;
    public string? LastError { get; private set; }
    public string EncoderName { get; private set; } = "";
    public DisplayInfo? Display { get; private set; }

    public event Action? StateChanged;

    public VideoEngine(AppSettings settings, string encoder, StudioScene? studio = null)
    {
        _settings = settings;
        _studio = studio;
        EncoderName = encoder;
        _bufferHns = Clock.SecondsToHns(settings.BufferSeconds + 3); // + slack so a clip can start on a keyframe
        // Size for the rate-control ceiling (maxrate = 1.25x) plus TS overhead, so the buffer is never short.
        long bytes = (long)(settings.BitrateMbps * 1.25 * 1_000_000 / 8 * (settings.BufferSeconds + 5) * 1.05) + (16 << 20);
        // Never let a huge replay setting starve the PC: at most half of physical RAM.
        long ramLimit = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 2;
        if (ramLimit > 0 && bytes > ramLimit)
        {
            Log.Warn($"Replay buffer of {bytes >> 20} MB exceeds half the RAM; capping at {ramLimit >> 20} MB");
            bytes = ramLimit;
        }
        Ring = new RingArena(bytes);
        _supervisor = new Thread(Supervise) { IsBackground = true, Name = "video-supervisor" };
    }

    public void Start() => _supervisor.Start();

    public void RequestRestart(string reason)
    {
        Log.Info($"Video restart requested: {reason}");
        _restartRequested = true;
        KillProcess();
        _wake.Set();
    }

    /// <summary>Restarts FFmpeg with new Studio layers. The replay buffer is kept.</summary>
    public void SetStudio(StudioScene? scene)
    {
        _studio = scene;
        StudioError = null;
        _studioFailures = 0;
        RequestRestart("Studio layers changed");
    }

    public CaptureSession? GetSession(int id)
    {
        lock (_sessionsGate) return _sessions.GetValueOrDefault(id);
    }

    public void Dispose()
    {
        _stop = true;
        _wake.Set();
        KillProcess();
        if (_supervisor.IsAlive) _supervisor.Join(3000);
        SetState(VideoEngineState.Stopped);
    }

    private void SetState(VideoEngineState s)
    {
        if (State == s) return;
        State = s;
        try { StateChanged?.Invoke(); } catch (Exception ex) { Log.Error("StateChanged handler", ex); }
    }

    private void Supervise()
    {
        int backoffMs = 1000;
        while (!_stop)
        {
            _restartRequested = false;
            long started = Clock.NowHns();
            try
            {
                RunOnce();
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                Log.Error("Video capture run failed", ex);
            }
            if (_stop) break;

            bool healthy = Clock.NowHns() - started > Clock.SecondsToHns(30);
            if (healthy || _restartRequested) backoffMs = 1000;
            if (_runUsedStudio && !healthy && !_restartRequested && ++_studioFailures >= 2)
            {
                StudioError = LastError ?? "FFmpeg could not start with the layers";
                Log.Warn($"Recording without Studio layers from now on: {StudioError}");
            }
            else if (healthy)
            {
                _studioFailures = 0;
            }
            SetState(_restartRequested ? VideoEngineState.Restarting : VideoEngineState.Failed);
            _wake.Reset();
            _wake.Wait(_restartRequested ? 300 : backoffMs);
            backoffMs = Math.Min(backoffMs * 2, 10_000);
        }
    }

    private void RunOnce()
    {
        SetState(VideoEngineState.Starting);
        Display = Displays.Resolve(_settings.MonitorDeviceName)
                  ?? throw new InvalidOperationException("No monitor found to capture");

        int sessionId = Interlocked.Increment(ref _sessionCounter);
        CaptureSession? current = null;
        StudioPipeline? studio = null;
        if (_studio is { IsActive: true } scene && StudioError == null)
        {
            var (outW, outH) = FfmpegArgs.OutputSize(_settings, Display);
            // Layer frames are timed against the first captured frame, which is only known once output arrives.
            studio = StudioPipeline.TryCreate(scene, outW, outH, _settings.Fps, sessionId,
                () => current?.OffsetHns ?? long.MaxValue, out string? studioError);
            if (studioError != null) StudioError = studioError;
        }
        using var studioScope = studio;
        _runUsedStudio = studio != null;

        var session = new CaptureSession
        {
            Id = sessionId,
            // Blended frames reach the encoder in a different pixel format, so they never share a file with plain ones.
            CodecKey = $"{EncoderName}|{Display.Width}x{Display.Height}|{_settings.OutputHeight}|{_settings.Fps}{(studio != null ? "|layers" : "")}",
            FrameDurationHns = Clock.HnsPerSecond / _settings.Fps,
        };
        current = session;
        lock (_sessionsGate) _sessions[session.Id] = session;

        var psi = new ProcessStartInfo(AppPaths.FfmpegExe, FfmpegArgs.BuildCapture(_settings, Display, EncoderName, studio))
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
        };
        Log.Info($"Starting capture session {session.Id}: {Display.Label} on {Display.AdapterName}, {EncoderName}, {_settings.Fps} fps, {_settings.BitrateMbps} Mbps");
        Log.Info($"ffmpeg {psi.Arguments}");

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("Could not start ffmpeg");
        _proc = proc;
        ChildProcessJob.Attach(proc);
        try { proc.PriorityClass = ProcessPriorityClass.AboveNormal; } catch { }

        lock (_stderrTail) _stderrTail.Clear();
        proc.ErrorDataReceived += (_, e) =>
        {
            if (string.IsNullOrWhiteSpace(e.Data)) return;
            lock (_stderrTail)
            {
                _stderrTail.Enqueue(e.Data);
                while (_stderrTail.Count > 30) _stderrTail.Dequeue();
            }
        };
        proc.BeginErrorReadLine();

        var demux = new TsDemuxer((packets, pts90k, key, arrival) =>
        {
            session.Observe(arrival, CaptureSession.Pts90kToHns(pts90k));
            long host = session.HostTimeHns(pts90k);
            Ring.Append(packets, host, session.FrameDurationHns, key ? RingArena.FlagKeyframe : 0, session.Id, pts90k);
        });

        Interlocked.Exchange(ref _lastDataHns, Clock.NowHns());
        using var watchdog = new System.Threading.Timer(_ => Watchdog(proc), null, 1000, 1000);

        var stdout = proc.StandardOutput.BaseStream;
        var buf = new byte[1 << 16];
        long nextEvict = 0;
        int n;
        while ((n = stdout.Read(buf, 0, buf.Length)) > 0)
        {
            long now = Clock.NowHns();
            Interlocked.Exchange(ref _lastDataHns, now);
            demux.Feed(buf.AsSpan(0, n), now);
            session.PatPacket ??= demux.PatPacket;
            session.PmtPacket ??= demux.PmtPacket;
            if (State != VideoEngineState.Recording && Ring.Count > 0) SetState(VideoEngineState.Recording);
            if (now > nextEvict)
            {
                Ring.EvictOlderThan(now - _bufferHns);
                PruneSessions();
                nextEvict = now + Clock.HnsPerSecond;
            }
        }

        proc.WaitForExit(2000);
        _proc = null;
        string tail;
        lock (_stderrTail) tail = string.Join(" | ", _stderrTail);
        if (!_stop && !_restartRequested)
        {
            LastError = tail.Length > 0 ? tail : $"ffmpeg exited with code {(proc.HasExited ? proc.ExitCode : -1)}";
            Log.Warn($"Capture session {session.Id} ended: {LastError}");
        }
    }

    private void Watchdog(Process proc)
    {
        long silentFor = Clock.NowHns() - Interlocked.Read(ref _lastDataHns);
        if (silentFor > Clock.SecondsToHns(6) && !proc.HasExited)
        {
            Log.Warn("Capture stalled (no frames for 6s), restarting ffmpeg");
            try { proc.Kill(true); } catch { }
        }
    }

    private void PruneSessions()
    {
        // Session ids only grow, so everything older than the oldest buffered frame's session is gone.
        int oldest = Ring.OldestSession ?? _sessionCounter;
        lock (_sessionsGate)
            foreach (int id in _sessions.Keys.Where(id => id < oldest && id != _sessionCounter).ToList())
                _sessions.Remove(id);
    }

    private void KillProcess()
    {
        var p = _proc;
        if (p == null) return;
        try { if (!p.HasExited) p.Kill(true); } catch { }
    }
}

/// <summary>Kernel job object: if Snappy dies for any reason, Windows kills its FFmpeg child immediately.</summary>
internal static class ChildProcessJob
{
    private static readonly Lazy<IntPtr> Job = new(CreateJob);

    public static void Attach(Process p)
    {
        try { AssignProcessToJobObject(Job.Value, p.Handle); } catch { }
    }

    private static IntPtr CreateJob()
    {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        int len = Marshal.SizeOf(info);
        IntPtr ptr = Marshal.AllocHGlobal(len);
        Marshal.StructureToPtr(info, ptr, false);
        SetInformationJobObject(job, 9 /* JobObjectExtendedLimitInformation */, ptr, (uint)len);
        Marshal.FreeHGlobal(ptr);
        return job;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS { public ulong a, b, c, d, e, f; }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateJobObject(IntPtr a, string? name);
    [DllImport("kernel32.dll")] private static extern bool SetInformationJobObject(IntPtr job, int cls, IntPtr info, uint len);
    [DllImport("kernel32.dll")] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
}
