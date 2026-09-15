using Snappy.Core;
using Snappy.Platform;

namespace Snappy.Library;

/// <summary>
/// Optional size limit for the clips folder. When it's exceeded, the oldest clips that aren't favorites go to the
/// Recycle Bin until the folder fits again. Clips saved in the last few minutes are never touched.
/// </summary>
public static class StorageLimiter
{
    private static readonly string[] Extensions = { ".mp4", ".mov", ".mkv" };

    public static List<string> Enforce(string root, long limitBytes)
    {
        var removed = new List<string>();
        if (!Directory.Exists(root) || limitBytes <= 0) return removed;

        var clips = Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Where(f => Extensions.Contains(Path.GetExtension(f), StringComparer.OrdinalIgnoreCase))
            .Select(f => new FileInfo(f))
            .Where(f => (f.Attributes & FileAttributes.Hidden) == 0)
            .ToList();
        long total = clips.Sum(f => f.Length);
        if (total <= limitBytes) return removed;

        DateTime protectAfter = DateTime.UtcNow.AddMinutes(-5);
        foreach (var f in clips.OrderBy(f => f.LastWriteTimeUtc))
        {
            if (total <= limitBytes) break;
            if (f.LastWriteTimeUtc > protectAfter || ClipMeta.Read(f.FullName).Favorite) continue;
            try
            {
                long size = f.Length;
                ShellOps.SendToRecycleBin(f.FullName);
                total -= size;
                removed.Add(f.FullName);
            }
            catch (Exception ex)
            {
                Log.Warn($"Storage limit: couldn't remove {f.FullName}: {ex.Message}");
            }
        }
        if (removed.Count > 0) Log.Info($"Storage limit: moved {removed.Count} old clip(s) to the Recycle Bin");
        return removed;
    }

    public static long FolderSize(string root)
    {
        if (!Directory.Exists(root)) return 0;
        return Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Where(f => Extensions.Contains(Path.GetExtension(f), StringComparer.OrdinalIgnoreCase))
            .Sum(f => new FileInfo(f).Length);
    }
}
