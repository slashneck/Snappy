using System.Globalization;
using Snappy.Core;

namespace Snappy.Library;

/// <summary>
/// Makes a copy of a clip (with the editor's changes) that fits under a file size, e.g. Discord's upload limit.
/// The bitrate is derived from the size budget. The frame rate is kept, so gameplay stays smooth: when the budget
/// is small the picture gets smaller instead, which looks far better than dropping half the frames. Small budgets
/// are encoded in two passes on the CPU, which gets the most out of every bit and lands right at the size.
/// Nothing is uploaded anywhere: the file is saved next to the clip.
/// </summary>
public static class ShrinkExporter
{
    private const int AudioBitrate = 128_000;
    private const long TwoPassBelow = 5_000_000;

    private sealed record Plan(int Height, int Fps, bool TwoPass);

    public static async Task<string> ExportAsync(string input, EditSpec edits, double targetMb, string encoder,
        IProgress<double>? progress, CancellationToken ct)
    {
        var info = await ClipMedia.ProbeAsync(input);
        double start = Math.Clamp(edits.Start, 0, Math.Max(0, info.Duration - 0.2));
        double end = edits.End <= 0 ? info.Duration : Math.Clamp(edits.End, start + 0.2, info.Duration);
        double duration = end - start;

        long budgetBits = (long)(targetMb * 1024 * 1024 * 8 * 0.94); // headroom for the MP4 container
        long videoBitrate = (long)((budgetBits - (long)(AudioBitrate * duration)) / duration);
        if (videoBitrate < 150_000)
            throw new InvalidOperationException($"This clip is too long to fit in {targetMb:0.#} MB. Trim it first.");

        string dir = Path.GetDirectoryName(input)!;
        string label = targetMb.ToString("0.#", CultureInfo.InvariantCulture);
        string output = LibraryService.UniquePath(dir, $"{Path.GetFileNameWithoutExtension(input)} ({label} MB)", ".mp4");
        long limitBytes = (long)(targetMb * 1024 * 1024);

        for (int attempt = 0; attempt < 3; attempt++)
        {
            var plan = PlanFor(videoBitrate, encoder, edits.Crop?.Width ?? info.Width, edits.Crop?.Height ?? info.Height, info.Fps);
            await EncodeAsync(input, info, edits, start, duration, videoBitrate, plan, encoder, output, progress, ct);
            long size = new FileInfo(output).Length;
            if (size <= limitBytes) return output;
            Log.Info($"Shrink attempt {attempt + 1} came out at {size / 1048576.0:0.00} MB, retrying lower");
            videoBitrate = (long)(videoBitrate * limitBytes / (double)size * 0.92);
        }
        EditExporter.TryDelete(output);
        throw new InvalidOperationException($"Couldn't get the clip under {targetMb:0.#} MB.");
    }

    /// <summary>
    /// The biggest picture the bitrate can fill well at the clip's own frame rate (up to 60). Only when even 360p is
    /// starved does the frame rate drop to 30.
    /// </summary>
    private static Plan PlanFor(long bitrate, string encoder, int width, int height, double sourceFps)
    {
        bool twoPass = bitrate < TwoPassBelow || encoder == "libx264";
        double enough = twoPass ? 0.035 : 0.045; // bits per pixel per frame that still look clean in gameplay
        double aspect = width / (double)Math.Max(1, height);
        int fps = (int)Math.Round(Math.Clamp(sourceFps > 1 ? sourceFps : 60, 24, 60));
        var heights = new[] { 1440, 1080, 900, 720, 540, 480, 360 }.Where(h => h < height).Prepend(Math.Min(height, 1440)).Distinct().ToList();
        foreach (int f in new[] { fps, Math.Min(fps, 30) }.Distinct())
            foreach (int h in heights)
                if (bitrate / (h * h * aspect * f) >= enough) return new Plan(h, f, twoPass);
        return new Plan(heights[^1], Math.Min(fps, 30), twoPass);
    }

    private static async Task EncodeAsync(string input, ClipMediaInfo info, EditSpec edits, double start, double duration,
        long videoBitrate, Plan plan, string encoder, string output, IProgress<double>? progress, CancellationToken ct)
    {
        string F(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
        int sourceHeight = edits.Crop?.Height ?? info.Height;
        var chain = new List<string>();
        if (edits.Crop is { } c) chain.Add($"crop={c.Width - c.Width % 2}:{c.Height - c.Height % 2}:{c.X}:{c.Y}");
        if (sourceHeight > plan.Height) chain.Add($"scale=-2:{plan.Height}:flags=lanczos");
        if (info.Fps > plan.Fps + 0.5) chain.Add($"fps={plan.Fps}");

        var filters = new List<string>();
        string videoMap = "0:v:0";
        if (chain.Count > 0)
        {
            filters.Add($"[0:v]{string.Join(',', chain)}[v]");
            videoMap = "[v]";
        }
        // Discord and most players only play the first track, so the copy keeps one: the mix, with the audio edits.
        string? audioMap = EditExporter.BuildMix(info, edits.Audio ?? new List<AudioLaneSpec>(), start, duration, filters);

        var input0 = new List<string> { "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-progress", "pipe:1", "-nostats",
            "-ss", F(start), "-t", F(duration), "-i", input };
        string rate = videoBitrate.ToString(CultureInfo.InvariantCulture);
        string[] x264 =
        {
            "-c:v", "libx264", "-preset", "slow", "-b:v", rate,
            "-maxrate", (videoBitrate * 11 / 10).ToString(CultureInfo.InvariantCulture),
            "-bufsize", (videoBitrate * 2).ToString(CultureInfo.InvariantCulture), "-pix_fmt", "yuv420p",
        };
        Log.Info($"Shrinking {input}: {F(duration)} s at {videoBitrate / 1000} kbps, {plan.Height}p{plan.Fps}" +
                 (plan.TwoPass ? ", two passes" : $", {encoder}"));

        string passLog = Path.Combine(Path.GetTempPath(), "Snappy", $"shrink-{Guid.NewGuid():N}");
        try
        {
            if (plan.TwoPass)
            {
                // The first pass only looks at the picture to learn where the bits are needed.
                Directory.CreateDirectory(Path.GetDirectoryName(passLog)!);
                var first = new List<string>(input0);
                if (chain.Count > 0) { first.Add("-vf"); first.Add(string.Join(',', chain)); }
                first.AddRange(new[] { "-map", "0:v:0" });
                first.AddRange(x264);
                first.AddRange(new[] { "-pass", "1", "-passlogfile", passLog, "-an", "-f", "null", "NUL" });
                await EditExporter.RunAsync(first, duration, "NUL", Scaled(progress, 0, 0.45), ct);
            }

            var args = new List<string>(input0);
            if (filters.Count > 0) { args.Add("-filter_complex"); args.Add(string.Join(';', filters)); }
            args.AddRange(new[] { "-map", videoMap });
            if (audioMap != null) { args.Add("-map"); args.Add(audioMap); }
            if (plan.TwoPass) args.AddRange(x264.Concat(new[] { "-pass", "2", "-passlogfile", passLog }));
            else args.AddRange(EditExporter.VideoEncodeArgs(encoder, videoBitrate, fixedBitrate: true));
            if (audioMap != null)
                args.AddRange(new[] { "-c:a", "aac", "-b:a", AudioBitrate.ToString(CultureInfo.InvariantCulture), "-ac", "2" });
            args.AddRange(new[] { "-movflags", "+faststart", "-f", "mp4", output });
            await EditExporter.RunAsync(args, duration, output, plan.TwoPass ? Scaled(progress, 0.45, 1) : progress, ct);
        }
        finally
        {
            foreach (string leftover in new[] { passLog + "-0.log", passLog + "-0.log.mbtree", passLog + "-0.log.temp", passLog + "-0.log.mbtree.temp" })
                EditExporter.TryDelete(leftover);
        }
    }

    private static IProgress<double>? Scaled(IProgress<double>? progress, double from, double to) =>
        progress == null ? null : new Progress<double>(p => progress.Report(from + (to - from) * p));
}
