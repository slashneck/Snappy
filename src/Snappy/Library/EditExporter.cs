using System.Diagnostics;
using System.Globalization;
using Snappy.Core;
using Snappy.Platform;

namespace Snappy.Library;

public sealed record CropSpec(int X, int Y, int Width, int Height);

/// <summary>Muted range in seconds on the source clip's timeline.</summary>
public sealed record RangeSpec(double Start, double End);

public sealed record AudioLaneSpec(int Track, double Volume, bool Muted, List<RangeSpec>? Mutes);

public sealed record EditSpec(double Start, double End, string Mode, bool Replace, CropSpec? Crop, List<AudioLaneSpec>? Audio);

/// <summary>
/// Applies the editor's changes in one FFmpeg pass: trim, crop and per-track audio edits (volume, mute, muted
/// ranges). The mixed track is rebuilt from the edited desktop and mic tracks. Video is copied when nothing
/// requires re-encoding.
/// </summary>
public static class EditExporter
{
    public static async Task<string> ExportAsync(string input, EditSpec spec, string encoder, IProgress<double>? progress, CancellationToken ct)
    {
        var info = await ClipMedia.ProbeAsync(input);
        double start = Math.Clamp(spec.Start, 0, Math.Max(0, info.Duration - 0.2));
        double end = spec.End <= 0 ? info.Duration : Math.Clamp(spec.End, start + 0.2, info.Duration);
        double duration = end - start;

        string dir = Path.GetDirectoryName(input)!;
        string title = Path.GetFileNameWithoutExtension(input);
        string output = spec.Replace
            ? Path.Combine(dir, $".{title}.editing.mp4")
            : LibraryService.UniquePath(dir, $"{title} (edit)", ".mp4");

        var crop = spec.Crop != null ? ClampCrop(spec.Crop, info) : null;
        bool encodeVideo = crop != null || spec.Mode == "precise";

        string F(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
        var args = new List<string> { "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-progress", "pipe:1", "-nostats",
            "-ss", F(start), "-t", F(duration), "-i", input };

        var filters = new List<string>();
        string videoMap = "0:v:0";
        if (crop != null)
        {
            filters.Add($"[0:v]crop={crop.Width}:{crop.Height}:{crop.X}:{crop.Y}[vout]");
            videoMap = "[vout]";
        }

        var audio = BuildAudio(info, spec.Audio ?? new List<AudioLaneSpec>(), start, duration, filters, out bool audioEdited);
        if (filters.Count > 0) { args.Add("-filter_complex"); args.Add(string.Join(';', filters)); }

        args.Add("-map"); args.Add(videoMap);
        foreach (var (map, _) in audio) { args.Add("-map"); args.Add(map); }

        if (encodeVideo)
        {
            long sourceBitrate = Math.Max(4_000_000, (long)(new FileInfo(input).Length * 8 / Math.Max(1, info.Duration)));
            args.AddRange(VideoEncodeArgs(encoder, sourceBitrate));
        }
        else
        {
            args.AddRange(new[] { "-c:v", "copy", "-avoid_negative_ts", "make_zero" });
        }
        AddAudioArgs(args, audio, audioEdited);
        args.AddRange(new[] { "-movflags", "+faststart", "-f", "mp4", output });

        Log.Info($"Exporting edit of {input}: {F(start)}..{F(end)} crop={crop != null} audioEdited={audioEdited} encodeVideo={encodeVideo}");
        await RunAsync(args, duration, output, progress, ct);

        ClipMeta.CopyTrimmed(input, output, start, end);
        if (!spec.Replace) return output;

        DateTime created = File.GetCreationTimeUtc(input);
        ShellOps.SendToRecycleBin(input);
        ClipMeta.RecycleWith(input);
        File.Move(output, input);
        ClipMeta.MoveWith(output, input);
        File.SetCreationTimeUtc(input, created);
        return input;
    }

    internal static void AddAudioArgs(List<string> args, List<(string Map, string Title)> audio, bool encode)
    {
        if (audio.Count == 0) return;
        args.AddRange(encode ? new[] { "-c:a", "aac", "-b:a", "192k" } : new[] { "-c:a", "copy" });
        for (int i = 0; i < audio.Count; i++)
        {
            if (audio[i].Title.Length > 0)
            {
                args.Add($"-metadata:s:a:{i}"); args.Add($"title={audio[i].Title}");
                args.Add($"-metadata:s:a:{i}"); args.Add($"handler_name={audio[i].Title}"); // MP4 keeps the track name here
            }
            args.Add($"-disposition:a:{i}"); args.Add(i == 0 ? "default" : "0");
        }
    }

    /// <summary>Runs FFmpeg with -progress on stdout. Deletes the output if anything goes wrong.</summary>
    internal static async Task RunAsync(List<string> args, double duration, string output, IProgress<double>? progress, CancellationToken ct)
    {
        var psi = ClipMedia.NewFfmpeg(args);
        psi.RedirectStandardOutput = true;
        using var proc = Process.Start(psi)!;
        try { proc.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
        proc.StandardInput.Close();
        Task<string> stderr = proc.StandardError.ReadToEndAsync();

        try
        {
            string? line;
            while ((line = await proc.StandardOutput.ReadLineAsync(ct)) != null)
            {
                if (line.StartsWith("out_time_us=", StringComparison.Ordinal) && long.TryParse(line.AsSpan(12), out long us))
                    progress?.Report(Math.Clamp(us / 1_000_000.0 / Math.Max(0.1, duration), 0, 0.99));
            }
            await proc.WaitForExitAsync(ct);
        }
        catch
        {
            try { proc.Kill(true); } catch { }
            TryDelete(output);
            throw;
        }

        string err = (await stderr).Trim();
        if (proc.ExitCode != 0)
        {
            TryDelete(output);
            throw new InvalidOperationException($"FFmpeg failed: {err}");
        }
        progress?.Report(1);
    }

    /// <summary>
    /// Snappy clips carry [Desktop + Mic, Desktop, Mic]. Edits apply to the desktop and mic tracks and the first
    /// track is mixed again from them. Any other layout gets each track edited on its own.
    /// </summary>
    private static List<(string Map, string Title)> BuildAudio(ClipMediaInfo info, List<AudioLaneSpec> lanes, double start, double duration,
        List<string> filters, out bool edited)
    {
        var result = new List<(string, string)>();
        edited = lanes.Any(IsEdited);
        if (!edited)
        {
            foreach (var t in info.AudioTracks) result.Add(($"0:a:{t.Index}", t.Title));
            return result;
        }

        AudioLaneSpec LaneFor(int track) => lanes.FirstOrDefault(l => l.Track == track) ?? new AudioLaneSpec(track, 1, false, null);

        var programs = ProgramTracks(info);
        if (programs.Count > 1)
        {
            // The programs (and the mic) are the whole sound, so the first track is mixed again from them.
            var mixIn = new List<string>();
            foreach (var t in programs)
            {
                filters.Add($"[0:a:{t.Index}]{LaneFilter(LaneFor(t.Index), start, duration)},asplit=2[ap{t.Index}m][ap{t.Index}s]");
                mixIn.Add($"[ap{t.Index}m]");
                result.Add(($"[ap{t.Index}s]", t.Title));
            }
            filters.Add($"{string.Concat(mixIn)}amix=inputs={mixIn.Count}:normalize=0:duration=longest," +
                        "alimiter=limit=0.97:latency=1[amix]");
            result.Insert(0, ("[amix]", "Mix"));
            return result;
        }

        var (desktop, mic) = FindDesktopAndMic(info);
        if (desktop != null && mic != null)
        {
            filters.Add($"[0:a:{desktop.Index}]{LaneFilter(LaneFor(desktop.Index), start, duration)},asplit=2[ad1][ad2]");
            filters.Add($"[0:a:{mic.Index}]{LaneFilter(LaneFor(mic.Index), start, duration)},aformat=channel_layouts=stereo,asplit=2[am1][am2]");
            filters.Add("[ad1][am1]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.97:latency=1[amix]");
            result.Add(("[amix]", "Desktop + Mic"));
            result.Add(("[ad2]", "Desktop"));
            result.Add(("[am2]", "Mic"));
            return result;
        }

        foreach (var t in info.AudioTracks)
        {
            filters.Add($"[0:a:{t.Index}]{LaneFilter(LaneFor(t.Index), start, duration)}[a{t.Index}]");
            result.Add(($"[a{t.Index}]", t.Title));
        }
        return result;
    }

    /// <summary>The per-program tracks of a clip that was split by program, with the mic if there is one.</summary>
    internal static List<AudioTrackInfo> ProgramTracks(ClipMediaInfo info)
    {
        bool IsMix(AudioTrackInfo t) => t.Title.Contains('+') || t.Title.Equals("Mix", StringComparison.OrdinalIgnoreCase);
        var programs = info.AudioTracks
            .Where(t => t.Title.Length > 0 && !IsMix(t)
                        && !t.Title.Equals("Desktop", StringComparison.OrdinalIgnoreCase)
                        && !t.Title.Equals("Mic", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (programs.Count == 0) return programs;
        var mic = info.AudioTracks.FirstOrDefault(t => t.Title.Equals("Mic", StringComparison.OrdinalIgnoreCase));
        if (mic != null) programs.Add(mic);
        return programs;
    }

    internal static (AudioTrackInfo? Desktop, AudioTrackInfo? Mic) FindDesktopAndMic(ClipMediaInfo info)
    {
        var desktop = info.AudioTracks.FirstOrDefault(t => t.Title.Equals("Desktop", StringComparison.OrdinalIgnoreCase));
        var mic = info.AudioTracks.FirstOrDefault(t => t.Title.Equals("Mic", StringComparison.OrdinalIgnoreCase));
        if ((desktop == null || mic == null) && info.AudioTracks.Count == 3 && info.AudioTracks.All(t => t.Title.Length == 0))
        {
            // Older clips were saved without track names, but the layout is always [mix, desktop, mic].
            desktop = info.AudioTracks[1];
            mic = info.AudioTracks[2];
        }
        return (desktop, mic);
    }

    private static bool IsEdited(AudioLaneSpec l) => l.Muted || Math.Abs(l.Volume - 1) > 0.001 || (l.Mutes?.Count ?? 0) > 0;

    private static string LaneFilter(AudioLaneSpec lane, double start, double duration)
    {
        string F(double v) => v.ToString("0.###", CultureInfo.InvariantCulture);
        var parts = new List<string> { $"volume={F(lane.Muted ? 0 : Math.Clamp(lane.Volume, 0, 4))}" };
        var ranges = (lane.Mutes ?? new List<RangeSpec>())
            .Select(m => (A: Math.Max(0, m.Start - start), B: Math.Min(duration, m.End - start)))
            .Where(r => r.B > r.A)
            .Select(r => $"between(t,{F(r.A)},{F(r.B)})")
            .ToList();
        if (ranges.Count > 0) parts.Add($"volume=enable='{string.Join('+', ranges)}':volume=0");
        return string.Join(',', parts);
    }

    private static CropSpec? ClampCrop(CropSpec c, ClipMediaInfo info)
    {
        if (info.Width <= 0 || info.Height <= 0) return null;
        int x = Math.Clamp(c.X, 0, info.Width - 32), y = Math.Clamp(c.Y, 0, info.Height - 32);
        int w = Math.Clamp(c.Width, 32, info.Width - x), h = Math.Clamp(c.Height, 32, info.Height - y);
        w -= w % 2;
        h -= h % 2;
        if (x == 0 && y == 0 && w >= info.Width - 1 && h >= info.Height - 1) return null;
        return new CropSpec(x, y, w, h);
    }

    internal static string[] VideoEncodeArgs(string encoder, long bitrate, bool fixedBitrate = false)
    {
        string rate = bitrate.ToString(CultureInfo.InvariantCulture);
        string maxrate = (fixedBitrate ? bitrate * 11 / 10 : bitrate * 3 / 2).ToString(CultureInfo.InvariantCulture);
        string bufsize = (bitrate * 2).ToString(CultureInfo.InvariantCulture);
        var args = encoder switch
        {
            "h264_nvenc" or "hevc_nvenc" or "av1_nvenc" => fixedBitrate
                ? new List<string> { "-c:v", encoder, "-preset", "p6", "-rc", "vbr", "-multipass", "fullres", "-b:v", rate, "-maxrate", maxrate, "-bufsize", bufsize, "-pix_fmt", "yuv420p" }
                : new List<string> { "-c:v", encoder, "-preset", "p5", "-rc", "vbr", "-cq", "19", "-b:v", "0", "-maxrate", maxrate, "-bufsize", maxrate, "-pix_fmt", "yuv420p" },
            "h264_amf" or "hevc_amf" => new List<string> { "-c:v", encoder, "-quality", "quality", "-rc", "vbr_peak", "-b:v", rate, "-maxrate", maxrate },
            _ => fixedBitrate
                ? new List<string> { "-c:v", "libx264", "-preset", "medium", "-b:v", rate, "-maxrate", maxrate, "-bufsize", bufsize, "-pix_fmt", "yuv420p" }
                : new List<string> { "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p" },
        };
        if (encoder.StartsWith("hevc", StringComparison.Ordinal)) args.AddRange(new[] { "-tag:v", "hvc1" });
        return args.ToArray();
    }

    internal static void TryDelete(string path)
    {
        try { File.Delete(path); } catch { }
    }
}
