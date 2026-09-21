using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using Snappy.Core;
using Snappy.Studio;

namespace Snappy.Video;

public static class FfmpegArgs
{
    public static readonly string[] AutoEncoderOrder = { "h264_nvenc", "h264_amf", "h264_qsv", "libx264" };
    private static readonly ConcurrentDictionary<string, bool> ProbeCache = new();

    /// <summary>
    /// A way to record: how the screen is grabbed, which encoder compresses it, and whether frames can stay on the
    /// graphics card on the way there.
    /// </summary>
    public sealed record CaptureMode(string Encoder, bool OnGpu, bool Wgc = false)
    {
        public string Label =>
            (Wgc ? "Windows Graphics Capture, " : "Desktop Duplication, ") +
            (OnGpu || Encoder == "libx264" ? Encoder : $"{Encoder} with copied frames");
    }

    /// <summary>
    /// Windows Graphics Capture stamps every frame with the moment it reached the screen, which makes clips
    /// perfectly even. It only runs without a yellow frame around the screen on Windows 11.
    /// </summary>
    public static bool WgcAvailable { get; } = Environment.OSVersion.Version.Build >= 22000;

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
        var ways = new List<CaptureMode>();
        if (encoder != "libx264")
        {
            // Intel's encoder only gets copied frames: handing it textures needs a device mapping that isn't reliable
            // across driver versions, and a copy on an integrated chip is cheap because it shares memory anyway.
            if (VendorOf(encoder) == display.VendorId && !IsQsv(encoder)) ways.Add(new CaptureMode(encoder, true));
            ways.Add(new CaptureMode(encoder, false));
        }
        ways.Add(new CaptureMode("libx264", false));

        // Every way is tried with Windows Graphics Capture first, then with Desktop Duplication, which works everywhere.
        if (!WgcAvailable) return ways;
        var modes = new List<CaptureMode>();
        foreach (var way in ways)
        {
            modes.Add(way with { Wgc = true });
            modes.Add(way);
        }
        return modes;
    }

    private static int VendorOf(string encoder) =>
        encoder.EndsWith("_nvenc", StringComparison.Ordinal) ? 0x10DE :
        encoder.EndsWith("_amf", StringComparison.Ordinal) ? 0x1002 :
        IsQsv(encoder) ? 0x8086 : -1;

    private static bool IsQsv(string encoder) => encoder.EndsWith("_qsv", StringComparison.Ordinal);

    /// <summary>
    /// Whether this way of recording keeps frames on the graphics card all the way to the encoder. Only then is
    /// FFmpeg's own CPU use small enough to run it above normal priority; everything else has to share the processor
    /// fairly with the game. Studio layers are drawn in memory, and so is a lower resolution without Windows Graphics
    /// Capture: FFmpeg's own graphics card scaler can't create its textures on many drivers.
    /// </summary>
    public static bool FramesStayOnGpu(AppSettings s, DisplayInfo display, CaptureMode mode, bool studio) =>
        mode.OnGpu && !studio && (mode.Wgc || !Downscales(s, display));

    private static bool Downscales(AppSettings s, DisplayInfo display)
    {
        var (w, h) = OutputSize(s, display);
        return w != display.Width || h != display.Height;
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

    public static string BuildCapture(AppSettings s, DisplayInfo display, CaptureMode mode, StudioPipeline? studio = null,
        string output = "pipe:1")
    {
        string Mbps(double v) => v.ToString("0.#", CultureInfo.InvariantCulture) + "M";
        int fps = s.Fps;
        string encoder = mode.Encoder;

        // Capture and scaling always happen on the monitor's graphics card. The frames then go straight to the encoder
        // as textures, or get copied to memory first: for another card's encoder, the CPU encoder, or Studio layers.
        bool onGpu = FramesStayOnGpu(s, display, mode, studio != null);
        var (w, h) = OutputSize(s, display);
        bool downscale = Downscales(s, display);
        // The screen is grabbed as often as it changes, and the fps filter then picks, for every frame of the clip,
        // the screen image that was showing at that exact moment. Grabbing at the clip's own rate instead lets the
        // grabber's timing drift, which shows up as repeated and skipped frames.
        int cursor = s.CaptureCursor ? 1 : 0;
        string graph = mode.Wgc
            ? $"gfxcapture=hmonitor={(ulong)Displays.MonitorHandle(display)}:max_framerate={Math.Max(240, fps * 2)}:capture_cursor={cursor}"
            : $"ddagrab=output_idx={display.OutputIndex}:framerate={Math.Max(240, fps)}:draw_mouse={cursor}:dup_frames=0";
        // Windows Graphics Capture scales on the graphics card while it grabs.
        if (mode.Wgc && downscale) graph += $":width={w}:height={h}:resize_mode=scale_aspect:scale_mode=bicubic";
        graph += $",fps={fps}";
        if (!onGpu) graph += ",hwdownload,format=bgra";
        if (!mode.Wgc && downscale) graph += $",scale={w}:{h}:flags=bilinear";
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
        // From memory, NVENC takes BGRA as is while AMF and Quick Sync want NV12.
        bool wantsNv12 = encoder.EndsWith("_amf", StringComparison.Ordinal) || IsQsv(encoder);
        graph += !onGpu && wantsNv12 ? $";[{last}]format=nv12[v]" : $";[{last}]null[v]";

        var args = new List<string> { "-hide_banner", "-loglevel", "warning", "-nostdin" };
        // Frames that go through memory get two filter threads. FFmpeg would otherwise start one per CPU core, and
        // every one of them is a thread the game has to share its cores with.
        if (!onGpu) args.AddRange(new[] { "-filter_complex_threads", "2" });
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
            case "h264_qsv":
            case "hevc_qsv":
                args.AddRange(new[]
                {
                    "-c:v", encoder, "-preset", "veryfast",
                    "-b:v", Mbps(b), "-maxrate", Mbps(b * 1.25), "-bufsize", Mbps(b * 2), "-g", gop, "-bf", "0",
                });
                break;
            default:
                // superfast rather than veryfast: about a third less CPU for slightly bigger files, which is the right
                // trade on a PC that has no graphics card encoder and is running a game at the same time.
                args.AddRange(new[]
                {
                    "-c:v", "libx264", "-preset", "superfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p",
                    "-b:v", Mbps(b), "-maxrate", Mbps(b * 1.25), "-bufsize", Mbps(b * 2), "-bf", "0", "-g", gop,
                });
                break;
        }

        args.AddRange(new[]
        {
            "-an", "-sn", "-dn",
            "-flush_packets", "1", "-muxdelay", "0", "-muxpreload", "0",
            "-mpegts_flags", "+resend_headers", "-f", "mpegts", "-y", $"\"{output}\"",
        });
        return string.Join(' ', args);
    }
}
