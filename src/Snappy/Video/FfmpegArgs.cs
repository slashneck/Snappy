using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using Snappy.Core;
using Snappy.Studio;

namespace Snappy.Video;

public static class FfmpegArgs
{
    public static readonly string[] AutoEncoderOrder = { "h264_nvenc", "h264_amf", "libx264" };
    private static readonly ConcurrentDictionary<string, bool> ProbeCache = new();

    /// <summary>Picks the requested encoder if this PC can run it, otherwise the best available hardware encoder.</summary>
    public static string ResolveEncoder(string preference)
    {
        if (preference != "auto" && Probe(preference)) return preference;
        if (preference != "auto") Log.Warn($"Encoder {preference} is not available on this PC, falling back");
        return AutoEncoderOrder.FirstOrDefault(Probe) ?? "libx264";
    }

    public static bool Probe(string encoder) => ProbeCache.GetOrAdd(encoder, enc =>
    {
        try
        {
            var psi = new ProcessStartInfo(AppPaths.FfmpegExe,
                $"-hide_banner -loglevel error -nostdin -f lavfi -i color=black:s=640x360:r=30 -frames:v 3 -c:v {enc} -f null -")
            {
                UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true,
            };
            using var p = Process.Start(psi)!;
            p.StandardError.ReadToEnd();
            bool ok = p.WaitForExit(15_000) && p.ExitCode == 0;
            Log.Info($"Encoder probe {enc}: {(ok ? "available" : "not available")}");
            return ok;
        }
        catch (Exception ex)
        {
            Log.Error($"Encoder probe {enc} failed", ex);
            return false;
        }
    });

    /// <summary>Size of the recorded frames after the optional downscale.</summary>
    public static (int Width, int Height) OutputSize(AppSettings s, DisplayInfo display)
    {
        if (s.OutputHeight <= 0 || s.OutputHeight >= display.Height) return (display.Width, display.Height);
        int h = s.OutputHeight & ~1;
        return ((int)Math.Round(display.Width * (double)h / display.Height / 2) * 2, h);
    }

    public static string BuildCapture(AppSettings s, DisplayInfo display, string encoder, StudioPipeline? studio = null)
    {
        string Mbps(double v) => v.ToString("0.#", CultureInfo.InvariantCulture) + "M";
        int fps = s.Fps;

        // Without Studio layers the frames never leave the GPU: ddagrab (D3D11 texture), optional GPU scale, hardware encoder.
        string graph = $"ddagrab=output_idx={display.OutputIndex}:framerate={fps}:draw_mouse={(s.CaptureCursor ? 1 : 0)}:dup_frames=1";
        var (w, h) = OutputSize(s, display);
        if (w != display.Width || h != display.Height) graph += $",scale_d3d11=width={w}:height={h}";
        bool cpuEncoder = encoder == "libx264";
        if (cpuEncoder || studio != null) graph += ",hwdownload,format=bgra";
        if (studio != null)
        {
            // Layers are blended on the CPU. NVENC takes BGRA as is, AMF wants NV12.
            graph += "[base]" + studio.Compose("base", "layered");
            graph += encoder.EndsWith("_amf", StringComparison.Ordinal) ? ";[layered]format=nv12[v]" : ";[layered]null[v]";
        }
        else
        {
            graph += "[v]";
        }

        var args = new List<string> { "-hide_banner", "-loglevel", "warning", "-nostdin" };
        if (studio != null) args.AddRange(studio.InputArgs);
        args.AddRange(new[]
        {
            "-protocol_whitelist", "file,pipe", // FFmpeg may only touch local files and our pipes, never the network
            "-init_hw_device", $"d3d11va=snappy:{display.AdapterIndex}", "-filter_hw_device", "snappy",
            "-filter_complex", $"\"{graph}\"",
            "-map", "[v]", "-fps_mode", "cfr", "-r", fps.ToString(CultureInfo.InvariantCulture),
        });

        double b = s.BitrateMbps;
        string gop = fps.ToString(CultureInfo.InvariantCulture); // keyframe every second => clips start within 1 s of the request
        switch (encoder)
        {
            case "h264_nvenc":
            case "hevc_nvenc":
            case "av1_nvenc":
                args.AddRange(new[]
                {
                    "-c:v", encoder, "-preset", "p4", "-tune", "hq", "-rc", "vbr", "-multipass", "disabled",
                    "-b:v", Mbps(b), "-maxrate", Mbps(b * 1.25), "-bufsize", Mbps(b * 2),
                    "-bf", "0", "-g", gop, "-forced-idr", "1", "-spatial-aq", "1", "-delay", "0",
                });
                break;
            case "h264_amf":
            case "hevc_amf":
                args.AddRange(new[]
                {
                    "-c:v", encoder, "-quality", "balanced", "-rc", "vbr_peak",
                    "-b:v", Mbps(b), "-maxrate", Mbps(b * 1.25), "-bufsize", Mbps(b * 2), "-g", gop,
                });
                if (encoder == "h264_amf") args.AddRange(new[] { "-bf", "0" });
                break;
            default:
                args.AddRange(new[]
                {
                    "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
                    "-b:v", Mbps(b), "-maxrate", Mbps(b * 1.25), "-bufsize", Mbps(b * 2), "-bf", "0", "-g", gop,
                });
                break;
        }

        args.AddRange(new[]
        {
            "-an", "-sn", "-dn",
            "-flush_packets", "1", "-muxdelay", "0", "-muxpreload", "0",
            "-mpegts_flags", "+resend_headers", "-f", "mpegts", "pipe:1",
        });
        return string.Join(' ', args);
    }
}
