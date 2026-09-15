using System.Diagnostics;
using System.Text.RegularExpressions;
using Snappy.Core;
using Snappy.Video;

namespace Snappy.Studio;

public sealed record WebcamFrame(byte[] Bgra, int Width, int Height, long Sequence);

/// <summary>
/// Keeps one camera open through FFmpeg (DirectShow, decoded to BGRA on a pipe) and holds the newest frame.
/// Reconnects on its own if the camera goes away. The camera light is on for as long as this runs.
/// </summary>
public sealed partial class WebcamFeed : IDisposable
{
    private const int MaxWidth = 960;

    private readonly Thread _thread;
    private volatile bool _stop;
    private volatile Process? _proc;
    private volatile WebcamFrame? _latest;

    public string Device { get; }
    public string? LastError { get; private set; }

    public WebcamFeed(string device)
    {
        Device = device;
        _thread = new Thread(Run) { IsBackground = true, Name = "webcam" };
        _thread.Start();
    }

    public WebcamFrame? Latest => _latest;

    private void Run()
    {
        bool preferHd = true;
        int backoffMs = 1000;
        while (!_stop)
        {
            long started = Clock.NowHns();
            bool gotFrames = false;
            try
            {
                gotFrames = RunOnce(preferHd);
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
            }
            if (_stop) break;
            // Not every camera offers 720p30. If asking for it fails, let the camera pick its own mode next time.
            if (!gotFrames) preferHd = !preferHd;
            if (Clock.NowHns() - started > Clock.SecondsToHns(20)) backoffMs = 1000;
            Thread.Sleep(backoffMs);
            backoffMs = Math.Min(backoffMs * 2, 10_000);
        }
    }

    private bool RunOnce(bool preferHd)
    {
        var psi = new ProcessStartInfo(AppPaths.FfmpegExe)
        {
            UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true,
        };
        var args = new List<string> { "-hide_banner", "-nostdin", "-f", "dshow", "-rtbufsize", "32M" };
        if (preferHd) args.AddRange(new[] { "-video_size", "1280x720", "-framerate", "30" });
        args.AddRange(new[]
        {
            "-i", $"video={Device}",
            "-vf", $"scale=w='min({MaxWidth},iw)':h=-2,fps=30,format=bgra",
            "-f", "rawvideo", "pipe:1",
        });
        foreach (string a in args) psi.ArgumentList.Add(a);

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("Could not start ffmpeg");
        _proc = proc;
        ChildProcessJob.Attach(proc);
        proc.StandardInput.Close();

        int width = 0, height = 0;
        var sizeKnown = new ManualResetEventSlim();
        var tail = new Queue<string>();
        var stderrThread = new Thread(() =>
        {
            bool output = false;
            string? line;
            while ((line = proc.StandardError.ReadLine()) != null)
            {
                lock (tail)
                {
                    tail.Enqueue(line);
                    while (tail.Count > 8) tail.Dequeue();
                }
                if (line.StartsWith("Output #0", StringComparison.Ordinal)) output = true;
                else if (output && !sizeKnown.IsSet && OutputSize().Match(line) is { Success: true } m)
                {
                    width = int.Parse(m.Groups[1].Value);
                    height = int.Parse(m.Groups[2].Value);
                    sizeKnown.Set();
                }
            }
            sizeKnown.Set();
        }) { IsBackground = true, Name = "webcam-log" };
        stderrThread.Start();

        bool gotFrames = false;
        try
        {
            if (!sizeKnown.Wait(15_000) || width == 0 || _stop) return false;
            var stdout = proc.StandardOutput.BaseStream;
            int frameBytes = width * height * 4;
            long seq = 0;
            while (!_stop)
            {
                var frame = new byte[frameBytes];
                if (!ReadExactly(stdout, frame)) break;
                _latest = new WebcamFrame(frame, width, height, ++seq);
                if (!gotFrames)
                {
                    gotFrames = true;
                    LastError = null;
                    Log.Info($"Camera {Device} open at {width}x{height}");
                }
            }
        }
        finally
        {
            try { if (!proc.HasExited) proc.Kill(true); } catch { }
            proc.WaitForExit(2000);
            _proc = null;
            _latest = null;
            if (!_stop && !gotFrames)
            {
                string? previous = LastError;
                lock (tail) LastError = tail.LastOrDefault() ?? "The camera did not start";
                if (LastError != previous) Log.Warn($"Camera {Device} failed: {LastError}");
            }
        }
        return gotFrames;
    }

    private static bool ReadExactly(Stream s, byte[] buffer)
    {
        int read = 0;
        while (read < buffer.Length)
        {
            int n = s.Read(buffer, read, buffer.Length - read);
            if (n <= 0) return false;
            read += n;
        }
        return true;
    }

    public void Dispose()
    {
        _stop = true;
        try { var p = _proc; if (p is { HasExited: false }) p.Kill(true); } catch { }
        if (_thread.IsAlive) _thread.Join(3000);
    }

    [GeneratedRegex(@"Video: rawvideo.*?, (\d{2,5})x(\d{2,5})")] private static partial Regex OutputSize();
}

/// <summary>Opens each camera once, no matter how many layers or previews use it.</summary>
public static class WebcamHub
{
    private static readonly object Gate = new();
    private static readonly Dictionary<string, WebcamFeed> Feeds = new(StringComparer.Ordinal);
    private static readonly Dictionary<object, HashSet<string>> Claims = new();

    /// <summary>Sets which cameras <paramref name="owner"/> needs. Cameras nobody needs anymore are closed.</summary>
    public static void SetClaims(object owner, IEnumerable<string> devices)
    {
        List<WebcamFeed> close;
        lock (Gate)
        {
            var wanted = devices.Where(d => !string.IsNullOrWhiteSpace(d)).ToHashSet(StringComparer.Ordinal);
            if (wanted.Count == 0) Claims.Remove(owner);
            else Claims[owner] = wanted;
            foreach (string d in wanted)
                if (!Feeds.ContainsKey(d)) Feeds[d] = new WebcamFeed(d);
            var inUse = Claims.Values.SelectMany(c => c).ToHashSet(StringComparer.Ordinal);
            close = Feeds.Where(kv => !inUse.Contains(kv.Key)).Select(kv => kv.Value).ToList();
            foreach (var feed in close) Feeds.Remove(feed.Device);
        }
        foreach (var feed in close) _ = Task.Run(feed.Dispose);
    }

    public static void Release(object owner) => SetClaims(owner, Array.Empty<string>());

    public static WebcamFeed? Get(string device)
    {
        lock (Gate) return Feeds.GetValueOrDefault(device);
    }
}
