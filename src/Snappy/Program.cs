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
#if DEBUG
        if (args.Length > 0 && args[0] == "--test-clip")
            return SelfTest.Run(args);
        if (args.Length > 1 && args[0] == "--test-menu")
            return SelfTest.RenderTrayMenu(args[1]);
        if (args.Length > 0 && args[0] == "--test-ring")
            return SelfTest.RingArenaTest();
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
