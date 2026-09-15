using System.Diagnostics;
using System.Globalization;
using Snappy.Core;
using Snappy.Platform;

namespace Snappy.Library;

public enum TrimMode
{
    /// <summary>Lossless and instant; the cut snaps to the nearest keyframe (Snappy records one every second).</summary>
    Fast,
    /// <summary>Frame-exact; re-encodes on the GPU.</summary>
    Precise,
}

public static class ClipTrimmer
{
    /// <summary>Trims a clip and returns the path of the result (a new file, or the original path when replacing).</summary>
    public static async Task<string> TrimAsync(string input, double start, double end, TrimMode mode, bool replaceOriginal,
        string encoder, IProgress<double>? progress, CancellationToken ct)
    {
        if (end - start < 0.2) throw new InvalidOperationException("The trimmed clip must be at least 0.2 seconds long");
        string dir = Path.GetDirectoryName(input)!;
        string title = Path.GetFileNameWithoutExtension(input);
        string output = replaceOriginal
            ? Path.Combine(dir, $".{title}.trimming.mp4")
            : LibraryService.UniquePath(dir, $"{title} (trim)", ".mp4");

        string F(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
        double duration = end - start;
        var args = new List<string>
        {
            "-hide_banner", "-loglevel", "error", "-nostdin", "-protocol_whitelist", "file,pipe", "-y",
            "-progress", "pipe:1", "-nostats",
            "-ss", F(start), "-i", input, "-t", F(duration), "-map", "0", "-dn", "-sn",
        };

        if (mode == TrimMode.Fast)
        {
            args.AddRange(new[] { "-c", "copy", "-avoid_negative_ts", "make_zero" });
        }
        else
        {
            long sourceBitrate = Math.Max(4_000_000, (long)(new FileInfo(input).Length * 8 / Math.Max(1, Mp4Info.Read(input)?.DurationSeconds ?? 1)));
            string maxrate = (sourceBitrate * 3 / 2).ToString(CultureInfo.InvariantCulture);
            args.AddRange(encoder switch
            {
                "h264_nvenc" or "hevc_nvenc" or "av1_nvenc" => new[] { "-c:v", encoder, "-preset", "p5", "-rc", "vbr", "-cq", "19", "-b:v", "0", "-maxrate", maxrate, "-bufsize", maxrate },
                "h264_amf" or "hevc_amf" => new[] { "-c:v", encoder, "-quality", "quality", "-rc", "vbr_peak", "-b:v", sourceBitrate.ToString(CultureInfo.InvariantCulture), "-maxrate", maxrate },
                _ => new[] { "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p" },
            });
            if (encoder.StartsWith("hevc", StringComparison.Ordinal)) args.AddRange(new[] { "-tag:v", "hvc1" });
            args.AddRange(new[] { "-c:a", "aac", "-b:a", "192k" });
        }
        args.AddRange(new[] { "-movflags", "+faststart", "-f", "mp4", output });

        var psi = new ProcessStartInfo(AppPaths.FfmpegExe)
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true,
        };
        foreach (string a in args) psi.ArgumentList.Add(a);
        Log.Info($"Trimming {input} [{F(start)}..{F(end)}] mode={mode} replace={replaceOriginal}");

        using var proc = Process.Start(psi)!;
        try { proc.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
        Task<string> stderr = proc.StandardError.ReadToEndAsync();

        try
        {
            string? line;
            while ((line = await proc.StandardOutput.ReadLineAsync(ct)) != null)
            {
                if (line.StartsWith("out_time_us=", StringComparison.Ordinal)
                    && long.TryParse(line.AsSpan(12), out long us))
                    progress?.Report(Math.Clamp(us / 1_000_000.0 / duration, 0, 1));
            }
            await proc.WaitForExitAsync(ct);
        }
        catch (OperationCanceledException)
        {
            try { proc.Kill(true); } catch { }
            TryDelete(output);
            throw;
        }

        string err = (await stderr).Trim();
        if (proc.ExitCode != 0)
        {
            TryDelete(output);
            throw new InvalidOperationException($"Trim failed: {err}");
        }
        progress?.Report(1);

        if (!replaceOriginal) return output;

        // Replace: the untrimmed original goes to the Recycle Bin (so it can be restored), the trim takes its name.
        DateTime created = File.GetCreationTimeUtc(input);
        ShellOps.SendToRecycleBin(input);
        File.Move(output, input);
        File.SetCreationTimeUtc(input, created);
        return input;
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); } catch { }
    }
}
