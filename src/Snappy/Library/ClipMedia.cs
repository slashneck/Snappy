using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using Snappy.Core;

namespace Snappy.Library;

public sealed record AudioTrackInfo(int Index, string Title, int Channels);

public sealed record ClipMediaInfo(double Duration, int Width, int Height, double Fps, List<AudioTrackInfo> AudioTracks);

/// <summary>What the editor needs to know about a clip: streams, waveforms and per-track preview audio.</summary>
public static partial class ClipMedia
{
    public static async Task<ClipMediaInfo> ProbeAsync(string path)
    {
        var (_, stderr) = await RunFfmpegAsync(new[] { "-hide_banner", "-nostdin", "-i", path });
        double duration = 0;
        var d = DurationRegex().Match(stderr);
        if (d.Success)
            duration = TimeSpan.Parse(d.Groups[1].Value, CultureInfo.InvariantCulture).TotalSeconds;

        int width = 0, height = 0;
        double fps = 0;
        var tracks = new List<AudioTrackInfo>();
        var lines = stderr.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            var m = StreamRegex().Match(lines[i]);
            if (!m.Success) continue;
            if (m.Groups[1].Value == "Video" && width == 0)
            {
                var size = SizeRegex().Match(m.Groups[2].Value);
                if (size.Success) { width = int.Parse(size.Groups[1].Value); height = int.Parse(size.Groups[2].Value); }
                var f = FpsRegex().Match(m.Groups[2].Value);
                if (f.Success) fps = double.Parse(f.Groups[1].Value, CultureInfo.InvariantCulture);
            }
            else if (m.Groups[1].Value == "Audio")
            {
                string desc = m.Groups[2].Value;
                int channels = desc.Contains("mono") ? 1 : desc.Contains("5.1") ? 6 : desc.Contains("7.1") ? 8 : 2;
                string title = "", handler = "";
                for (int j = i + 1; j < lines.Length && !lines[j].TrimStart().StartsWith("Stream #", StringComparison.Ordinal); j++)
                {
                    var t = TitleRegex().Match(lines[j]);
                    if (!t.Success) continue;
                    if (t.Groups[1].Value == "title") title = t.Groups[2].Value.Trim();
                    else handler = t.Groups[2].Value.Trim();
                }
                if (title.Length == 0 && !GenericHandlers.Contains(handler)) title = handler;
                tracks.Add(new AudioTrackInfo(tracks.Count, title, channels));
            }
        }
        return new ClipMediaInfo(duration, width, height, fps, tracks);
    }

    /// <summary>Peak level (0..1) per bucket for one audio track, drawn as the waveform in the Audio editor.</summary>
    public static async Task<float[]> WaveformAsync(string path, int audioIndex, double duration)
    {
        const int rate = 2000;
        var psi = NewFfmpeg(new[]
        {
            "-hide_banner", "-loglevel", "error", "-nostdin", "-i", path,
            "-map", $"0:a:{audioIndex}", "-ac", "1", "-ar", rate.ToString(CultureInfo.InvariantCulture), "-f", "s16le", "-",
        });
        psi.RedirectStandardOutput = true;
        using var proc = Process.Start(psi)!;
        try { proc.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
        _ = proc.StandardError.ReadToEndAsync();

        int buckets = (int)Math.Clamp(duration * 200, 50, 24000); // fine enough to zoom in on a single word
        long totalSamples = Math.Max(1, (long)(duration * rate));
        var peaks = new float[buckets];
        var buf = new byte[1 << 16];
        long sample = 0;
        int carry = -1;
        var stdout = proc.StandardOutput.BaseStream;
        int n;
        while ((n = await stdout.ReadAsync(buf)) > 0)
        {
            int i = 0;
            if (carry >= 0) { Accumulate((short)(carry | (buf[0] << 8))); carry = -1; i = 1; }
            for (; i + 1 < n; i += 2) Accumulate((short)(buf[i] | (buf[i + 1] << 8)));
            if (i < n) carry = buf[i];
        }
        await proc.WaitForExitAsync();
        return peaks.Select(p => MathF.Round(p, 3)).ToArray();

        void Accumulate(short s)
        {
            int b = (int)Math.Min(buckets - 1, sample * buckets / totalSamples);
            float v = Math.Abs(s / 32768f);
            if (v > peaks[b]) peaks[b] = v;
            sample++;
        }
    }

    /// <summary>
    /// Copies one audio track into its own small file (instant, no re-encode) so the editor can play desktop and mic
    /// separately. Cached in %LocalAppData%\Snappy\cache and served to the page as https://cache.snappy/&lt;name&gt;.
    /// </summary>
    public static async Task<string> PreviewAudioAsync(string path, int audioIndex)
    {
        var info = new FileInfo(path);
        string name = $"{info.Length:x}-{info.LastWriteTimeUtc.Ticks:x}-a{audioIndex}.m4a";
        string output = Path.Combine(CacheDir, name);
        if (File.Exists(output)) return name;

        string part = output + ".part.m4a";
        var (code, stderr) = await RunFfmpegAsync(new[]
        {
            "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", path,
            "-map", $"0:a:{audioIndex}", "-c", "copy", "-movflags", "+faststart", part,
        });
        if (code != 0) throw new InvalidOperationException($"Couldn't read audio track {audioIndex}: {stderr.Trim()}");
        File.Move(part, output, overwrite: true);
        return name;
    }

    public static string CacheDir
    {
        get
        {
            string dir = Path.Combine(AppPaths.LocalDataDir, "cache");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    /// <summary>Removes preview files nobody has used for a week.</summary>
    public static void PruneCache()
    {
        try
        {
            foreach (var f in new DirectoryInfo(CacheDir).EnumerateFiles())
                if (f.LastAccessTimeUtc < DateTime.UtcNow.AddDays(-7) && f.LastWriteTimeUtc < DateTime.UtcNow.AddDays(-7))
                    f.Delete();
        }
        catch { }
    }

    internal static ProcessStartInfo NewFfmpeg(IEnumerable<string> args)
    {
        var psi = new ProcessStartInfo(AppPaths.FfmpegExe)
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardInput = true,
        };
        psi.ArgumentList.Add("-protocol_whitelist");
        psi.ArgumentList.Add("file,pipe");
        foreach (string a in args) psi.ArgumentList.Add(a);
        return psi;
    }

    private static async Task<(int Code, string Stderr)> RunFfmpegAsync(IEnumerable<string> args)
    {
        using var proc = Process.Start(NewFfmpeg(args))!;
        string stderr = await proc.StandardError.ReadToEndAsync();
        await proc.WaitForExitAsync();
        return (proc.ExitCode, stderr);
    }

    [GeneratedRegex(@"Duration: (\d+:\d+:\d+(?:\.\d+)?)")] private static partial Regex DurationRegex();
    [GeneratedRegex(@"Stream #\d+:\d+(?:\[[^\]]*\])?(?:\([^)]*\))?: (Video|Audio): (.*)")] private static partial Regex StreamRegex();
    [GeneratedRegex(@"(\d{2,5})x(\d{2,5})")] private static partial Regex SizeRegex();
    [GeneratedRegex(@"([\d.]+) fps")] private static partial Regex FpsRegex();
    [GeneratedRegex(@"^\s*(title|handler_name)\s*:\s*(.*)$")] private static partial Regex TitleRegex();

    private static readonly HashSet<string> GenericHandlers = new(StringComparer.OrdinalIgnoreCase)
    {
        "", "SoundHandler", "VideoHandler", "Core Media Audio", "Core Media Video", "ISO Media file produced by Google Inc.",
    };
}
