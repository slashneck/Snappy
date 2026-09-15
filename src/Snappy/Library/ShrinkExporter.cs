using System.Globalization;
using Snappy.Core;

namespace Snappy.Library;

/// <summary>
/// Makes a copy of a clip (with the editor's changes) that fits under a file size, e.g. Discord's upload limit.
/// The bitrate is derived from the size budget; resolution and frame rate drop when the budget is too small to
/// look good at full size. Nothing is uploaded anywhere: the file is saved next to the clip.
/// </summary>
public static class ShrinkExporter
{
    private const int AudioBitrate = 128_000;

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
            await EncodeAsync(input, info, edits, start, duration, videoBitrate, encoder, output, progress, ct);
            long size = new FileInfo(output).Length;
            if (size <= limitBytes) return output;
            Log.Info($"Shrink attempt {attempt + 1} came out at {size / 1048576.0:0.00} MB, retrying lower");
            videoBitrate = (long)(videoBitrate * limitBytes / (double)size * 0.92);
        }
        EditExporter.TryDelete(output);
        throw new InvalidOperationException($"Couldn't get the clip under {targetMb:0.#} MB.");
    }

    private static async Task EncodeAsync(string input, ClipMediaInfo info, EditSpec edits, double start, double duration,
        long videoBitrate, string encoder, string output, IProgress<double>? progress, CancellationToken ct)
    {
        int sourceHeight = edits.Crop?.Height ?? info.Height;
        int maxHeight = videoBitrate switch
        {
            < 800_000 => 480,
            < 1_800_000 => 720,
            < 5_000_000 => 1080,
            _ => 1440,
        };
        bool lowerFps = videoBitrate < 1_500_000 && info.Fps > 31;

        string F(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
        var chain = new List<string>();
        if (edits.Crop is { } c) chain.Add($"crop={c.Width - c.Width % 2}:{c.Height - c.Height % 2}:{c.X}:{c.Y}");
        if (sourceHeight > maxHeight) chain.Add($"scale=-2:{maxHeight}:flags=lanczos");
        if (lowerFps) chain.Add("fps=30");

        var args = new List<string> { "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-progress", "pipe:1", "-nostats",
            "-ss", F(start), "-t", F(duration), "-i", input };
        if (chain.Count > 0) { args.Add("-vf"); args.Add(string.Join(',', chain)); }

        // Discord and most players only play the first audio track, so the copy keeps just the mix.
        args.AddRange(new[] { "-map", "0:v:0", "-map", "0:a:0?" });
        args.AddRange(EditExporter.VideoEncodeArgs(encoder, videoBitrate, fixedBitrate: true));
        args.AddRange(new[] { "-c:a", "aac", "-b:a", AudioBitrate.ToString(CultureInfo.InvariantCulture), "-ac", "2",
            "-movflags", "+faststart", "-f", "mp4", output });

        Log.Info($"Shrinking {input}: {F(duration)} s at {videoBitrate / 1000} kbps, max {maxHeight}p{(lowerFps ? ", 30 fps" : "")}");
        await EditExporter.RunAsync(args, duration, output, progress, ct);
    }
}
