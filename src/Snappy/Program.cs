using Snappy.Core;
using Snappy.Library;
using Snappy.Platform;
using Snappy.UI;

namespace Snappy;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length >= 3 && args[0] == "--apply-update")
        {
            ApplicationConfiguration.Initialize();
            return Updater.ApplyUpdate(args[1], int.TryParse(args[2], out int oldPid) ? oldPid : 0);
        }
        if (args.Length > 0 && args[0] == "--uninstall")
        {
            ApplicationConfiguration.Initialize();
            return Installation.Uninstall();
        }
        // Snappy runs next to games all day: never stop every thread for a full garbage collection while it does.
        System.Runtime.GCSettings.LatencyMode = System.Runtime.GCLatencyMode.SustainedLowLatency;
#if DEBUG
        if (args.Length > 1 && args[0] == "--test-overlay")
            return SelfTest.RenderOverlays(args[1]);
        if (args.Length > 0 && args[0] == "--test-clip")
            return SelfTest.Run(args);
        if (args.Length > 1 && args[0] == "--test-menu")
            return SelfTest.RenderTrayMenu(args[1]);
        if (args.Length > 0 && args[0] == "--test-ring")
            return SelfTest.RingArenaTest();
        if (args.Length > 0 && args[0] == "--test-input")
            return SelfTest.InputTest();
        if (args.Length > 0 && args[0] == "--test-programs")
            return SelfTest.ProgramAudioTest(args.Length > 1 ? int.Parse(args[1]) : 10);
        if (args.Length > 2 && args[0] == "--test-export")
            return SelfTest.ExportTest(args[1], args[2]);
#endif

        using var mutex = new Mutex(true, @"Local\Snappy-SingleInstance" + AppPaths.InstanceSuffix, out bool isFirst);
        if (!isFirst)
        {
            // Already running: ask the existing instance to show itself instead of starting a second recorder.
            try { EventWaitHandle.OpenExisting(@"Local\Snappy-Show" + AppPaths.InstanceSuffix).Set(); } catch { }
            return 0;
        }

        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => Log.Error("UI thread exception", e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Error("Fatal exception", e.ExceptionObject as Exception);

        ApplicationConfiguration.Initialize();
        Log.Info($"Snappy {Updater.Current} starting (args: {string.Join(' ', args)})");
        Updater.CleanUp();
        Studio.StudioPreview.Forget();
        using var tray = new TrayApp(background: args.Contains("--background"));
        Application.Run(tray);
        Log.Info("Snappy exited");
        return 0;
    }
}

#if DEBUG
/// <summary>Headless checks used during development.</summary>
internal static class SelfTest
{
    /// <summary>
    /// Hammers a tiny, many-segment ring with random records (wrapping hundreds of times, crossing every segment
    /// boundary) and checks that every retained record reads back byte-for-byte and bookkeeping stays consistent.
    /// </summary>
    public static int RingArenaTest()
    {
        var rng = new Random(42);
        const long capacity = 10_007; // odd size so the last segment is short
        var ring = new RingArena(capacity, segmentSize: 1_000);
        var written = new Dictionary<long, byte[]>();
        int failures = 0;
        long time = 0;

        void Fail(string why) { if (failures++ < 10) Console.WriteLine("FAIL " + why); }

        for (int i = 0; i < 50_000; i++)
        {
            var data = new byte[rng.Next(1, 2_400)];
            rng.NextBytes(data);
            ring.Append(data, time, 1, i % 30 == 0 ? RingArena.FlagKeyframe : 0, 1, aux: i);
            written[time] = data;
            written.Remove(time - 400); // anything this old is long gone from a 10 KB ring
            time++;
            if (i % 97 == 0) ring.EvictOlderThan(time - rng.Next(3, 40));

            if (i % 500 != 0) continue;
            var entries = ring.Snapshot();
            long used = ring.UsedBytes;
            if (used > capacity) Fail($"used {used} > capacity");
            if (entries.Length > 1 && ring.SpanHns() != entries[^1].TimeHns - entries[0].TimeHns) Fail("SpanHns mismatch");
            for (int k = 1; k < entries.Length; k++)
                if (entries[k].Pos != entries[k - 1].Pos + entries[k - 1].Length || entries[k].TimeHns <= entries[k - 1].TimeHns)
                    Fail($"entries not contiguous at {k}");
            foreach (var e in entries)
            {
                var buf = new byte[e.Length];
                if (!ring.TryRead(e, buf)) { Fail($"TryRead refused live entry t={e.TimeHns}"); continue; }
                if (!written.TryGetValue(e.TimeHns, out var expected) || !buf.AsSpan().SequenceEqual(expected))
                    Fail($"data mismatch t={e.TimeHns} len={e.Length}");
            }
            var from = ring.Snapshot(time - 10);
            if (from.Any(e => e.TimeHns < time - 10)) Fail("Snapshot(from) filter");
        }

        Console.WriteLine(failures == 0 ? "RingArena OK (50,000 records, 10 KB ring, 11 segments)" : $"RingArena FAILED: {failures} problems");
        return failures == 0 ? 0 : 1;
    }

    /// <summary>Runs the editor exporter without the UI on a 3-track test clip (a:0 mix, a:1 Desktop, a:2 Mic).</summary>
    public static int ExportTest(string clip, string testCase)
    {
        // full: trim 2..8 s, crop 640x360 at (100,50), desktop at 50 %, mic muted 3..5 s (re-encodes)
        // fast: trim 1..9 s, desktop muted, video copied
        var spec = testCase == "full"
            ? new EditSpec(2, 8, "precise", false, new CropSpec(100, 50, 640, 360),
                new List<AudioLaneSpec> { new(1, 0.5, false, null), new(2, 1, false, new List<RangeSpec> { new(3, 5) }) })
            : new EditSpec(1, 9, "fast", false, null, new List<AudioLaneSpec> { new(1, 1, true, null) });

        string encoder = Video.FfmpegArgs.ResolveEncoder("auto");
        string output = EditExporter.ExportAsync(clip, spec, encoder, null, CancellationToken.None).GetAwaiter().GetResult();
        Console.WriteLine($"OK {output}");
        return 0;
    }
    /// <summary>Renders every input overlay into PNGs with a few keys and buttons held, to check how they look.</summary>
    public static int RenderOverlays(string folder)
    {
        Directory.CreateDirectory(folder);
        var state = new Snappy.Input.InputState { TimeMs = 1000 };
        foreach (int key in new[] { 0x57, 0x10, 0x45 }) state.Keys.Add(key);
        state.Buttons.Add(1);
        state.Vx = 90;
        state.Vy = -25;
        var pad = new Snappy.Input.GamepadState
        {
            Connected = true,
            Buttons = (ushort)(Snappy.Input.GamepadButton.A | Snappy.Input.GamepadButton.LeftBumper | Snappy.Input.GamepadButton.Up),
            LeftX = 0.7f, LeftY = 0.35f, RightX = -0.25f, RightY = -0.6f, LeftTrigger = 0.15f, RightTrigger = 0.8f,
        };

        var samples = new (string Name, string Input, string Design, bool Mouse, int W, int H)[]
        {
            ("keys", "keys", "", true, 620, 300),
            ("keyboard-compact", "keyboard", "compact", false, 900, 320),
            ("keyboard-full", "keyboard", "full", false, 1000, 430),
            ("mouse-arrow", "mouse", "arrow", false, 300, 420),
            ("mouse-simple", "mouse", "simple", false, 220, 310),
            ("controller-xbox", "controller", "xbox", false, 620, 430),
            ("controller-playstation", "controller", "playstation", false, 620, 430),
            ("cat", "cat", "", true, 620, 410),
        };
        foreach (var (name, input, design, mouse, w, h) in samples)
        {
            var layer = new Studio.StudioLayer
            {
                Type = "inputs", Input = input, Design = design, ShowKeys = true, ShowMouse = mouse,
                Presets = new List<string> { "shooter" }, Accent = "#f4f4f4",
            };
            using var renderer = new Studio.InputOverlayRenderer(layer, w, h);
            File.WriteAllBytes(Path.Combine(folder, name + ".png"), renderer.RenderPng(state, pad));
            Console.WriteLine($"{name}.png {w}x{h}");
        }
        return 0;
    }

    /// <summary>Draws a tray menu with the dark renderer into a PNG, to check the look without opening the real tray.</summary>
    public static int RenderTrayMenu(string path)
    {
        ApplicationConfiguration.Initialize();
        ToolStripManager.Renderer = new DarkMenuRenderer();
        using var menu = new ContextMenuStrip { Font = new Font("Segoe UI", 9.5f) };
        menu.Items.Add(new ToolStripMenuItem("Open Snappy") { Font = new Font(menu.Font, FontStyle.Bold) });
        menu.Items.Add(new ToolStripMenuItem("Recording · 300s buffered · 812 MB") { Enabled = false });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Save last 5 min") { ShortcutKeyDisplayString = "Alt + F10", ShowShortcutKeys = true });
        menu.Items.Add(new ToolStripMenuItem("Take screenshot") { ShortcutKeyDisplayString = "Alt + F1", ShowShortcutKeys = true });
        menu.Items.Add("Open clips folder");
        menu.Items.Add(new ToolStripSeparator());
        var length = new ToolStripMenuItem("Replay length");
        length.DropDownItems.Add(new ToolStripMenuItem("5 min") { Checked = true });
        menu.Items.Add(length);
        menu.Items.Add(new ToolStripMenuItem("Studio layers") { Checked = true });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Start with Windows") { Checked = true });
        menu.Items.Add("Exit");
        DarkMenuRenderer.Style(menu);
        menu.Show(new Point(0, 0));
        Application.DoEvents();
        using var bmp = new Bitmap(menu.Width, menu.Height);
        menu.DrawToBitmap(bmp, new Rectangle(Point.Empty, menu.Size));
        menu.Close();
        bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
        return 0;
    }

    /// <summary>Records for a while, saves a clip, reports and exits.</summary>
    /// <summary>
    /// Makes a listener, drops it, makes another (what leaving Studio does), then holds Shift and nudges the mouse
    /// and checks the second listener saw both.
    /// </summary>
    public static int InputTest()
    {
        var first = new object();
        var second = new object();
        Snappy.Input.InputHub.Claim(first, new[] { 0x10 }, false);
        Thread.Sleep(300);
        Snappy.Input.InputHub.Release(first);
        var listener = Snappy.Input.InputHub.Claim(second, new[] { 0x10, 0x11 }, true);
        Thread.Sleep(300);

        TestInput.Key(0x10, down: true);
        Thread.Sleep(120);
        var held = listener.Live();
        TestInput.Key(0x10, down: false);
        Thread.Sleep(120);
        var released = listener.Live();
        for (int i = 0; i < 40; i++) { TestInput.Move(3, 0); Thread.Sleep(1); }
        var moved = listener.Live();
        for (int i = 0; i < 40; i++) TestInput.Move(-3, 0);
        Snappy.Input.InputHub.Release(second);

        bool ok = held.Keys.Contains(0x10) && !released.Keys.Contains(0x10) && moved.Vx > 0;
        Console.WriteLine($"held shift seen={held.Keys.Contains(0x10)} released seen={released.Keys.Contains(0x10)} mouse vx={moved.Vx}");
        Console.WriteLine(ok ? "INPUT OK" : "INPUT FAILED");
        return ok ? 0 : 1;
    }

    private static class TestInput
    {
        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
        [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
        public static void Key(byte vk, bool down) => keybd_event(vk, 0, down ? 0u : 2u, UIntPtr.Zero);
        public static void Move(int dx, int dy) => mouse_event(0x0001 /* MOVE */, dx, dy, 0, UIntPtr.Zero);
    }

    /// <summary>Watches the per-program capture and prints how its packets sit on the clock.</summary>
    public static int ProgramAudioTest(int seconds)
    {
        using var programs = new Snappy.Audio.ProgramAudio("", 30);
        programs.Start();
        long begin = Clock.NowHns();
        Thread.Sleep(seconds * 1000);
        long now = Clock.NowHns();
        foreach (var source in programs.Sources())
        {
            var entries = source.Ring.Snapshot();
            Console.WriteLine($"{source.Name} (pid {source.ProcessId}) state={source.State} packets={entries.Length}");
            if (entries.Length == 0) continue;
            Console.WriteLine($"  first at {Clock.HnsToSeconds(entries[0].TimeHns - begin):F3}s, " +
                              $"last at {Clock.HnsToSeconds(entries[^1].TimeHns - begin):F3}s, " +
                              $"run ends at {Clock.HnsToSeconds(now - begin):F3}s");
            long covered = entries.Sum(e => e.DurationHns);
            Console.WriteLine($"  audio covers {Clock.HnsToSeconds(covered):F3}s, " +
                              $"stamps span {Clock.HnsToSeconds(entries[^1].TimeHns - entries[0].TimeHns):F3}s");
            for (int i = 0; i < Math.Min(6, entries.Length); i++)
                Console.WriteLine($"  [{i}] t={Clock.HnsToSeconds(entries[i].TimeHns - begin):F3}s dur={Clock.HnsToSeconds(entries[i].DurationHns) * 1000:F1}ms len={entries[i].Length}");
        }
        return 0;
    }

    public static int Run(string[] args)
    {
        int waitSeconds = args.Length > 1 ? int.Parse(args[1]) : 10;
        int clipSeconds = args.Length > 2 ? int.Parse(args[2]) : 5;
        var settings = AppSettings.Load();
        if (args.Contains("--mic")) settings.MicEnabled = true;
        int outIdx = Array.IndexOf(args, "--out");
        if (outIdx >= 0 && outIdx + 1 < args.Length) settings.ClipsFolder = args[outIdx + 1];
        int encIdx = Array.IndexOf(args, "--encoder");
        if (encIdx >= 0 && encIdx + 1 < args.Length) settings.Encoder = args[encIdx + 1];
        using var recorder = new Recorder(settings);
        recorder.Start();
        Console.WriteLine($"Recording for {waitSeconds}s with {recorder.Encoder}...");
        Thread.Sleep(waitSeconds * 1000);
        Console.WriteLine(recorder.StatusText());
        var result = recorder.SaveClipAsync(clipSeconds).GetAwaiter().GetResult();
        Console.WriteLine(result.Success ? $"OK {result.FilePath} {result.DurationSeconds:F2}s" : $"FAILED {result.Error}");
        return result.Success ? 0 : 1;
    }
}
#endif
