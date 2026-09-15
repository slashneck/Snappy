using System.Globalization;
using System.Text;
using Snappy.Core;

namespace Snappy.Library;

/// <summary>
/// Joins clips into one video. Clips with different sizes or frame rates are scaled and padded to a common format;
/// transitions are either hard cuts or short crossfades. Only the first (mixed) audio track of each clip is used.
/// </summary>
public static class MontageBuilder
{
    public static async Task<string> BuildAsync(IReadOnlyList<string> clips, bool crossfade, string outputFolder, string encoder,
        IProgress<double>? progress, CancellationToken ct)
    {
        if (clips.Count < 2) throw new InvalidOperationException("Pick at least two clips for a montage.");
        var infos = new List<ClipMediaInfo>();
        foreach (string clip in clips) infos.Add(await ClipMedia.ProbeAsync(clip));

        int height = Math.Min(1440, infos.Max(i => i.Height)) & ~1;
        int width = (int)Math.Round(height * 16 / 9.0) & ~1;
        int fps = (int)Math.Clamp(Math.Round(infos.Max(i => i.Fps)), 24, 60);
        const double fade = 0.5;
        bool useFade = crossfade && infos.All(i => i.Duration > fade * 2 + 0.2);

        var args = new List<string> { "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-progress", "pipe:1", "-nostats" };
        foreach (string clip in clips) { args.Add("-i"); args.Add(clip); }

        string F(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
        var graph = new StringBuilder();
        for (int i = 0; i < clips.Count; i++)
        {
            graph.Append($"[{i}:v:0]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},format=yuv420p[v{i}];");
            graph.Append(infos[i].AudioTracks.Count > 0
                ? $"[{i}:a:0]aresample=48000,aformat=channel_layouts=stereo[a{i}];"
                : $"anullsrc=r=48000:cl=stereo,atrim=duration={F(infos[i].Duration)}[a{i}];");
        }

        double total;
        if (useFade)
        {
            string vPrev = "v0", aPrev = "a0";
            double offset = 0;
            for (int i = 1; i < clips.Count; i++)
            {
                offset += infos[i - 1].Duration - fade;
                string vOut = i == clips.Count - 1 ? "vout" : $"vx{i}", aOut = i == clips.Count - 1 ? "aout" : $"ax{i}";
                graph.Append($"[{vPrev}][v{i}]xfade=transition=fade:duration={F(fade)}:offset={F(offset)}[{vOut}];");
                graph.Append($"[{aPrev}][a{i}]acrossfade=d={F(fade)}[{aOut}];");
                vPrev = vOut;
                aPrev = aOut;
            }
            total = infos.Sum(i => i.Duration) - fade * (clips.Count - 1);
        }
        else
        {
            for (int i = 0; i < clips.Count; i++) graph.Append($"[v{i}][a{i}]");
            graph.Append($"concat=n={clips.Count}:v=1:a=1[vout][aout];");
            total = infos.Sum(i => i.Duration);
        }

        Directory.CreateDirectory(outputFolder);
        string output = LibraryService.UniquePath(outputFolder, $"Montage {DateTime.Now:yyyy-MM-dd HH-mm}", ".mp4");
        long bitrate = (long)clips.Select((c, i) => new FileInfo(c).Length * 8 / Math.Max(1, infos[i].Duration)).Average();

        args.AddRange(new[] { "-filter_complex", graph.ToString().TrimEnd(';'), "-map", "[vout]", "-map", "[aout]" });
        args.AddRange(EditExporter.VideoEncodeArgs(encoder, Math.Max(4_000_000, bitrate)));
        args.AddRange(new[] { "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-f", "mp4", output });

        Log.Info($"Building montage of {clips.Count} clips ({width}x{height}@{fps}, {(useFade ? "crossfade" : "cuts")})");
        await EditExporter.RunAsync(args, total, output, progress, ct);
        return output;
    }
}
