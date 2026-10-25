using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using Snappy.Core;
using Snappy.UI;
using Snappy.Video;

namespace Snappy.Audio;

/// <summary>
/// Snappy's own sounds (her voice, the Program's voice, little jingles and the clip-saved click) play in a tiny
/// separate process. The desktop recording then hears everything except that one process, so they never end up in
/// your clips, while a clip you play back in Snappy still does. Where Windows can't leave a program out (before
/// Windows 11), they simply play here.
/// </summary>
internal static class SnappySounds
{
    private static readonly object Gate = new();
    private static Process? _player;
    private static long _lastStartTicks;
    private static bool _stopping;

    /// <summary>Raised when the player process changes, so the desktop recording can leave out the new one.</summary>
    public static event Action? PlayerChanged;

    /// <summary>The process to leave out of the desktop recording, or 0 when there is none.</summary>
    public static int PlayerId
    {
        get { lock (Gate) return _player is { HasExited: false } p ? p.Id : 0; }
    }

    /// <summary>Starts the player, where leaving it out of recordings is possible.</summary>
    public static void Start()
    {
        if (!ProcessLoopback.Supported) return;
        lock (Gate)
        {
            if (_player is { HasExited: false }) return;
            // a player that keeps dying doesn't get restarted in a loop
            if (Environment.TickCount64 - _lastStartTicks < 10_000) return;
            _lastStartTicks = Environment.TickCount64;
            try
            {
                var psi = new ProcessStartInfo(Environment.ProcessPath!, "--sound-player")
                {
                    UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
                };
                var p = Process.Start(psi)!;
                ChildProcessJob.Attach(p);
                p.EnableRaisingEvents = true;
                p.Exited += (_, _) =>
                {
                    lock (Gate) if (_player == p) _player = null;
                    if (_stopping) return;
                    Log.Warn("Snappy's sound player stopped; her sounds play in the app until it's back");
                    PlayerChanged?.Invoke();
                };
                _player = p;
                Log.Info($"Snappy's sounds play in their own process ({p.Id}), so recordings leave them out");
            }
            catch (Exception ex)
            {
                _player = null;
                Log.Warn($"Couldn't start Snappy's sound player, her sounds play in the app: {ex.Message}");
            }
        }
        PlayerChanged?.Invoke();
    }

    /// <summary>The clip-saved click.</summary>
    public static void Snap(int volumePercent) => Do($"snap {volumePercent}");

    /// <summary>One syllable of her voice: pitch in Hz, volume 0 to 1.</summary>
    public static void Blip(double pitch, double volume) => Do(FormattableString.Invariant($"blip {pitch:0} {volume:0.###}"));

    /// <summary>One syllable of the Program's flat, synthetic voice.</summary>
    public static void ProgramBlip(double pitch, double volume) => Do(FormattableString.Invariant($"pblip {pitch:0} {volume:0.###}"));

    /// <summary>A short jingle: chime, fanfare, anthem, crash, scan, coin, sting, whoosh, tick, fizz.</summary>
    public static void Tune(string name, double volume) =>
        Do(FormattableString.Invariant($"tune {(name.All(char.IsLetter) ? name : "chime")} {volume:0.###}"));

    /// <summary>One syllable of Claude's voice: soft and warm.</summary>
    public static void ClaudeBlip(double pitch, double volume) => Do(FormattableString.Invariant($"cblip {pitch:0} {volume:0.###}"));

    /// <summary>Stops whatever is playing, e.g. music that gets cut off.</summary>
    public static void Hush() => Do("hush");

    // Sends a command to the player, or plays it right here when there is no player.
    private static void Do(string line)
    {
        if (!Send(line)) Play(line);
    }

    private static bool Send(string line)
    {
        Process? p;
        lock (Gate) p = _player is { HasExited: false } running ? running : null;
        if (p == null) { Start(); return false; }
        try
        {
            p.StandardInput.WriteLine(line);
            p.StandardInput.Flush();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static void Stop()
    {
        lock (Gate)
        {
            _stopping = true;
            try { _player?.StandardInput.Close(); } catch { }
            _player = null;
        }
    }

    /// <summary>The player process: plays what Snappy asks for until Snappy goes away.</summary>
    public static int RunPlayer()
    {
        try
        {
            string? line;
            while ((line = Console.In.ReadLine()) != null) Play(line);
        }
        catch
        {
            // Snappy closed the pipe
        }
        return 0;
    }

    private static void Play(string line)
    {
        var parts = line.Split(' ');
        try
        {
            double Num(int i) => double.Parse(parts[i], CultureInfo.InvariantCulture);
            switch (parts[0])
            {
                case "snap" when parts.Length > 1:
                    int percent = (int)Num(1);
                    if (percent > 0) Mixer.Play(Synth.Snap(), Math.Pow(percent / 100.0, 2));
                    break;
                case "blip" when parts.Length > 2:
                    Mixer.Play(Synth.Blip(Num(1)), Num(2) * Num(2));
                    break;
                case "pblip" when parts.Length > 2:
                    Mixer.Play(Synth.ProgramBlip(Num(1)), Num(2) * Num(2));
                    break;
                case "cblip" when parts.Length > 2:
                    Mixer.Play(Synth.ClaudeBlip(Num(1)), Num(2) * Num(2));
                    break;
                case "tune" when parts.Length > 2:
                    Mixer.Play(Synth.Tune(parts[1]), Num(2) * Num(2));
                    break;
                case "hush":
                    Mixer.Clear();
                    break;
            }
        }
        catch
        {
            // a bad line just plays nothing
        }
    }

    /// <summary>
    /// Everything that is playing, summed into one stream (48 kHz, mono). Sounds can overlap: her voice keeps going
    /// over a jingle. The device is only open while something plays, plus a moment of quiet after.
    /// </summary>
    private static class Mixer
    {
        public const int Rate = 48000;
        private const int Frames = 960, Buffers = 4; // 20 ms each
        private static readonly List<(float[] Pcm, int Pos, float Gain)> Voices = new();
        private static Thread? _thread;

        public static void Play(float[] pcm, double gain)
        {
            if (gain <= 0 || pcm.Length == 0) return;
            lock (Voices)
            {
                if (Voices.Count > 24) Voices.RemoveAt(0);
                Voices.Add((pcm, 0, (float)gain));
                if (_thread is { IsAlive: true }) return;
                _thread = new Thread(Run) { IsBackground = true, Name = "snappy-sounds", Priority = ThreadPriority.AboveNormal };
                _thread.Start();
            }
        }

        public static void Clear()
        {
            lock (Voices) Voices.Clear();
        }

        private static void Mix(short[] output)
        {
            var sum = new float[output.Length];
            lock (Voices)
            {
                for (int v = Voices.Count - 1; v >= 0; v--)
                {
                    var (pcm, pos, gain) = Voices[v];
                    int n = Math.Min(output.Length, pcm.Length - pos);
                    for (int i = 0; i < n; i++) sum[i] += pcm[pos + i] * gain;
                    if (pos + n >= pcm.Length) Voices.RemoveAt(v);
                    else Voices[v] = (pcm, pos + n, gain);
                }
            }
            // a soft limiter, so a loud moment rounds off instead of crackling
            for (int i = 0; i < output.Length; i++) output[i] = (short)(Math.Tanh(sum[i] * 1.1) * 30000);
        }

        private static void Run()
        {
            IntPtr device = IntPtr.Zero, ready = CreateEvent(IntPtr.Zero, false, false, null);
            var headers = new IntPtr[Buffers];
            var data = new IntPtr[Buffers];
            int headerSize = Marshal.SizeOf<WaveHeader>();
            try
            {
                var format = new WaveFormat { Tag = 1, Channels = 1, Rate = Rate, BytesPerSecond = Rate * 2, BlockAlign = 2, Bits = 16 };
                if (waveOutOpen(out device, uint.MaxValue, ref format, ready, IntPtr.Zero, 0x50000 /* CALLBACK_EVENT */) != 0) return;
                var block = new short[Frames];
                for (int i = 0; i < Buffers; i++)
                {
                    data[i] = Marshal.AllocHGlobal(Frames * 2);
                    headers[i] = Marshal.AllocHGlobal(headerSize);
                    Marshal.StructureToPtr(new WaveHeader { Data = data[i], Length = Frames * 2 }, headers[i], false);
                    waveOutPrepareHeader(device, headers[i], headerSize);
                    Mix(block);
                    Marshal.Copy(block, 0, data[i], Frames);
                    waveOutWrite(device, headers[i], headerSize);
                }
                long quietSince = 0;
                while (true)
                {
                    WaitForSingleObject(ready, 100);
                    for (int i = 0; i < Buffers; i++)
                    {
                        var h = Marshal.PtrToStructure<WaveHeader>(headers[i]);
                        if ((h.Flags & 1 /* WHDR_DONE */) == 0) continue;
                        Mix(block);
                        Marshal.Copy(block, 0, data[i], Frames);
                        waveOutWrite(device, headers[i], headerSize);
                    }
                    bool quiet;
                    lock (Voices) quiet = Voices.Count == 0;
                    if (!quiet) quietSince = 0;
                    else if (quietSince == 0) quietSince = Environment.TickCount64;
                    else if (Environment.TickCount64 - quietSince > 2500)
                    {
                        lock (Voices)
                        {
                            if (Voices.Count > 0) { quietSince = 0; continue; }
                            _thread = null; // the next sound starts a fresh stream
                        }
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Warn($"Snappy's sounds stopped playing: {ex.Message}");
                lock (Voices) { Voices.Clear(); _thread = null; }
            }
            finally
            {
                if (device != IntPtr.Zero)
                {
                    waveOutReset(device);
                    for (int i = 0; i < Buffers; i++)
                        if (headers[i] != IntPtr.Zero) waveOutUnprepareHeader(device, headers[i], headerSize);
                    waveOutClose(device);
                }
                for (int i = 0; i < Buffers; i++)
                {
                    if (headers[i] != IntPtr.Zero) Marshal.FreeHGlobal(headers[i]);
                    if (data[i] != IntPtr.Zero) Marshal.FreeHGlobal(data[i]);
                }
                CloseHandle(ready);
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct WaveFormat { public ushort Tag, Channels; public int Rate, BytesPerSecond; public ushort BlockAlign, Bits, Extra; }

        [StructLayout(LayoutKind.Sequential)]
        private struct WaveHeader
        {
            public IntPtr Data;
            public int Length, Recorded;
            public IntPtr User;
            public int Flags, Loops;
            public IntPtr Next, Reserved;
        }

        [DllImport("winmm.dll")] private static extern int waveOutOpen(out IntPtr device, uint id, ref WaveFormat format, IntPtr callback, IntPtr instance, uint flags);
        [DllImport("winmm.dll")] private static extern int waveOutPrepareHeader(IntPtr device, IntPtr header, int size);
        [DllImport("winmm.dll")] private static extern int waveOutUnprepareHeader(IntPtr device, IntPtr header, int size);
        [DllImport("winmm.dll")] private static extern int waveOutWrite(IntPtr device, IntPtr header, int size);
        [DllImport("winmm.dll")] private static extern int waveOutReset(IntPtr device);
        [DllImport("winmm.dll")] private static extern int waveOutClose(IntPtr device);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateEvent(IntPtr attributes, bool manualReset, bool initialState, string? name);
        [DllImport("kernel32.dll")] private static extern uint WaitForSingleObject(IntPtr handle, uint ms);
        [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    }

    /// <summary>Every sound is made right here, from a few sine and square waves. Made once, then reused.</summary>
    private static class Synth
    {
        private const int Rate = Mixer.Rate;
        private static readonly Dictionary<string, float[]> Made = new();

        private static float[] Cached(string key, Func<float[]> make)
        {
            lock (Made)
            {
                if (!Made.TryGetValue(key, out var pcm)) Made[key] = pcm = make();
                return pcm;
            }
        }

        private static double Square(double phase) => phase % 1 < 0.5 ? 1 : -1;
        private static double Triangle(double phase) => 4 * Math.Abs(phase % 1 - 0.5) - 1;

        /// <summary>Her voice: a short square wave with a tiny upward lilt, softened by a low pass.</summary>
        public static float[] Blip(double pitch) => Cached($"b{(int)Math.Round(pitch / 15) * 15}", () =>
        {
            int frames = Rate * 75 / 1000;
            double lowpass = 1 - Math.Exp(-2 * Math.PI * 2400 / Rate), phase = 0, smooth = 0;
            var pcm = new float[frames];
            for (int i = 0; i < frames; i++)
            {
                double t = (double)i / Rate;
                phase += pitch * Math.Pow(1.07, Math.Min(1, t / 0.045)) / Rate;
                smooth += lowpass * (Square(phase) - smooth);
                double envelope = t < 0.004 ? t / 0.004 : Math.Exp(-(t - 0.004) / 0.016);
                pcm[i] = (float)(smooth * envelope * 0.07);
            }
            return pcm;
        });

        /// <summary>The Program: a flat, slightly metallic tone, the same length every time, no lilt.</summary>
        public static float[] ProgramBlip(double pitch) => Cached($"p{(int)Math.Round(pitch / 10) * 10}", () =>
        {
            int frames = Rate * 70 / 1000;
            var pcm = new float[frames];
            double phase = 0;
            for (int i = 0; i < frames; i++)
            {
                double t = (double)i / Rate;
                phase += pitch / Rate;
                double tone = Triangle(phase) * 0.7 + Math.Sin(2 * Math.PI * phase * 2) * 0.3;
                double ring = 0.75 + 0.25 * Math.Sin(2 * Math.PI * 55 * t); // a faint robotic flutter
                double envelope = Math.Min(1, t / 0.006) * Math.Min(1, (0.07 - t) / 0.02);
                pcm[i] = (float)(tone * ring * envelope * 0.075);
            }
            return pcm;
        });

        /// <summary>Claude: a round, soft tone with a gentle swell, a little lower than Snappy.</summary>
        public static float[] ClaudeBlip(double pitch) => Cached($"c{(int)Math.Round(pitch / 10) * 10}", () =>
        {
            int frames = Rate * 95 / 1000;
            var pcm = new float[frames];
            double phase = 0;
            for (int i = 0; i < frames; i++)
            {
                double t = (double)i / Rate;
                phase += pitch * (1 + 0.03 * Math.Min(1, t / 0.06)) / Rate;
                double tone = Math.Sin(2 * Math.PI * phase) + 0.35 * Math.Sin(4 * Math.PI * phase) + 0.12 * Math.Sin(6 * Math.PI * phase);
                double envelope = Math.Min(1, t / 0.012) * Math.Exp(-Math.Max(0, t - 0.012) / 0.03);
                pcm[i] = (float)(tone * envelope * 0.085);
            }
            return pcm;
        });

        /// <summary>The clip-saved click from the app's assets, brought to the mixer's rate.</summary>
        public static float[] Snap() => Cached("snap", () =>
        {
            using var s = AppAssets.Open("snap.wav");
            using var ms = new MemoryStream();
            s.CopyTo(ms);
            byte[] wav = ms.ToArray();
            int rate = BitConverter.ToInt32(wav, 24), channels = BitConverter.ToInt16(wav, 22);
            int pos = 12;
            while (pos + 8 <= wav.Length && System.Text.Encoding.ASCII.GetString(wav, pos, 4) != "data") pos += 8 + BitConverter.ToInt32(wav, pos + 4) + (BitConverter.ToInt32(wav, pos + 4) & 1);
            int start = pos + 8, count = (wav.Length - start) / 2 / channels;
            var source = new float[count];
            for (int i = 0; i < count; i++) source[i] = BitConverter.ToInt16(wav, start + i * 2 * channels) / 32768f;
            int frames = (int)((long)count * Rate / rate);
            var pcm = new float[frames];
            for (int i = 0; i < frames; i++)
            {
                double at = (double)i * rate / Rate;
                int a = (int)at;
                double f = at - a;
                pcm[i] = (float)(source[Math.Min(a, count - 1)] * (1 - f) + source[Math.Min(a + 1, count - 1)] * f);
            }
            return pcm;
        });

        // One note: a frequency, a length, a wave and how it fades.
        private readonly record struct Note(double Hz, double Seconds, double At, string Wave = "square", double Gain = 0.06, double Bend = 1);

        private static readonly Random Noise = new(7);

        // the boss fight's loop, one note per sixteenth: A minor, down to G and F and back up
        private static readonly double[] BattleBass = { 110, 110, 165, 110, 98, 98, 147, 98, 87.3, 87.3, 131, 87.3, 98, 98, 147, 123.5 };
        // the side-scroller's loop: C major, hopping around the chord, a rest here and there (0)
        private static readonly double[] PlatformBass = { 130.8, 196, 130.8, 196, 174.6, 261.6, 174.6, 261.6, 146.8, 220, 146.8, 220, 196, 293.7, 196, 246.9 };
        private static readonly double[] PlatformLead = { 659.3, 0, 784, 659.3, 698.5, 0, 880, 0, 587.3, 659.3, 698.5, 0, 784, 0, 987.8, 1046.5 };
        private static readonly double[] BattleLead = { 440, 523.3, 659.3, 523.3, 392, 493.9, 587.3, 493.9, 349.2, 440, 523.3, 440, 392, 493.9, 587.3, 659.3 };
        // the bakery's music box: four bars of a waltz, C, F, G and home again
        private static readonly double[] BakeryTune = { 659.3, 784, 1046.5, 784, 659.3, 784, 698.5, 880, 1046.5, 880, 698.5, 880,
            587.3, 784, 987.8, 784, 698.5, 587.3, 659.3, 784, 1046.5, 1318.5, 1046.5, 0 };
        private static readonly double[] BakeryBass = { 130.8, 174.6, 196, 130.8 };
        private static readonly double[] BakeryPah = { 329.6, 440, 493.9, 329.6 };
        // the neon runner: A minor, F, C, G, each chord arpeggiated over half a bar
        private static readonly double[][] NeonChords = { new[] { 440, 523.3, 659.3, 880 }, new[] { 349.2, 440, 523.3, 698.5 },
            new[] { 392, 523.3, 659.3, 784 }, new[] { 392, 493.9, 587.3, 784 } };
        private static readonly double[] NeonRoots = { 110, 87.3, 130.8, 98 };
        // the tiny games' jingle: a trombone hook over an oom-pah
        private static readonly double[] WareLead = { 392, 0, 523.3, 0, 659.3, 587.3, 523.3, 0, 440, 0, 523.3, 587.3, 659.3, 0, 784, 0 };
        private static readonly double[] WareBass = { 130.8, 174.6, 110, 196 };
        // a dark library: slow piano arpeggios down from A minor, one chord a bar
        private static readonly double[] MysteryNotes = { 220, 261.6, 329.6, 440, 196, 246.9, 293.7, 392, 174.6, 220, 261.6, 349.2, 164.8, 207.7, 246.9, 329.6 };
        private static readonly double[] MysteryBass = { 110, 98, 87.3, 82.4 };
        // a quiet room: a little tune, three bars, over a soft held note
        private static readonly double[] LullabyNotes = { 523.3, 659.3, 784, 659.3, 698.5, 880, 784, 0, 659.3, 784, 1046.5, 987.8 };
        private static readonly double[] LullabyBass = { 130.8, 174.6, 130.8 };

        private static float[] Render(double seconds, params Note[] notes)
        {
            var pcm = new float[(int)(seconds * Rate)];
            double lowpass = 1 - Math.Exp(-2 * Math.PI * 3200 / Rate);
            foreach (var n in notes)
            {
                int from = (int)(n.At * Rate), frames = (int)(n.Seconds * Rate);
                double phase = 0, smooth = 0;
                for (int i = 0; i < frames && from + i < pcm.Length; i++)
                {
                    double t = (double)i / Rate, k = t / n.Seconds;
                    double hz = n.Hz * Math.Pow(n.Bend, k);
                    if (n.Wave == "trombone") hz *= 1 + 0.018 * Math.Sin(2 * Math.PI * 6 * t) * Math.Min(1, t * 3);
                    else if (n.Wave == "theremin") hz *= 1 + 0.03 * Math.Sin(2 * Math.PI * 5.5 * t) * Math.Min(1, t * 2);
                    phase += hz / Rate;
                    double v = n.Wave switch
                    {
                        "noise" => Noise.NextDouble() * 2 - 1,
                        "sine" or "theremin" => Math.Sin(2 * Math.PI * phase),
                        "triangle" => Triangle(phase),
                        "trombone" => Triangle(phase) * 0.6 + Square(phase) * 0.4,
                        _ => Square(phase),
                    };
                    smooth += lowpass * (v - smooth);
                    // a theremin swells in and holds, a bell (sine) rings out, the rest stop clean
                    double attack = n.Wave == "theremin" ? 0.09 : 0.008;
                    double envelope = Math.Min(1, t / attack) * (n.Wave == "sine" ? Math.Exp(-t * 3.2) : Math.Min(1, (n.Seconds - t) / (n.Wave == "theremin" ? 0.25 : 0.05)));
                    pcm[from + i] += (float)(smooth * envelope * n.Gain);
                }
            }
            return pcm;
        }

        public static float[] Tune(string name) => Cached($"t{name}", () => name switch
        {
            // an achievement: two bright bell notes
            "chime" => Render(1.1, new Note(1318.5, 0.9, 0, "sine", 0.13), new Note(1975.5, 0.9, 0.12, "sine", 0.12), new Note(2637, 0.6, 0.12, "sine", 0.04)),
            // to the moon: a rising arpeggio and a held chord
            "fanfare" => Render(1.7,
                new Note(523.3, 0.12, 0.00), new Note(659.3, 0.12, 0.12), new Note(784.0, 0.12, 0.24), new Note(1046.5, 0.5, 0.36),
                new Note(784.0, 0.16, 0.86), new Note(1046.5, 0.7, 1.0, Gain: 0.07), new Note(1318.5, 0.7, 1.0, Gain: 0.05), new Note(1568.0, 0.7, 1.0, Gain: 0.04)),
            // to the moon: a proud little march that keeps climbing
            "anthem" => Render(5.4,
                new Note(392.0, 0.19, 0.00), new Note(523.3, 0.19, 0.21), new Note(659.3, 0.19, 0.43), new Note(784.0, 0.6, 0.64),
                new Note(659.3, 0.19, 1.29), new Note(784.0, 0.9, 1.50), new Note(880.0, 0.19, 2.57), new Note(784.0, 0.19, 2.79),
                new Note(698.5, 0.19, 3.00), new Note(659.3, 0.19, 3.21), new Note(587.3, 0.19, 3.43), new Note(659.3, 0.19, 3.64),
                new Note(1046.5, 1.4, 3.86, Gain: 0.065), new Note(784.0, 1.4, 3.86, Gain: 0.04), new Note(659.3, 1.4, 3.86, Gain: 0.035),
                new Note(130.8, 0.8, 0.00, "triangle", 0.09), new Note(130.8, 0.8, 0.86, "triangle", 0.09), new Note(98.0, 0.8, 1.71, "triangle", 0.09),
                new Note(87.3, 0.8, 2.57, "triangle", 0.09), new Note(98.0, 0.4, 3.43, "triangle", 0.09), new Note(130.8, 1.4, 3.86, "triangle", 0.1)),
            // the crash: a sad trombone, wah wah wah waaah
            "crash" => Render(2.8,
                new Note(392.0, 0.42, 0.0, "trombone", 0.11), new Note(370.0, 0.42, 0.48, "trombone", 0.11),
                new Note(349.2, 0.42, 0.96, "trombone", 0.11), new Note(329.6, 1.3, 1.44, "trombone", 0.12, 0.97)),
            // a computer scanning: quick beeps and a rising sweep
            "scan" => Render(1.1,
                new Note(880, 0.05, 0.0, Gain: 0.04), new Note(1320, 0.05, 0.1, Gain: 0.04), new Note(880, 0.05, 0.2, Gain: 0.04),
                new Note(1320, 0.05, 0.3, Gain: 0.04), new Note(600, 0.6, 0.45, "triangle", 0.05, 2.4)),
            // a coin: two quick bright notes
            "coin" => Render(0.6, new Note(987.8, 0.08, 0, Gain: 0.06), new Note(1318.5, 0.45, 0.08, Gain: 0.06)),
            // a dramatic entrance: a low swell
            "sting" => Render(1.4, new Note(110, 1.3, 0, "sine", 0.16), new Note(164.8, 1.3, 0.05, "sine", 0.1), new Note(220, 1.2, 0.1, "sine", 0.08), new Note(880, 0.15, 0, Gain: 0.04)),
            // something flying by
            "whoosh" => Render(0.5, new Note(300, 0.45, 0, "triangle", 0.05, 3.2)),
            // a line of a report appearing
            "tick" => Render(0.12, new Note(1760, 0.05, 0, Gain: 0.035), new Note(2637, 0.04, 0.03, "sine", 0.03)),
            // a key on a keyboard
            "key" => Render(0.05, new Note(2400, 0.02, 0, "noise", 0.14), new Note(1900, 0.02, 0.004, Gain: 0.015)),
            // the picture breaking up for a moment
            "glitch" => Render(0.7, new Note(0, 0.08, 0, "noise", 0.07), new Note(180, 0.06, 0.1, Gain: 0.05), new Note(0, 0.05, 0.18, "noise", 0.06),
                new Note(1200, 0.04, 0.26, Gain: 0.035), new Note(90, 0.1, 0.32, Gain: 0.06), new Note(0, 0.12, 0.45, "noise", 0.05)),
            // a computer waking up
            "boot" => Render(1.6, new Note(261.6, 1.2, 0, "sine", 0.1), new Note(392.0, 1.2, 0.04, "sine", 0.08), new Note(523.3, 1.3, 0.08, "sine", 0.07),
                new Note(784.0, 1.2, 0.12, "sine", 0.04)),
            // taking off: a light, rising flutter
            "fly" => Render(2.2,
                new Note(523.3, 0.14, 0.00, "triangle", 0.06), new Note(659.3, 0.14, 0.12, "triangle", 0.06), new Note(784.0, 0.14, 0.24, "triangle", 0.06),
                new Note(1046.5, 0.14, 0.36, "triangle", 0.06), new Note(1318.5, 0.14, 0.48, "triangle", 0.055), new Note(1568.0, 0.9, 0.6, "sine", 0.08),
                new Note(2093.0, 0.8, 0.72, "sine", 0.05), new Note(1318.5, 0.9, 0.6, "sine", 0.05)),
            // a detective story starts: a slinky bass and a muted trumpet (usually cut off after two seconds)
            "noir" => Render(3.4,
                new Note(82.4, 0.42, 0.00, "triangle", 0.1), new Note(98.0, 0.42, 0.45, "triangle", 0.1), new Note(110.0, 0.42, 0.90, "triangle", 0.1),
                new Note(116.5, 0.42, 1.35, "triangle", 0.1), new Note(123.5, 0.42, 1.80, "triangle", 0.1), new Note(123.5, 0.42, 2.25, "triangle", 0.1),
                new Note(82.4, 0.6, 2.70, "triangle", 0.1),
                new Note(329.6, 0.35, 0.00, "trombone", 0.07), new Note(392.0, 0.3, 0.45, "trombone", 0.07), new Note(493.9, 0.25, 0.90, "trombone", 0.07),
                new Note(466.2, 0.65, 1.15, "trombone", 0.075, 0.97), new Note(392.0, 0.3, 1.90, "trombone", 0.07), new Note(329.6, 0.9, 2.30, "trombone", 0.07, 0.98)),
            // a record scratch: the music stops right there
            "scratch" => Render(0.45, new Note(0, 0.22, 0, "noise", 0.16), new Note(1100, 0.2, 0, Gain: 0.05, Bend: 0.18), new Note(0, 0.1, 0.24, "noise", 0.08)),
            // a light bulb burning out
            "fizz" => Render(0.6, new Note(1400, 0.07, 0, Gain: 0.04), new Note(900, 0.06, 0.09, Gain: 0.035), new Note(1200, 0.05, 0.17, Gain: 0.03),
                new Note(700, 0.35, 0.24, "triangle", 0.05, 0.3)),
            // a boss fight: a driving bass, an arpeggio on top and a hi-hat, one bar that loops
            "battle" => Render(3.4, Enumerable.Range(0, 16).SelectMany(i => new[]
            {
                new Note(BattleBass[i], 0.19, i * 0.2125, "triangle", 0.085),
                new Note(BattleLead[i], 0.17, i * 0.2125, Gain: 0.032),
                new Note(0, 0.03, i * 0.2125, "noise", i % 4 == 0 ? 0.05 : 0.022),
            }).ToArray()),
            // a little side-scroller tune: a bouncy square-wave melody over a walking bass, one bar that loops
            "platform" => Render(3.2, Enumerable.Range(0, 16).SelectMany(i => new[]
            {
                new Note(PlatformBass[i], 0.16, i * 0.2, "triangle", 0.07),
                new Note(PlatformLead[i], PlatformLead[i] > 0 ? 0.15 : 0.01, i * 0.2, Gain: PlatformLead[i] > 0 ? 0.035 : 0),
            }).ToArray()),
            // a tape rewinding: a squeal climbing higher over a hiss
            "rewind" => Render(2.6, new Note(380, 2.5, 0, Gain: 0.03, Bend: 2.6), new Note(760, 2.5, 0, "triangle", 0.025, 2.4), new Note(0, 2.5, 0, "noise", 0.025)),
            // the play button on an old tape deck
            "clunk" => Render(0.25, new Note(140, 0.08, 0, "triangle", 0.12, 0.6), new Note(0, 0.05, 0, "noise", 0.08), new Note(90, 0.1, 0.06, "triangle", 0.08)),
            // glass cracking: a sharp snap and a few ticks
            "crack" => Render(0.4, new Note(0, 0.04, 0, "noise", 0.16), new Note(2600, 0.03, 0.01, Gain: 0.05), new Note(0, 0.03, 0.09, "noise", 0.09),
                new Note(1900, 0.02, 0.12, Gain: 0.035), new Note(0, 0.05, 0.2, "noise", 0.06)),
            // a window breaking: a crash, then glass tinkling down
            "shatter" => Render(1.6, new Note(0, 0.3, 0, "noise", 0.24), new Note(90, 0.25, 0, "triangle", 0.12, 0.5),
                new Note(3520, 0.35, 0.08, "sine", 0.07), new Note(2960, 0.35, 0.17, "sine", 0.06), new Note(4186, 0.3, 0.27, "sine", 0.05),
                new Note(2637, 0.35, 0.38, "sine", 0.05), new Note(3136, 0.3, 0.52, "sine", 0.04), new Note(3951, 0.3, 0.7, "sine", 0.03)),
            // a tractor beam humming
            "beam" => Render(1.8, new Note(150, 1.7, 0, "theremin", 0.07, 1.25), new Note(300, 1.7, 0.05, "theremin", 0.03, 1.25)),
            // Halloween: a wobbly theremin over a low drone
            "spooky" => Render(4.2,
                new Note(440.0, 0.7, 0.00, "theremin", 0.09), new Note(659.3, 1.0, 0.65, "theremin", 0.09, 0.95), new Note(622.3, 0.55, 1.6, "theremin", 0.085),
                new Note(523.3, 1.6, 2.1, "theremin", 0.09, 0.97),
                new Note(110.0, 4.0, 0.00, "triangle", 0.045), new Note(116.5, 1.6, 2.1, "triangle", 0.03)),
            // a ghost: one long, sliding "booo"
            "boo" => Render(1.5, new Note(330, 1.4, 0, "theremin", 0.11, 0.62), new Note(165, 1.4, 0.05, "triangle", 0.035, 0.7)),
            // something festive: bells ringing down and back up, with a shake of sleigh bells
            "bells" => Render(2.6,
                new Note(1568.0, 0.8, 0.00, "sine", 0.1), new Note(1318.5, 0.8, 0.18, "sine", 0.1), new Note(1174.7, 0.8, 0.36, "sine", 0.1),
                new Note(1046.5, 0.9, 0.54, "sine", 0.1), new Note(1318.5, 0.8, 0.9, "sine", 0.09), new Note(1568.0, 1.2, 1.08, "sine", 0.11),
                new Note(2093.0, 1.2, 1.08, "sine", 0.05),
                new Note(6000, 0.05, 0.00, "noise", 0.05), new Note(6000, 0.05, 0.36, "noise", 0.04), new Note(6000, 0.05, 0.72, "noise", 0.05),
                new Note(6000, 0.05, 1.08, "noise", 0.05), new Note(6000, 0.05, 1.26, "noise", 0.035), new Note(6000, 0.05, 1.44, "noise", 0.035)),
            // a bakery: a music box turning slowly, three to a bar, with a soft oom-pah-pah underneath
            "bakery" => Render(5.28, Enumerable.Range(0, 24).SelectMany(i => new[]
            {
                new Note(BakeryTune[i], 0.6, i * 0.22, "sine", BakeryTune[i] > 0 ? 0.055 : 0),
                i % 6 == 0 ? new Note(BakeryBass[i / 6], 1.0, i * 0.22, "triangle", 0.05)
                    : new Note(BakeryPah[i / 6], 0.3, i * 0.22, "sine", i % 2 == 0 ? 0.028 : 0),
            }).ToArray()),
            // a neon runner: a four-on-the-floor kick, an off-beat bass, a clap, hi-hats and a bright arpeggio, two bars
            "neon" => Render(3.75, Enumerable.Range(0, 32).SelectMany(i => new[]
            {
                new Note(150, 0.14, i * 0.117, "sine", i % 4 == 0 ? 0.22 : 0, 0.3),
                new Note(NeonRoots[i / 8], 0.1, i * 0.117, Gain: i % 4 == 2 ? 0.05 : 0),
                new Note(0, i % 8 == 4 ? 0.08 : 0.025, i * 0.117, "noise", i % 8 == 4 ? 0.07 : i % 2 == 1 ? 0.02 : 0),
                new Note(NeonChords[i / 8][i % 4], 0.1, i * 0.117, Gain: 0.026),
            }).ToArray()),
            // tiny games: a silly trombone hook, bouncing along over an oom-pah
            "ware" => Render(2.4, Enumerable.Range(0, 16).SelectMany(i => new[]
            {
                new Note(WareLead[i], 0.14, i * 0.15, "trombone", WareLead[i] > 0 ? 0.06 : 0),
                new Note(i % 2 == 0 ? WareBass[i / 4] : WareBass[i / 4] * 2, 0.12, i * 0.15, "triangle", 0.06),
                new Note(0, 0.03, i * 0.15, "noise", i % 4 == 2 ? 0.05 : 0),
            }).ToArray()),
            // something mysterious: soft piano notes falling through four chords
            "mystery" => Render(6.4, Enumerable.Range(0, 16).SelectMany(i => new[]
            {
                new Note(MysteryNotes[i], 1.2, i * 0.4, "sine", 0.05),
                new Note(MysteryBass[i / 4], 1.6, i * 0.4, "triangle", i % 4 == 0 ? 0.035 : 0),
            }).ToArray()),
            // somewhere safe: a slow little tune with a warm note held under it
            "lullaby" => Render(7.2, Enumerable.Range(0, 12).SelectMany(i => new[]
            {
                new Note(LullabyNotes[i], 1.1, i * 0.6, "sine", LullabyNotes[i] > 0 ? 0.05 : 0),
                new Note(LullabyBass[i / 4], 2.35, i * 0.6, "triangle", i % 4 == 0 ? 0.03 : 0),
            }).ToArray()),
            // a dark room: a low, slightly sour drone, a faint hiss and a heartbeat
            "dread" => Render(4.0,
                new Note(55, 4.0, 0, "triangle", 0.06), new Note(58.3, 4.0, 0, "triangle", 0.035), new Note(0, 4.0, 0, "noise", 0.006),
                new Note(70, 0.14, 0.0, "sine", 0.3, 0.5), new Note(70, 0.14, 0.3, "sine", 0.2, 0.5),
                new Note(70, 0.14, 2.0, "sine", 0.3, 0.5), new Note(70, 0.14, 2.3, "sine", 0.2, 0.5)),
            _ => Render(0.3, new Note(880, 0.2, 0, "sine", 0.08)),
        });
    }
}
