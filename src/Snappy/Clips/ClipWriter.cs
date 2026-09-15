using System.Buffers;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using Snappy.Audio;
using Snappy.Core;
using Snappy.Library;
using Snappy.Video;

namespace Snappy.Clips;

public sealed record ClipResult(bool Success, string? FilePath, double DurationSeconds, string AppName, string? Error);

/// <summary>
/// Turns the RAM buffers into an .mp4: cuts video at a keyframe, cuts every audio track to the exact same
/// QPC time range, then lets FFmpeg remux (video is copied bit-for-bit, audio encoded to AAC).
/// This is the only moment Snappy writes to disk.
/// </summary>
public static class ClipWriter
{
    public static async Task<ClipResult> SaveAsync(VideoEngine video, AudioSource? desktop, AudioSource? mic,
        AppSettings settings, int seconds, string appName, IReadOnlyList<long>? markers = null, CancellationToken ct = default)
    {
        string tempDir = Path.Combine(Path.GetTempPath(), "Snappy", Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(tempDir);
            long endHns = Clock.NowHns();
            long wantedStart = endHns - Clock.SecondsToHns(seconds);

            string tsPath = Path.Combine(tempDir, "video.ts");
            var cut = WriteVideo(video, wantedStart, tsPath);
            if (cut == null) return new ClipResult(false, null, 0, appName, "Nothing has been recorded yet");

            var tracks = new List<(AudioSource Src, string Path, int VolumePercent)>();
            if (desktop != null)
            {
                string p = Path.Combine(tempDir, "desktop.wav");
                WriteWav(desktop, cut.Value.StartHns, cut.Value.EndHns, p);
                tracks.Add((desktop, p, settings.DesktopVolumePercent));
            }
            if (mic != null)
            {
                string p = Path.Combine(tempDir, "mic.wav");
                WriteWav(mic, cut.Value.StartHns, cut.Value.EndHns, p);
                tracks.Add((mic, p, settings.MicVolumePercent));
            }

            string folder = Path.Combine(settings.ClipsFolder, appName);
            Directory.CreateDirectory(folder);
            string finalPath = UniquePath(folder, $"{appName} {DateTime.Now:yyyy-MM-dd HH-mm-ss}", ".mp4");
            string partPath = finalPath + ".part";

            string? error = await MuxAsync(tsPath, tracks, settings.SeparateAudioTracks, video.EncoderName, partPath, ct);
            if (error != null)
            {
                TryDelete(partPath);
                return new ClipResult(false, null, 0, appName, error);
            }
            File.Move(partPath, finalPath);
            if (markers is { Count: > 0 })
            {
                var inClip = markers.Where(m => m >= cut.Value.StartHns && m <= cut.Value.EndHns)
                    .Select(m => Math.Round(Clock.HnsToSeconds(m - cut.Value.StartHns), 2))
                    .ToList();
                if (inClip.Count > 0) ClipMeta.Write(finalPath, new ClipMetaData { Markers = inClip });
            }
            double dur = Clock.HnsToSeconds(cut.Value.EndHns - cut.Value.StartHns);
            Log.Info($"Saved clip {finalPath} ({dur:F1}s)");
            return new ClipResult(true, finalPath, dur, appName, null);
        }
        catch (Exception ex)
        {
            Log.Error("Saving clip failed", ex);
            return new ClipResult(false, null, 0, appName, ex.Message);
        }
        finally
        {
            try { Directory.Delete(tempDir, recursive: true); } catch { }
        }
    }

    private static (long StartHns, long EndHns)? WriteVideo(VideoEngine video, long wantedStartHns, string path)
    {
        var entries = video.Ring.Snapshot();
        if (entries.Length == 0) return null;

        // Walk back from the newest frame while sessions stay format-compatible.
        var latest = video.GetSession(entries[^1].Session);
        if (latest == null) return null;
        int first = entries.Length - 1;
        while (first > 0)
        {
            var s = video.GetSession(entries[first - 1].Session);
            if (s == null || s.CodecKey != latest.CodecKey) break;
            first--;
        }

        // Start at the last keyframe at/before the requested start (so the clip is never shorter than asked).
        int start = -1;
        for (int i = first; i < entries.Length; i++)
        {
            if ((entries[i].Flags & RingArena.FlagKeyframe) == 0) continue;
            long t = video.GetSession(entries[i].Session)!.HostTimeHns(entries[i].Aux);
            if (t <= wantedStartHns || start < 0) start = i;
            if (t > wantedStartHns) break;
        }
        if (start < 0) return null;

        using var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 20);
        byte[] buf = ArrayPool<byte>.Shared.Rent(1 << 20);
        try
        {
            long clipStart = 0, clipEnd = 0, lastPts = long.MinValue;
            int continuity = 0, currentSession = -1;
            long delta90k = 0;
            bool wroteAny = false, needKeyframe = true;

            for (int i = start; i < entries.Length; i++)
            {
                var e = entries[i];
                var session = video.GetSession(e.Session);
                if (session == null) continue;
                if (needKeyframe && (e.Flags & RingArena.FlagKeyframe) == 0) continue;

                if (buf.Length < e.Length)
                {
                    ArrayPool<byte>.Shared.Return(buf);
                    buf = ArrayPool<byte>.Shared.Rent(e.Length);
                }
                if (!video.Ring.TryRead(e, buf))
                {
                    needKeyframe = true; // overwritten under us (only possible at the very oldest frames)
                    continue;
                }

                long host = session.HostTimeHns(e.Aux);
                if (!wroteAny)
                {
                    clipStart = host;
                    fs.Write(session.PatPacket ?? throw new InvalidOperationException("Stream headers missing"));
                    fs.Write(session.PmtPacket ?? throw new InvalidOperationException("Stream headers missing"));
                }
                if (e.Session != currentSession)
                {
                    // One constant shift per session: timeline = 1 s + (host time - clip start).
                    currentSession = e.Session;
                    delta90k = 90_000 + (session.OffsetHns - clipStart) * 9 / 1000;
                }

                long newPts = e.Aux + delta90k;
                if (newPts <= lastPts) continue; // overlap at a session boundary
                lastPts = newPts;

                TsDemuxer.RetimeAccessUnit(buf.AsSpan(0, e.Length), delta90k, ref continuity);
                fs.Write(buf, 0, e.Length);
                wroteAny = true;
                needKeyframe = false;
                clipEnd = host + e.DurationHns;
            }
            return wroteAny ? (clipStart, clipEnd) : null;
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buf);
        }
    }

    /// <summary>
    /// Lays audio chunks onto the clip timeline by their QPC timestamps. Gaps (e.g. loopback delivers nothing while
    /// the PC is silent) become silence; tiny jitter is ignored so the waveform stays continuous.
    /// </summary>
    private static void WriteWav(AudioSource src, long startHns, long endHns, string path)
    {
        int rate = AudioSource.SampleRate, ch = src.Channels, block = src.BlockAlign;
        long totalFrames = (endHns - startHns) * rate / Clock.HnsPerSecond;
        int tolerance = rate / 100; // 10 ms

        using var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 18);
        using (var w = new BinaryWriter(fs, Encoding.ASCII, leaveOpen: true))
        {
            long dataBytes = totalFrames * block;
            w.Write("RIFF"u8); w.Write((uint)(36 + dataBytes)); w.Write("WAVE"u8);
            w.Write("fmt "u8); w.Write(16); w.Write((short)1); w.Write((short)ch); w.Write(rate);
            w.Write(rate * block); w.Write((short)block); w.Write((short)16);
            w.Write("data"u8); w.Write((uint)dataBytes);
        }

        var entries = src.Ring.Snapshot(startHns - Clock.SecondsToHns(1));
        byte[] chunk = new byte[1 << 16];
        byte[] zeros = new byte[1 << 16];
        long written = 0;

        void Silence(long frames)
        {
            long bytes = Math.Min(frames, totalFrames - written) * block;
            while (bytes > 0)
            {
                int n = (int)Math.Min(bytes, zeros.Length);
                fs.Write(zeros, 0, n);
                bytes -= n;
            }
            written = Math.Min(totalFrames, written + frames);
        }

        foreach (var e in entries)
        {
            if (written >= totalFrames) break;
            if (e.Length > chunk.Length) chunk = new byte[e.Length];
            if (!src.Ring.TryRead(e, chunk)) continue;

            long frames = e.Length / block;
            long at = (e.TimeHns - startHns) * rate / Clock.HnsPerSecond;
            long skip = 0;
            long diff = at - written;
            if (diff > tolerance) Silence(diff);
            else if (diff < -tolerance) skip = -diff; // overlaps what we already wrote

            if (skip >= frames) continue;
            long take = Math.Min(frames - skip, totalFrames - written);
            if (take <= 0) break;
            fs.Write(chunk, (int)(skip * block), (int)(take * block));
            written += take;
        }
        if (written < totalFrames) Silence(totalFrames - written);
    }

    private static async Task<string?> MuxAsync(string tsPath, List<(AudioSource Src, string Path, int VolumePercent)> tracks,
        bool separateTracks, string encoder, string outPath, CancellationToken ct)
    {
        var psi = new ProcessStartInfo(AppPaths.FfmpegExe)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
        };
        var a = psi.ArgumentList;
        foreach (var s in new[] { "-hide_banner", "-loglevel", "error", "-nostdin", "-protocol_whitelist", "file,pipe", "-y", "-i", tsPath })
            a.Add(s);
        foreach (var t in tracks) { a.Add("-i"); a.Add(t.Path); }

        string Vol(int percent) => (percent / 100.0).ToString("0.###", CultureInfo.InvariantCulture);
        var labels = new List<(string Label, string Title)>();
        if (tracks.Count == 2)
        {
            string graph =
                $"[1:a]volume={Vol(tracks[0].VolumePercent)},asplit=2[d1][d2];" +
                $"[2:a]volume={Vol(tracks[1].VolumePercent)},aformat=channel_layouts=stereo,asplit=2[m1][m2];" +
                "[d1][m1]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.97:latency=1[mix]";
            if (!separateTracks) graph = graph.Replace(",asplit=2[d1][d2]", "[d1]").Replace(",asplit=2[m1][m2]", "[m1]");
            a.Add("-filter_complex"); a.Add(graph);
            labels.Add(("[mix]", "Desktop + Mic"));
            if (separateTracks) { labels.Add(("[d2]", "Desktop")); labels.Add(("[m2]", "Mic")); }
        }
        else if (tracks.Count == 1)
        {
            a.Add("-filter_complex"); a.Add($"[1:a]volume={Vol(tracks[0].VolumePercent)}[a0]");
            labels.Add(("[a0]", tracks[0].Src.Name == "mic" ? "Mic" : "Desktop"));
        }

        a.Add("-map"); a.Add("0:v");
        foreach (var l in labels) { a.Add("-map"); a.Add(l.Label); }
        a.Add("-c:v"); a.Add("copy");
        if (encoder.StartsWith("hevc", StringComparison.Ordinal)) { a.Add("-tag:v"); a.Add("hvc1"); }
        if (labels.Count > 0) { a.Add("-c:a"); a.Add("aac"); a.Add("-b:a"); a.Add("192k"); }
        for (int i = 0; i < labels.Count; i++)
        {
            a.Add($"-metadata:s:a:{i}"); a.Add($"title={labels[i].Title}");
            a.Add($"-metadata:s:a:{i}"); a.Add($"handler_name={labels[i].Title}"); // MP4 only keeps the track name here
            a.Add($"-disposition:a:{i}"); a.Add(i == 0 ? "default" : "0");
        }
        a.Add("-movflags"); a.Add("+faststart");
        a.Add("-f"); a.Add("mp4");
        a.Add(outPath);

        using var proc = Process.Start(psi)!;
        try { proc.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { } // never compete with the game
        Task<string> stderr = proc.StandardError.ReadToEndAsync(ct);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromMinutes(3));
        try
        {
            await proc.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            try { proc.Kill(true); } catch { }
            return "Saving took too long and was cancelled";
        }
        string err = (await stderr).Trim();
        return proc.ExitCode == 0 ? null : $"FFmpeg mux failed ({proc.ExitCode}): {err}";
    }

    private static string UniquePath(string folder, string baseName, string ext)
    {
        string p = Path.Combine(folder, baseName + ext);
        for (int i = 2; File.Exists(p); i++) p = Path.Combine(folder, $"{baseName} ({i}){ext}");
        return p;
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); } catch { }
    }
}
