using System.Text.Json;
using Snappy.Core;
using Snappy.Platform;

namespace Snappy.Library;

public sealed class ClipMetaData
{
    public bool Favorite { get; set; }

    /// <summary>Marked moments, in seconds from the start of the clip.</summary>
    public List<double> Markers { get; set; } = new();

    /// <summary>The app an imported clip came from (NVIDIA, Medal...), empty for Snappy's own clips.</summary>
    public string? Source { get; set; }

    public bool IsEmpty => !Favorite && Markers.Count == 0 && string.IsNullOrEmpty(Source);
}

/// <summary>
/// Per-clip data (favorite, markers) is kept in an NTFS alternate data stream of the video file, so it follows the
/// clip when it is moved or renamed in Explorer. Drives without streams (FAT32/exFAT) use a hidden file next to it.
/// </summary>
public static class ClipMeta
{
    private const string StreamName = "snappy.meta";
    private const string SidecarSuffix = ".meta.json";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static ClipMetaData Read(string clip)
    {
        foreach (string path in new[] { clip + ":" + StreamName, clip + SidecarSuffix })
        {
            try
            {
                if (!File.Exists(path)) continue;
                return JsonSerializer.Deserialize<ClipMetaData>(File.ReadAllText(path), Json) ?? new ClipMetaData();
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
            {
                // unreadable: treat as no metadata
            }
        }
        return new ClipMetaData();
    }

    public static bool Has(string clip)
    {
        try { return File.Exists(clip + ":" + StreamName) || File.Exists(clip + SidecarSuffix); }
        catch { return false; }
    }

    public static void Write(string clip, ClipMetaData meta)
    {
        // Writing a stream bumps the file's modified time, which would invalidate thumbnails and caches.
        DateTime modified = File.GetLastWriteTimeUtc(clip);
        string json = JsonSerializer.Serialize(meta, Json);
        try
        {
            string stream = clip + ":" + StreamName;
            if (meta.IsEmpty) { if (File.Exists(stream)) File.Delete(stream); }
            else File.WriteAllText(stream, json);
        }
        catch (Exception ex) when (ex is IOException or NotSupportedException or UnauthorizedAccessException)
        {
            string sidecar = clip + SidecarSuffix;
            if (File.Exists(sidecar)) File.SetAttributes(sidecar, FileAttributes.Normal);
            if (meta.IsEmpty) File.Delete(sidecar);
            else
            {
                File.WriteAllText(sidecar, json);
                File.SetAttributes(sidecar, FileAttributes.Hidden);
            }
        }
        finally
        {
            try { File.SetLastWriteTimeUtc(clip, modified); } catch { }
        }
    }

    /// <summary>The stream travels with the file by itself; only the fallback file needs to follow.</summary>
    public static void MoveWith(string from, string to)
    {
        string sidecar = from + SidecarSuffix;
        if (File.Exists(sidecar)) File.Move(sidecar, to + SidecarSuffix, overwrite: true);
    }

    public static void RecycleWith(string clip)
    {
        string sidecar = clip + SidecarSuffix;
        if (File.Exists(sidecar)) ShellOps.SendToRecycleBin(sidecar);
    }

    public static void Update(string clip, Action<ClipMetaData> change)
    {
        var meta = Read(clip);
        change(meta);
        Write(clip, meta);
    }

    /// <summary>Carries metadata over to an edited copy covering [start, end] of the source.</summary>
    public static void CopyTrimmed(string source, string destination, double start, double end)
    {
        var meta = Read(source);
        if (meta.IsEmpty) return;
        var copy = new ClipMetaData
        {
            Favorite = meta.Favorite,
            Source = meta.Source,
            Markers = meta.Markers.Where(m => m >= start && m <= end).Select(m => Math.Round(m - start, 2)).ToList(),
        };
        try { Write(destination, copy); }
        catch (Exception ex) { Log.Warn($"Could not copy clip metadata: {ex.Message}"); }
    }
}
