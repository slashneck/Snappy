using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using Snappy.Core;

namespace Snappy.Library;

/// <summary>
/// Small JPEG previews in %LocalAppData%\Snappy\thumbs, generated in the background by FFmpeg at low priority.
/// Keyed by file size + modified time, so moving or renaming a clip keeps its thumbnail.
/// </summary>
public sealed class ThumbnailCache
{
    private readonly SemaphoreSlim _gate = new(2);
    private readonly ConcurrentDictionary<string, byte> _pending = new();

    public string Directory { get; } = Path.Combine(AppPaths.LocalDataDir, "thumbs");

    public event Action? Ready;

    public ThumbnailCache() => System.IO.Directory.CreateDirectory(Directory);

    public static string Key(FileInfo f) => $"{f.Length:x}-{f.LastWriteTimeUtc.Ticks:x}";

    public string? GetUrlOrQueue(FileInfo file, double duration)
    {
        string key = Key(file);
        string path = Path.Combine(Directory, key + ".jpg");
        if (File.Exists(path)) return $"https://{LibraryService.ThumbHost}/{key}.jpg";
        if (_pending.TryAdd(key, 0))
            _ = Task.Run(() => GenerateAsync(file.FullName, path, duration, key));
        return null;
    }

    private async Task GenerateAsync(string video, string output, double duration, string key)
    {
        await _gate.WaitAsync();
        try
        {
            string at = Math.Min(1.0, duration / 2).ToString("0.###", CultureInfo.InvariantCulture);
            string tmp = output + ".tmp.jpg";
            var psi = new ProcessStartInfo(AppPaths.FfmpegExe)
            {
                UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true,
            };
            foreach (string a in new[]
                     {
                         "-hide_banner", "-loglevel", "error", "-nostdin", "-protocol_whitelist", "file,pipe",
                         "-ss", at, "-i", video, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", "-y", tmp,
                     })
                psi.ArgumentList.Add(a);

            using var p = Process.Start(psi)!;
            try { p.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
            string err = await p.StandardError.ReadToEndAsync();
            await p.WaitForExitAsync();
            if (p.ExitCode == 0 && File.Exists(tmp))
            {
                File.Move(tmp, output, overwrite: true);
                Ready?.Invoke();
            }
            else
            {
                Log.Warn($"Thumbnail failed for {video}: {err.Trim()}");
            }
        }
        catch (Exception ex)
        {
            Log.Warn($"Thumbnail failed for {video}: {ex.Message}");
        }
        finally
        {
            _gate.Release();
            _pending.TryRemove(key, out _);
        }
    }
}
