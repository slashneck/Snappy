using System.Collections.Concurrent;
using System.Text.Json;
using Snappy.Core;
using Snappy.Platform;

namespace Snappy.Library;

public sealed record ClipDto(string Id, string Title, string Folder, string FileName, long Size, double Duration,
    int Width, int Height, DateTime Created, string VideoUrl, string? ThumbUrl, bool Favorite, double[] Markers, string? Source);

public sealed record FolderDto(string Name, int Count, long Size);

public sealed record LibraryDto(string Root, List<FolderDto> Folders, List<ClipDto> Clips);

/// <summary>
/// The clips folder IS the library: game/app subfolders are the categories, so anything you do in Snappy
/// (move, rename, delete, new folder) happens to the real files, and anything you do in Explorer shows up in Snappy.
/// </summary>
public sealed class LibraryService : IDisposable
{
    public const string VideoHost = "clips.snappy";
    public const string ThumbHost = "thumbs.snappy";
    private static readonly string[] Extensions = { ".mp4", ".mov", ".mkv" };

    private readonly ConcurrentDictionary<string, MetaEntry> _meta = new();
    private readonly string _cachePath = Path.Combine(AppPaths.LocalDataDir, "library-cache.json");
    private FileSystemWatcher? _watcher;
    private readonly System.Threading.Timer _debounce;
    private bool _cacheDirty;

    public string Root { get; private set; }
    public ThumbnailCache Thumbnails { get; } = new();

    /// <summary>Raised (debounced) whenever files in the library change, from Snappy or from outside.</summary>
    public event Action? Changed;

    private sealed record MetaEntry(long Size, long Ticks, double Duration, int Width, int Height);

    public LibraryService(string root)
    {
        Root = Path.GetFullPath(root);
        _debounce = new System.Threading.Timer(_ => Changed?.Invoke());
        Thumbnails.Ready += () => _debounce.Change(300, Timeout.Infinite);
        LoadCache();
        Watch();
    }

    public void SetRoot(string root)
    {
        Root = Path.GetFullPath(root);
        Watch();
        Changed?.Invoke();
    }

    public LibraryDto Scan()
    {
        Directory.CreateDirectory(Root);
        var clips = new List<ClipDto>();
        var folders = new List<FolderDto>();

        foreach (var file in ListVideos(Root)) clips.Add(ToDto(file, ""));
        foreach (var dir in new DirectoryInfo(Root).EnumerateDirectories())
        {
            if (dir.Name.StartsWith('.') || (dir.Attributes & FileAttributes.Hidden) != 0) continue;
            var inFolder = ListVideos(dir.FullName).Select(f => ToDto(f, dir.Name)).ToList();
            clips.AddRange(inFolder);
            folders.Add(new FolderDto(dir.Name, inFolder.Count, inFolder.Sum(c => c.Size)));
        }

        if (_cacheDirty) SaveCache();
        folders.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
        return new LibraryDto(Root, folders, clips);
    }

    private static IEnumerable<FileInfo> ListVideos(string dir) =>
        new DirectoryInfo(dir).EnumerateFiles()
            .Where(f => Extensions.Contains(f.Extension, StringComparer.OrdinalIgnoreCase)
                        && (f.Attributes & FileAttributes.Hidden) == 0);

    private ClipDto ToDto(FileInfo f, string folder)
    {
        long ticks = f.LastWriteTimeUtc.Ticks;
        var meta = _meta.TryGetValue(f.FullName, out var m) && m.Size == f.Length && m.Ticks == ticks ? m : null;
        if (meta == null)
        {
            var info = Mp4Info.Read(f.FullName);
            meta = new MetaEntry(f.Length, ticks, info?.DurationSeconds ?? 0, info?.Width ?? 0, info?.Height ?? 0);
            if (info != null)
            {
                _meta[f.FullName] = meta;
                _cacheDirty = true;
            }
        }

        var clipMeta = ClipMeta.Has(f.FullName) ? ClipMeta.Read(f.FullName) : null;
        string id = folder.Length == 0 ? f.Name : $"{folder}/{f.Name}";
        string videoUrl = $"https://{VideoHost}/{string.Join('/', id.Split('/').Select(Uri.EscapeDataString))}?v={ticks:x}";
        string? thumb = meta.Duration > 0 ? Thumbnails.GetUrlOrQueue(f, meta.Duration) : null;
        return new ClipDto(id, Path.GetFileNameWithoutExtension(f.Name), folder, f.Name, f.Length, meta.Duration,
            meta.Width, meta.Height, f.CreationTimeUtc < f.LastWriteTimeUtc ? f.CreationTimeUtc : f.LastWriteTimeUtc,
            videoUrl, thumb, clipMeta?.Favorite ?? false, clipMeta?.Markers.ToArray() ?? Array.Empty<double>(), clipMeta?.Source);
    }

    /// <summary>Maps a clip id from the UI to a real path, refusing anything outside the library.</summary>
    public string ResolvePath(string id)
    {
        string full = Path.GetFullPath(Path.Combine(Root, id.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Path is outside the clips folder");
        return full;
    }

    private string FolderPath(string folder)
    {
        if (string.IsNullOrWhiteSpace(folder)) return Root;
        return ResolvePath(ForegroundApp.SanitizeFolderName(folder));
    }

    public string MoveClip(string id, string folder)
    {
        string src = ResolvePath(id);
        string destDir = FolderPath(folder);
        if (string.Equals(Path.GetDirectoryName(src), destDir, StringComparison.OrdinalIgnoreCase)) return id;
        Directory.CreateDirectory(destDir);
        string dest = UniquePath(destDir, Path.GetFileNameWithoutExtension(src), Path.GetExtension(src));
        File.Move(src, dest);
        ClipMeta.MoveWith(src, dest);
        RemoveIfEmpty(Path.GetDirectoryName(src));
        return RelativeId(dest);
    }

    /// <summary>
    /// Drops a game folder once its last clip has left, so the sidebar doesn't collect empty names. Folders that still
    /// hold anything of yours are left alone.
    /// </summary>
    private void RemoveIfEmpty(string? dir)
    {
        if (dir == null || string.Equals(Path.GetFullPath(dir), Root, StringComparison.OrdinalIgnoreCase)) return;
        try
        {
            if (!Directory.Exists(dir) || Directory.EnumerateDirectories(dir).Any()) return;
            var files = new DirectoryInfo(dir).EnumerateFiles().ToList();
            // Only Snappy's own hidden leftovers may remain, anything visible means the folder is still in use.
            if (files.Any(f => (f.Attributes & FileAttributes.Hidden) == 0)) return;
            foreach (var leftover in files) leftover.Delete();
            Directory.Delete(dir);
            Log.Info($"Removed the empty folder {Path.GetFileName(dir)}");
        }
        catch (Exception ex)
        {
            Log.Warn($"Couldn't remove the empty folder {dir}: {ex.Message}");
        }
    }

    public string RenameClip(string id, string newTitle)
    {
        string src = ResolvePath(id);
        string title = ForegroundApp.SanitizeFolderName(newTitle);
        if (title == Path.GetFileNameWithoutExtension(src)) return id;
        string dest = UniquePath(Path.GetDirectoryName(src)!, title, Path.GetExtension(src));
        File.Move(src, dest);
        ClipMeta.MoveWith(src, dest);
        return RelativeId(dest);
    }

    public void DeleteClips(IEnumerable<string> ids)
    {
        var folders = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (string id in ids)
        {
            string path = ResolvePath(id);
            ShellOps.SendToRecycleBin(path);
            ClipMeta.RecycleWith(path);
            if (Path.GetDirectoryName(path) is { } dir) folders.Add(dir);
        }
        foreach (string dir in folders) RemoveIfEmpty(dir);
    }

    public void SetFavorite(string id, bool favorite) => ClipMeta.Update(ResolvePath(id), m => m.Favorite = favorite);

    public string CreateFolder(string name)
    {
        string path = FolderPath(name);
        Directory.CreateDirectory(path);
        return Path.GetFileName(path);
    }

    public string RenameFolder(string oldName, string newName)
    {
        string src = FolderPath(oldName);
        string dest = FolderPath(newName);
        if (string.Equals(src, dest, StringComparison.Ordinal)) return Path.GetFileName(dest);
        if (!Directory.Exists(dest) || string.Equals(src, dest, StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(src, dest, StringComparison.OrdinalIgnoreCase))
            {
                // Case-only rename needs a hop on Windows.
                string hop = src + ".renaming";
                Directory.Move(src, hop);
                Directory.Move(hop, dest);
            }
            else
            {
                Directory.Move(src, dest);
            }
        }
        else
        {
            // Target exists: merge clips into it.
            foreach (var f in ListVideos(src))
                File.Move(f.FullName, UniquePath(dest, Path.GetFileNameWithoutExtension(f.Name), f.Extension));
            if (!Directory.EnumerateFileSystemEntries(src).Any()) Directory.Delete(src);
        }
        return Path.GetFileName(dest);
    }

    public void DeleteFolder(string name)
    {
        string path = FolderPath(name);
        if (string.Equals(path, Root, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Can't delete the clips folder itself");
        ShellOps.SendToRecycleBin(path);
    }

    public string RelativeId(string fullPath) =>
        Path.GetRelativePath(Root, fullPath).Replace(Path.DirectorySeparatorChar, '/');

    public static string UniquePath(string folder, string baseName, string ext)
    {
        string p = Path.Combine(folder, baseName + ext);
        for (int i = 2; File.Exists(p); i++) p = Path.Combine(folder, $"{baseName} ({i}){ext}");
        return p;
    }

    private void Watch()
    {
        _watcher?.Dispose();
        Directory.CreateDirectory(Root);
        _watcher = new FileSystemWatcher(Root)
        {
            IncludeSubdirectories = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.Size | NotifyFilters.LastWrite,
        };
        FileSystemEventHandler onChange = (_, e) =>
        {
            if (e.Name != null && e.Name.EndsWith(".part", StringComparison.OrdinalIgnoreCase)) return;
            _debounce.Change(500, Timeout.Infinite);
        };
        _watcher.Created += onChange;
        _watcher.Deleted += onChange;
        _watcher.Changed += onChange;
        _watcher.Renamed += (s, e) => onChange(s, e);
        _watcher.EnableRaisingEvents = true;
    }

    private void LoadCache()
    {
        try
        {
            if (!File.Exists(_cachePath)) return;
            var data = JsonSerializer.Deserialize<Dictionary<string, MetaEntry>>(File.ReadAllText(_cachePath));
            if (data != null) foreach (var kv in data) _meta[kv.Key] = kv.Value;
        }
        catch (Exception ex)
        {
            Log.Warn($"Library cache unreadable, rebuilding: {ex.Message}");
        }
    }

    private void SaveCache()
    {
        try
        {
            var live = _meta.Where(kv => File.Exists(kv.Key)).ToDictionary(kv => kv.Key, kv => kv.Value);
            string tmp = _cachePath + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(live));
            File.Move(tmp, _cachePath, overwrite: true);
            _cacheDirty = false;
        }
        catch (Exception ex)
        {
            Log.Warn($"Saving library cache failed: {ex.Message}");
        }
    }

    public void Dispose()
    {
        _watcher?.Dispose();
        _debounce.Dispose();
        if (_cacheDirty) SaveCache();
    }
}
