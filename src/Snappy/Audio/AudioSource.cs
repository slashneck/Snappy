using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.Audio;

public sealed record AudioDeviceInfo(string Id, string Name);

public enum AudioSourceState { Stopped, Starting, Active, DeviceMissing, Error }

/// <summary>
/// Captures one audio endpoint (desktop loopback or a microphone) into a RAM ring buffer as 48 kHz 16-bit PCM,
/// stamped with WASAPI's QPC timestamps. It pins the device you chose, never touches Windows volume settings,
/// and silently reconnects if the device disappears, changes format, or (in "default" mode) the default changes.
/// </summary>
public sealed class AudioSource : IDisposable
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

            var wfx = new WaveFormatEx
            {
                wFormatTag = 1, // PCM
                nChannels = (ushort)Channels,
                nSamplesPerSec = SampleRate,
                wBitsPerSample = 16,
                nBlockAlign = (ushort)BlockAlign,
                nAvgBytesPerSec = (uint)(SampleRate * BlockAlign),
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
            Log.Info($"[{Name}] capturing from '{DeviceName}'");

            byte[] silence = new byte[SampleRate * BlockAlign];
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
