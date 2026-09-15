using System.Diagnostics;
using System.Drawing.Imaging;
using System.Globalization;
using Snappy.Core;
using Snappy.Library;
using Snappy.Video;

namespace Snappy.Clips;

public static class Screenshots
{
    /// <summary>Grabs the monitor Snappy records at full resolution and saves it as PNG in the screenshots folder.</summary>
    public static string CaptureScreen(DisplayInfo display, string root, string appName)
    {
        using var bmp = new Bitmap(display.Width, display.Height, PixelFormat.Format24bppRgb);
        using (var g = Graphics.FromImage(bmp))
            g.CopyFromScreen(display.X, display.Y, 0, 0, new Size(display.Width, display.Height), CopyPixelOperation.SourceCopy);

        string folder = Path.Combine(root, appName);
        Directory.CreateDirectory(folder);
        string path = LibraryService.UniquePath(folder, $"{appName} {DateTime.Now:yyyy-MM-dd HH-mm-ss}", ".png");
        bmp.Save(path, ImageFormat.Png);
        Log.Info($"Screenshot saved {path}");
        return path;
    }

    /// <summary>Saves the exact frame at <paramref name="seconds"/> of a clip.</summary>
    public static async Task<string> CaptureFrameAsync(string clip, double seconds, string root, string subfolder)
    {
        string folder = string.IsNullOrEmpty(subfolder) ? root : Path.Combine(root, subfolder);
        Directory.CreateDirectory(folder);
        var time = TimeSpan.FromSeconds(seconds);
        string stamp = $"{(int)time.TotalMinutes:D2}-{time.Seconds:D2}.{time.Milliseconds / 10:D2}";
        string path = LibraryService.UniquePath(folder, $"{Path.GetFileNameWithoutExtension(clip)} at {stamp}", ".png");

        var psi = ClipMedia.NewFfmpeg(new[]
        {
            "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
            "-ss", seconds.ToString("0.###", CultureInfo.InvariantCulture), "-i", clip,
            "-frames:v", "1", "-update", "1", path,
        });
        using var proc = Process.Start(psi)!;
        proc.StandardInput.Close();
        string err = await proc.StandardError.ReadToEndAsync();
        await proc.WaitForExitAsync();
        if (proc.ExitCode != 0 || !File.Exists(path)) throw new InvalidOperationException($"Couldn't grab the frame: {err.Trim()}");
        return path;
    }
}
