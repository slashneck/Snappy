using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.Audio;

/// <summary>
/// Captures what one program is playing, on its own, into a RAM ring - same format and same clock as every other
/// audio source, so a clip can cut it to the exact same range.
/// </summary>
public sealed class ProcessAudioSource : IAudioTrackSource, IDisposable
{
    private readonly long _bufferHns;
    private readonly Thread _thread;
    private volatile bool _stop;

    public int ProcessId { get; }
    public string Name { get; }
    public int Channels => 2;
    public int BlockAlign => 4;
    public RingArena Ring { get; }
    public volatile AudioSourceState State = AudioSourceState.Stopped;
    public string? LastError { get; private set; }

    /// <summary>When this program was last heard. The watcher lets go of programs that went quiet long ago.</summary>
    public long LastSoundHns;

    public ProcessAudioSource(int processId, string name, int bufferSeconds)
    {
        ProcessId = processId;
        Name = name;
        _bufferHns = Clock.SecondsToHns(bufferSeconds + 10);
        Ring = new RingArena((long)(bufferSeconds + 15) * AudioSource.SampleRate * 4);
        _thread = new Thread(Run) { IsBackground = true, Name = $"audio-{name}", Priority = ThreadPriority.AboveNormal };
        _thread.SetApartmentState(ApartmentState.MTA);
    }

    public void Start() => _thread.Start();

    public void Dispose()
    {
        _stop = true;
        if (_thread.IsAlive) _thread.Join(2000);
        State = AudioSourceState.Stopped;
    }

    private void Run()
    {
        State = AudioSourceState.Starting;
        try
        {
            Capture();
        }
        catch (Exception ex)
        {
            State = AudioSourceState.Error;
            LastError = ex.Message;
            Log.Warn($"[{Name}] program audio stopped: {ex.Message}");
        }
    }

    private void Capture()
    {
        IAudioClient? client = null;
        IAudioCaptureClient? capture = null;
        IntPtr fmtPtr = IntPtr.Zero, ready = IntPtr.Zero;
        try
        {
            client = ProcessLoopback.Open(ProcessId);

            var wfx = new WaveFormatEx
            {
                wFormatTag = 1, // PCM
                nChannels = 2,
                nSamplesPerSec = AudioSource.SampleRate,
                wBitsPerSample = 16,
                nBlockAlign = 4,
                nAvgBytesPerSec = AudioSource.SampleRate * 4,
                cbSize = 0,
            };
            fmtPtr = Marshal.AllocHGlobal(Marshal.SizeOf<WaveFormatEx>());
            Marshal.StructureToPtr(wfx, fmtPtr, false);

            // Process loopback only works event driven, and wants the buffer length passed with no periodicity.
            client.Initialize(0 /* shared */, Wasapi.AUDCLNT_STREAMFLAGS_LOOPBACK | ProcessLoopback.AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                2_000_000 /* 200 ms */, 0, fmtPtr, IntPtr.Zero);

            ready = ProcessLoopback.CreateEvent(IntPtr.Zero, false, false, null);
            client.SetEventHandle(ready);

            var capIid = Wasapi.IID_IAudioCaptureClient;
            client.GetService(ref capIid, out object capObj);
            capture = (IAudioCaptureClient)capObj;
            client.Start();

            State = AudioSourceState.Active;
            Log.Info($"[{Name}] recording this program on its own track");

            byte[] silence = new byte[AudioSource.SampleRate * 4];
            long nextHousekeeping = Clock.NowHns();
            while (!_stop)
            {
                ProcessLoopback.WaitForSingleObject(ready, 200);
                while (!_stop)
                {
                    int hr = capture.GetNextPacketSize(out uint packetFrames);
                    if (hr == Wasapi.AUDCLNT_E_DEVICE_INVALIDATED) return;
                    Marshal.ThrowExceptionForHR(hr);
                    if (packetFrames == 0) break;

                    hr = capture.GetBuffer(out IntPtr data, out uint frames, out uint bufFlags, out _, out ulong qpc);
                    if (hr == Wasapi.AUDCLNT_E_DEVICE_INVALIDATED) return;
                    Marshal.ThrowExceptionForHR(hr);
                    int bytes = (int)frames * 4;
                    long durHns = frames * Clock.HnsPerSecond / AudioSource.SampleRate;
                    long now = Clock.NowHns();
                    long stamp = (long)qpc;
                    // The virtual device does not always stamp its packets; fall back to the clock we are on anyway.
                    if (stamp <= 0 || Math.Abs(now - stamp) > Clock.HnsPerSecond * 5) stamp = now - durHns;
                    unsafe
                    {
                        if ((bufFlags & Wasapi.AUDCLNT_BUFFERFLAGS_SILENT) != 0 || data == IntPtr.Zero)
                        {
                            for (int off = 0; off < bytes; off += silence.Length)
                                Ring.Append(silence.AsSpan(0, Math.Min(silence.Length, bytes - off)), stamp, durHns, 0, 0);
                        }
                        else
                        {
                            Ring.Append(new ReadOnlySpan<byte>((void*)data, bytes), stamp, durHns, 0, 0);
                        }
                    }
                    capture.ReleaseBuffer(frames);
                }

                long tick = Clock.NowHns();
                if (tick >= nextHousekeeping)
                {
                    nextHousekeeping = tick + Clock.HnsPerSecond * 2;
                    Ring.EvictOlderThan(tick - _bufferHns);
                }
            }
        }
        finally
        {
            try { client?.Stop(); } catch { }
            if (fmtPtr != IntPtr.Zero) Marshal.FreeHGlobal(fmtPtr);
            if (ready != IntPtr.Zero) ProcessLoopback.CloseEvent(ready);
            if (capture != null) Marshal.ReleaseComObject(capture);
            if (client != null) Marshal.ReleaseComObject(client);
        }
    }
}

/// <summary>
/// Watches which programs are making sound and keeps one capture running per program, so a clip can carry
/// Discord, the game and the browser as separate tracks. Programs that stay quiet are never touched.
/// </summary>
public sealed class ProgramAudio : IDisposable
{
    /// <summary>Enough for a game, a call, music and a browser. Each one costs a ring buffer.</summary>
    public const int MaxPrograms = 4;

    private readonly string _deviceId;
    private readonly int _bufferSeconds;
    private readonly Thread _watcher;
    private readonly object _gate = new();
    private readonly Dictionary<int, ProcessAudioSource> _sources = new();
    private volatile bool _stop;
    private bool _warnedFull;

    public ProgramAudio(string deviceId, int bufferSeconds)
    {
        _deviceId = deviceId ?? "";
        _bufferSeconds = bufferSeconds;
        _watcher = new Thread(Watch) { IsBackground = true, Name = "audio-programs" };
        _watcher.SetApartmentState(ApartmentState.MTA);
    }

    public void Start() => _watcher.Start();

    public void Dispose()
    {
        _stop = true;
        if (_watcher.IsAlive) _watcher.Join(2000);
        lock (_gate)
        {
            foreach (var s in _sources.Values) s.Dispose();
            _sources.Clear();
        }
    }

    /// <summary>The programs currently being recorded, oldest first so track order stays steady between clips.</summary>
    public List<ProcessAudioSource> Sources()
    {
        lock (_gate) return _sources.Values.OrderBy(s => s.ProcessId).ToList();
    }

    public long UsedBytes
    {
        get { lock (_gate) return _sources.Values.Sum(s => s.Ring.UsedBytes); }
    }

    private void Watch()
    {
        while (!_stop)
        {
            try
            {
                Scan();
            }
            catch (Exception ex)
            {
                Log.Warn($"Looking for programs with sound failed: {ex.Message}");
            }
            for (int waited = 0; waited < 800 && !_stop; waited += 50) Thread.Sleep(50);
        }
    }

    private void Scan()
    {
        var playing = ProcessLoopback.Playing(_deviceId);
        long now = Clock.NowHns();
        lock (_gate)
        {
            foreach (var program in playing)
            {
                if (_sources.TryGetValue(program.ProcessId, out var known))
                {
                    known.LastSoundHns = now;
                    continue;
                }
                if (_sources.Count >= MaxPrograms)
                {
                    if (!_warnedFull) Log.Info($"More than {MaxPrograms} programs are playing; the rest stay in the desktop track");
                    _warnedFull = true;
                    continue;
                }
                var source = new ProcessAudioSource(program.ProcessId, program.Name, _bufferSeconds) { LastSoundHns = now };
                _sources[program.ProcessId] = source;
                source.Start();
            }

            // Let go of programs that have been quiet for longer than the replay buffer: their track would be silence.
            long quietSince = now - Clock.SecondsToHns(_bufferSeconds + 30);
            foreach (var gone in _sources.Where(kv => kv.Value.LastSoundHns < quietSince || kv.Value.State == AudioSourceState.Error).ToList())
            {
                gone.Value.Dispose();
                _sources.Remove(gone.Key);
                _warnedFull = false;
            }
        }
    }
}
