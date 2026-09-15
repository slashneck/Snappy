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

    /// <summary>A way to record: which encoder, and whether frames can stay on the graphics card on the way there.</summary>
    public sealed record CaptureMode(string Encoder, bool OnGpu)
    {
        public string Label => OnGpu || Encoder == "libx264" ? Encoder : $"{Encoder} with copied frames";
    }

    /// <summary>
    /// Picks the requested encoder if this PC can run it, otherwise the best available one. The encoder of the graphics
    /// card the monitor is plugged into goes first, because only then can frames stay on that card.
    /// </summary>
    public static string ResolveEncoder(string preference, DisplayInfo? display = null)
    {
        if (preference != "auto" && Probe(preference)) return preference;
        if (preference != "auto") Log.Warn($"Encoder {preference} is not available on this PC, falling back");
        return AutoEncoderOrder.OrderBy(e => display != null && VendorOf(e) == display.VendorId ? 0 : 1).FirstOrDefault(Probe) ?? "libx264";
    }

    /// <summary>
    /// Ways to record, best first. Frames only stay on the GPU when the encoder belongs to the monitor's graphics card.
    /// On PCs with two graphics chips (a laptop, or a Ryzen CPU next to a GeForce card) the screen and the encoder
    /// often sit on different ones, and handing a texture across fails. The video engine moves down this list when a
    /// way keeps failing, ending with the CPU encoder.
    /// </summary>
    public static List<CaptureMode> CaptureModes(string encoder, DisplayInfo display)
    {
        var modes = new List<CaptureMode>();
        if (encoder != "libx264")
        {
            if (VendorOf(encoder) == display.VendorId) modes.Add(new CaptureMode(encoder, true));
            modes.Add(new CaptureMode(encoder, false));
        }
        modes.Add(new CaptureMode("libx264", false));
        return modes;
    }

    private static int VendorOf(string encoder) =>
        encoder.EndsWith("_nvenc", StringComparison.Ordinal) ? 0x10DE :
        encoder.EndsWith("_amf", StringComparison.Ordinal) ? 0x1002 : -1;

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

    public static string BuildCapture(AppSettings s, DisplayInfo display, CaptureMode mode, StudioPipeline? studio = null)
    {
        string Mbps(double v) => v.ToString("0.#", CultureInfo.InvariantCulture) + "M";
        int fps = s.Fps;
        string encoder = mode.Encoder;

        // Capture and scaling always happen on the monitor's graphics card. The frames then go straight to the encoder
        // as textures, or get copied to memory first: for another card's encoder, the CPU encoder, or Studio layers.
        bool onGpu = mode.OnGpu && studio == null;
        string graph = $"ddagrab=output_idx={display.OutputIndex}:framerate={fps}:draw_mouse={(s.CaptureCursor ? 1 : 0)}:dup_frames=1";
        var (w, h) = OutputSize(s, display);
        if (w != display.Width || h != display.Height) graph += $",scale_d3d11=width={w}:height={h}";
        if (!onGpu) graph += ",hwdownload,format=bgra";
        string last = "frames";
        if (studio != null)
        {
            graph += "[base]" + studio.Compose("base", "layered");
            last = "layered";
        }
        else
        {
            graph += "[frames]";
        }
        // From memory, NVENC takes BGRA as is while AMF wants NV12.
        graph += !onGpu && encoder.EndsWith("_amf", StringComparison.Ordinal) ? $";[{last}]format=nv12[v]" : $";[{last}]null[v]";

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
