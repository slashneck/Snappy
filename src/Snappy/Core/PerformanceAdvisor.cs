using Snappy.Studio;
using Snappy.Video;

namespace Snappy.Core;

/// <summary>A hint shown in Settings. Setting is the row it belongs to, or empty for the general list.</summary>
public sealed record Advice(string Setting, string Level, string Text);

/// <summary>
/// Looks at this PC and the current settings and points out combinations that are likely to cost frames in games.
/// Everything here is a hint, never a block: Snappy records the same either way.
/// </summary>
public static class PerformanceAdvisor
{
    public static List<Advice> For(AppSettings s, string encoder, StudioScene? liveScene)
    {
        var list = new List<Advice>();
        var display = Displays.Resolve(s.MonitorDeviceName);
        int threads = Environment.ProcessorCount;
        long ram = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
        var (w, h) = display != null ? FfmpegArgs.OutputSize(s, display) : (1920, 1080);
        long pixels = (long)w * h;
        bool cpuEncoder = encoder == "libx264";
        bool gpuEncoderExists = FfmpegArgs.AutoEncoderOrder.Any(e => e != "libx264" && FfmpegArgs.Probe(e));

        if (cpuEncoder && s.Encoder == "libx264" && gpuEncoderExists)
            list.Add(new("encoder", "warn",
                "Your graphics card can record too, and it's far lighter than the CPU encoder. Automatic picks it."));
        else if (cpuEncoder)
            list.Add(new("encoder", "warn",
                "No graphics card encoder was found, so your processor does the recording. In CPU-heavy games like " +
                "Fortnite or Apex that costs frames. 1080p or 720p at 60 fps keeps it manageable."));
        else if (display != null && !FfmpegArgs.CaptureModes(encoder, display).Any(m => m.OnGpu))
            list.Add(new("encoder", "info", encoder.EndsWith("_qsv", StringComparison.Ordinal)
                ? "Intel Quick Sync gets its frames through memory, which costs a little CPU."
                : $"Your monitor runs on {display.AdapterName}, and the encoder sits on the other graphics chip, so every " +
                  "frame is copied between them through the CPU. Plugging the monitor into the card that encodes avoids that."));

        if (s.Fps >= 120)
            list.Add(new("fps", "warn",
                $"{s.Fps} fps is twice the work of 60 for the encoder and the disk. 60 fps looks smooth in clips."));

        if (cpuEncoder && pixels > 1920L * 1080)
            list.Add(new("outputHeight", "warn", "With the CPU encoder, 1080p or lower keeps games smooth."));
        else if (pixels > 2560L * 1440 && s.Fps >= 60)
            list.Add(new("outputHeight", "info",
                "4K at 60 fps is heavy on any PC. 1440p or 1080p looks nearly the same on Discord and YouTube."));

        if (s.BitrateMbps > 60)
            list.Add(new("bitrateMbps", "info", "Above 60 Mbps clips grow quickly without looking better."));

        long bufferBytes = (long)(s.BitrateMbps * 1.25 * 1e6 / 8 * s.BufferSeconds);
        if (ram > 0 && ram <= 8L << 30 && bufferBytes > ram / 8)
            list.Add(new("bitrateMbps", "warn",
                $"Your PC has {ram >> 30} GB of RAM. A shorter replay or a lower quality leaves more of it to the game."));

        if (s.StudioEnabled && liveScene is { IsActive: true })
        {
            bool camera = liveScene.ActiveLayers.Any(l => l.Type == "webcam");
            string heavy = pixels > 1920L * 1080 || s.Fps > 60 ? " At your resolution and frame rate this adds up." : "";
            list.Add(new("", threads <= 8 ? "warn" : "info",
                "Studio layers are on. To draw them in, every frame is copied off the graphics card and through your " +
                "CPU, which costs noticeably more than recording without layers." + heavy +
                " The Studio switch turns them off without losing your scenes." +
                (camera ? " The facecam also runs its own decoder while the scene is in use." : "")));
        }

        if (threads <= 4)
            list.Add(new("", "warn",
                $"Your processor has {threads} threads. For the smoothest games keep Studio layers off and record at 60 fps or less."));

        return list;
    }
}
