using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.Audio;

public sealed record AudioDeviceInfo(string Id, string Name);

public enum AudioSourceState { Stopped, Starting, Active, DeviceMissing, Error }

/// <summary>Anything that fills a ring with 48 kHz PCM that a clip can cut a track out of.</summary>
public interface IAudioTrackSource
{
    string Name { get; }
    int Channels { get; }
    int BlockAlign { get; }
    RingArena Ring { get; }
}

/// <summary>
/// Captures one audio endpoint (desktop loopback or a microphone) into a RAM ring buffer as 48 kHz 16-bit PCM,
/// stamped with WASAPI's QPC timestamps. It pins the device you chose, never touches Windows volume settings,
/// and silently reconnects if the device disappears, changes format, or (in "default" mode) the default changes.
/// </summary>
public sealed class AudioSource : IAudioTrackSource, IDisposable
{
    public const int SampleRate = 48000;

    private readonly bool _loopback;
    private readonly string _deviceId; // "" = follow Windows default
    private readonly long _bufferHns;
    private readonly Thread _thread;
    private volatile bool _stop;

    public string Name { get; }
    public int Channels { get; }
    public int BlockAlign => Channels * 2;
    public RingArena Ring { get; }
    public volatile AudioSourceState State = AudioSourceState.Stopped;
    public string DeviceName { get; private set; } = "";
    public string? LastError { get; private set; }

    public AudioSource(string name, bool loopback, string deviceId, int bufferSeconds)
    {
        Name = name;
        _loopback = loopback;
        _deviceId = deviceId ?? "";
        Channels = loopback ? 2 : 1;
        _bufferHns = Clock.SecondsToHns(bufferSeconds + 10);
        Ring = new RingArena((long)(bufferSeconds + 15) * SampleRate * BlockAlign);
        _thread = new Thread(Run) { IsBackground = true, Name = $"audio-{name}", Priority = ThreadPriority.AboveNormal };
        _thread.SetApartmentState(ApartmentState.MTA);
    }

    public void Start() => _thread.Start();

    /// <summary>Loudest sample of the last moment, 0 to 1, for the level meter in Settings.</summary>
    public float RecentPeak(long windowHns = 1_200_000)
    {
        var entries = Ring.Snapshot(Clock.NowHns() - windowHns);
        int peak = 0;
        byte[] chunk = Array.Empty<byte>();
        foreach (var e in entries)
        {
            if (chunk.Length < e.Length) chunk = new byte[e.Length];
            if (!Ring.TryRead(e, chunk)) continue;
            foreach (short sample in MemoryMarshal.Cast<byte, short>(chunk.AsSpan(0, e.Length)))
            {
                int level = Math.Abs((int)sample);
                if (level > peak) peak = level;
            }
        }
        return Math.Min(1f, peak / 32767f);
    }

    public void Dispose()
    {
        _stop = true;
        if (_thread.IsAlive) _thread.Join(2000);
        State = AudioSourceState.Stopped;
    }

    public static List<AudioDeviceInfo> ListDevices(bool capture)
    {
        var list = new List<AudioDeviceInfo>();
        try
        {
            var en = Wasapi.CreateEnumerator();
            en.EnumAudioEndpoints(capture ? EDataFlow.Capture : EDataFlow.Render, Wasapi.DEVICE_STATE_ACTIVE, out var col);
            col.GetCount(out uint n);
            for (uint i = 0; i < n; i++)
            {
                col.Item(i, out var dev);
                dev.GetId(out string id);
                list.Add(new AudioDeviceInfo(id, Wasapi.FriendlyName(dev)));
                Marshal.ReleaseComObject(dev);
            }
            Marshal.ReleaseComObject(col);
            Marshal.ReleaseComObject(en);
        }
        catch (Exception ex)
        {
            Log.Error("Listing audio devices failed", ex);
        }
        return list;
    }

    private void Run()
    {
        State = AudioSourceState.Starting;
        int backoffMs = 500;
        while (!_stop)
        {
            try
            {
                CaptureSession();
                backoffMs = 500;
            }
            catch (Exception ex)
            {
                State = AudioSourceState.Error;
                LastError = ex.Message;
                Log.Warn($"[{Name}] capture error, retrying: {ex.Message}");
            }
            if (_stop) break;
            SleepInterruptible(backoffMs);
            backoffMs = Math.Min(backoffMs * 2, 5000);
        }
    }

    private void CaptureSession()
    {
        IMMDeviceEnumerator? en = null;
        IMMDevice? dev = null;
        IAudioClient? client = null;
        IAudioCaptureClient? capture = null;
        IntPtr fmtPtr = IntPtr.Zero;
        try
        {
            en = Wasapi.CreateEnumerator();
            var flow = _loopback ? EDataFlow.Render : EDataFlow.Capture;
            string openedId;
            try
            {
                if (_deviceId.Length == 0)
                    en.GetDefaultAudioEndpoint(flow, ERole.Console, out dev);
                else
                    en.GetDevice(_deviceId, out dev);
                dev.GetState(out int st);
                if ((st & Wasapi.DEVICE_STATE_ACTIVE) == 0) throw new COMException("inactive");
                dev.GetId(out openedId);
            }
            catch (COMException)
            {
                State = AudioSourceState.DeviceMissing;
                LastError = _deviceId.Length == 0 ? "No default device" : "Selected device is not connected";
                return; // Run() retries with backoff until it's back
            }

            DeviceName = Wasapi.FriendlyName(dev);
            var iid = Wasapi.IID_IAudioClient;
            dev.Activate(ref iid, Wasapi.CLSCTX_ALL, IntPtr.Zero, out object clientObj);
            client = (IAudioClient)clientObj;

            // A mic is kept as one channel, but many report two: USB mics copy the voice onto both, audio interfaces
            // put it on the first input only. Letting Windows average those halves a one-sided mic, so the mic is read
            // with its own channels and folded down here (see MonoFolder).
            int deviceChannels = _loopback ? Channels : Math.Clamp(MixChannels(client), 1, 2);
            int deviceBlock = deviceChannels * 2;
            var fold = deviceChannels != Channels ? new MonoFolder() : null;
            var wfx = new WaveFormatEx
            {
                wFormatTag = 1, // PCM
                nChannels = (ushort)deviceChannels,
                nSamplesPerSec = SampleRate,
                wBitsPerSample = 16,
                nBlockAlign = (ushort)deviceBlock,
                nAvgBytesPerSec = (uint)(SampleRate * deviceBlock),
                cbSize = 0,
            };
            fmtPtr = Marshal.AllocHGlobal(Marshal.SizeOf<WaveFormatEx>());
            Marshal.StructureToPtr(wfx, fmtPtr, false);

            uint flags = Wasapi.AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | Wasapi.AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;
            if (_loopback) flags |= Wasapi.AUDCLNT_STREAMFLAGS_LOOPBACK;
            client.Initialize(0 /* shared */, flags, 2_000_000 /* 200 ms */, 0, fmtPtr, IntPtr.Zero);

            var capIid = Wasapi.IID_IAudioCaptureClient;
            client.GetService(ref capIid, out object capObj);
            capture = (IAudioCaptureClient)capObj;
            client.Start();

            State = AudioSourceState.Active;
            LastError = null;
            Log.Info($"[{Name}] capturing from '{DeviceName}'{(fold != null ? " (two channels, folded to one)" : "")}");

            byte[] silence = new byte[SampleRate * BlockAlign];
            byte[] folded = fold != null ? new byte[SampleRate * BlockAlign] : Array.Empty<byte>();
            long nextHousekeeping = Clock.NowHns();
            while (!_stop)
            {
                SleepInterruptible(10);
                while (true)
                {
                    int hr = capture.GetNextPacketSize(out uint packetFrames);
                    if (hr == Wasapi.AUDCLNT_E_DEVICE_INVALIDATED) { Log.Info($"[{Name}] device invalidated, reconnecting"); return; }
                    Marshal.ThrowExceptionForHR(hr);
                    if (packetFrames == 0) break;

                    hr = capture.GetBuffer(out IntPtr data, out uint frames, out uint bufFlags, out _, out ulong qpc);
                    if (hr == Wasapi.AUDCLNT_E_DEVICE_INVALIDATED) return;
                    Marshal.ThrowExceptionForHR(hr);
                    int bytes = (int)frames * BlockAlign;
                    long durHns = frames * Clock.HnsPerSecond / SampleRate;
                    unsafe
                    {
                        if ((bufFlags & Wasapi.AUDCLNT_BUFFERFLAGS_SILENT) != 0 || data == IntPtr.Zero)
                        {
                            for (int off = 0; off < bytes; off += silence.Length)
                                Ring.Append(silence.AsSpan(0, Math.Min(silence.Length, bytes - off)), (long)qpc, durHns, 0, 0);
                        }
                        else if (fold != null)
                        {
                            if (folded.Length < bytes) folded = new byte[bytes];
                            fold.Fold(new ReadOnlySpan<short>((void*)data, (int)frames * deviceChannels), MemoryMarshal.Cast<byte, short>(folded.AsSpan(0, bytes)));
                            Ring.Append(folded.AsSpan(0, bytes), (long)qpc, durHns, 0, 0);
                        }
                        else
                        {
                            Ring.Append(new ReadOnlySpan<byte>((void*)data, bytes), (long)qpc, durHns, 0, 0);
                        }
                    }
                    capture.ReleaseBuffer(frames);
                }

                long now = Clock.NowHns();
                if (now >= nextHousekeeping)
                {
                    nextHousekeeping = now + Clock.HnsPerSecond * 2;
                    Ring.EvictOlderThan(now - _bufferHns);
                    if (_deviceId.Length == 0 && DefaultDeviceChanged(en, flow, openedId))
                    {
                        Log.Info($"[{Name}] Windows default device changed, switching");
                        return;
                    }
                }
            }
        }
        finally
        {
            try { client?.Stop(); } catch { }
            if (fmtPtr != IntPtr.Zero) Marshal.FreeHGlobal(fmtPtr);
            if (capture != null) Marshal.ReleaseComObject(capture);
            if (client != null) Marshal.ReleaseComObject(client);
            if (dev != null) Marshal.ReleaseComObject(dev);
            if (en != null) Marshal.ReleaseComObject(en);
        }
    }

    private static int MixChannels(IAudioClient client)
    {
        try
        {
            client.GetMixFormat(out IntPtr format);
            try { return Marshal.PtrToStructure<WaveFormatEx>(format).nChannels; }
            finally { Marshal.FreeCoTaskMem(format); }
        }
        catch
        {
            return 1;
        }
    }

    private static bool DefaultDeviceChanged(IMMDeviceEnumerator en, EDataFlow flow, string openedId)
    {
        try
        {
            en.GetDefaultAudioEndpoint(flow, ERole.Console, out var d);
            d.GetId(out string id);
            Marshal.ReleaseComObject(d);
            return !string.Equals(id, openedId, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return true;
        }
    }

    private void SleepInterruptible(int ms)
    {
        for (int waited = 0; waited < ms && !_stop; waited += 10)
            Thread.Sleep(Math.Min(10, ms - waited));
    }
}

/// <summary>
/// Turns a two channel mic into one without losing level: it always takes the channel that carries more sound.
/// Averaging the two, which is what Windows does, halves a mic that sits on one input of an audio interface, and
/// some mic arrays send the second channel flipped, so averaging cancels the voice almost completely.
/// </summary>
internal sealed class MonoFolder
{
    private double _left = 1e-9, _right = 1e-9;
    private bool _useRight;

    public void Fold(ReadOnlySpan<short> stereo, Span<short> mono)
    {
        int frames = mono.Length;
        double l = 0, r = 0;
        for (int i = 0; i < frames; i++)
        {
            double a = stereo[2 * i], b = stereo[2 * i + 1];
            l += a * a;
            r += b * b;
        }
        // Slow averages and a margin before switching, so the choice doesn't flip back and forth between words.
        _left = _left * 0.97 + l / Math.Max(1, frames) * 0.03;
        _right = _right * 0.97 + r / Math.Max(1, frames) * 0.03;
        if (!_useRight && _right > _left * 1.5) _useRight = true;
        else if (_useRight && _left > _right * 1.5) _useRight = false;
        int offset = _useRight ? 1 : 0;
        for (int i = 0; i < frames; i++) mono[i] = stereo[2 * i + offset];
    }
}
