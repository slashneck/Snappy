using System.Collections.Concurrent;
using System.Text.Json;
using Snappy.Core;
using Snappy.Platform;

namespace Snappy.Library;

public sealed record ClipDto(string Id, string Title, string Folder, string FileName, long Size, double Duration,
    int Width, int Height, DateTime Created, string VideoUrl, string? ThumbUrl, bool Favorite, double[] Markers, string? Source,
    string? Location, bool DeletesForGood);

/// <summary>An extra clips folder from Settings, e.g. on a USB stick, and whether it can be reached right now.</summary>
public sealed record LocationDto(int Index, string Path, string Label, bool Connected, int Count, long Size);

public sealed record FolderDto(string Name, int Count, long Size);

public sealed record LibraryDto(string Root, List<FolderDto> Folders, List<ClipDto> Clips, List<LocationDto> Locations);

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
    private List<string> _extra = new();
    private readonly List<FileSystemWatcher> _extraWatchers = new();
    private readonly System.Threading.Timer _drivePoll;
    private string _available = "";

    /// <summary>Host name the page loads videos from: the main folder, or extra folder number <paramref name="index"/>.</summary>
    public static string HostFor(int index) => index < 0 ? VideoHost : $"clips{index}.snappy";

    /// <summary>Extra folders that can be reached right now, by their index in the settings list.</summary>
    public List<(int Index, string Path)> ConnectedExtras() =>
        _extra.Select((p, i) => (i, p)).Where(x => Directory.Exists(x.p)).ToList();
    public ThumbnailCache Thumbnails { get; } = new();

    /// <summary>Raised (debounced) whenever files in the library change, from Snappy or from outside.</summary>
    public event Action? Changed;

    private sealed record MetaEntry(long Size, long Ticks, double Duration, int Width, int Height);

    public LibraryService(string root, IEnumerable<string>? extra = null)
    {
        Root = Path.GetFullPath(root);
        _extra = Clean(extra);
        _debounce = new System.Threading.Timer(_ => Changed?.Invoke());
        Thumbnails.Ready += () => _debounce.Change(300, Timeout.Infinite);
        LoadCache();
        Watch();
        // A USB stick can come and go at any time; its clips show up or leave the library with it.
        _drivePoll = new System.Threading.Timer(_ => CheckDrives(), null, 3000, 3000);
    }

    public void SetRoots(string root, IEnumerable<string> extra)
    {
        Root = Path.GetFullPath(root);
        _extra = Clean(extra);
        Watch();
        Changed?.Invoke();
    }

    private List<string> Clean(IEnumerable<string>? extra) =>
        (extra ?? Enumerable.Empty<string>()).Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => Path.GetFullPath(p))
            .Where(p => !string.Equals(p, Root, StringComparison.OrdinalIgnoreCase)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

    private void CheckDrives()
    {
        string now = string.Join('|', _extra.Select(p => Directory.Exists(p) ? "1" : "0"));
        if (now == _available) return;
        _available = now;
        WatchExtras();
        Changed?.Invoke();
    }

    /// <summary>The main folder (index -1) and every extra folder that's connected.</summary>
    private IEnumerable<(int Index, string Path)> Bases() =>
        new[] { (-1, Root) }.Concat(ConnectedExtras());

    private string BaseOf(int index) => index < 0 ? Root : _extra[index];

    private static string LabelFor(string path)
    {
        try
        {
            var drive = new DriveInfo(System.IO.Path.GetPathRoot(path)!);
            string name = drive.DriveType == DriveType.Removable ? "USB stick" : drive.IsReady && drive.VolumeLabel.Length > 0 ? drive.VolumeLabel : "Drive";
            return $"{name} ({drive.Name.TrimEnd('\\')})";
        }
        catch
        {
            return System.IO.Path.GetFileName(path.TrimEnd('\\'));
        }
    }

    /// <summary>Removable drives and network folders have no Recycle Bin: deleting there can't be undone.</summary>
    private static bool DeletesForGood(string path)
    {
        try
        {
            if (path.StartsWith(@"\\", StringComparison.Ordinal)) return true;
            var drive = new DriveInfo(System.IO.Path.GetPathRoot(path)!);
            return drive.DriveType is DriveType.Removable or DriveType.Network;
        }
        catch
        {
            return true;
        }
    }

    public LibraryDto Scan()
    {
        Directory.CreateDirectory(Root);
        var clips = new List<ClipDto>();
        var folders = new List<FolderDto>();

        var locations = new List<LocationDto>();
        // Game folders with the same name on several drives show up as one folder.
        var merged = new Dictionary<string, (string Name, int Count, long Size)>(StringComparer.OrdinalIgnoreCase);
        foreach (var (index, basePath) in Bases())
        {
            int before = clips.Count;
            try
            {
                foreach (var file in ListVideos(basePath)) clips.Add(ToDto(file, "", index, basePath));
                foreach (var dir in new DirectoryInfo(basePath).EnumerateDirectories())
                {
                    if (dir.Name.StartsWith('.') || (dir.Attributes & FileAttributes.Hidden) != 0) continue;
                    if (index >= 0 && dir.Name.Equals("System Volume Information", StringComparison.OrdinalIgnoreCase)) continue;
                    var inFolder = ListVideos(dir.FullName).Select(f => ToDto(f, dir.Name, index, basePath)).ToList();
                    clips.AddRange(inFolder);
                    merged[dir.Name] = merged.TryGetValue(dir.Name, out var m)
                        ? (m.Name, m.Count + inFolder.Count, m.Size + inFolder.Sum(c => c.Size))
                        : (dir.Name, inFolder.Count, inFolder.Sum(c => c.Size));
                }
            }
            catch (Exception ex) when (index >= 0 && ex is IOException or UnauthorizedAccessException)
            {
                Log.Warn($"Couldn't read the clips on {basePath}: {ex.Message}"); // pulled out mid scan
            }
            if (index >= 0)
                locations.Add(new LocationDto(index, basePath, LabelFor(basePath), true, clips.Count - before, clips.Skip(before).Sum(c => c.Size)));
        }
        for (int i = 0; i < _extra.Count; i++)
            if (!locations.Any(l => l.Index == i)) locations.Add(new LocationDto(i, _extra[i], LabelFor(_extra[i]), false, 0, 0));
        folders.AddRange(merged.Values.Select(m => new FolderDto(m.Name, m.Count, m.Size)));

        if (_cacheDirty) SaveCache();
        folders.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
        locations.Sort((a, b) => a.Index.CompareTo(b.Index));
        return new LibraryDto(Root, folders, clips, locations);
    }

    private static IEnumerable<FileInfo> ListVideos(string dir) =>
        new DirectoryInfo(dir).EnumerateFiles()
            .Where(f => Extensions.Contains(f.Extension, StringComparer.OrdinalIgnoreCase)
                        && (f.Attributes & FileAttributes.Hidden) == 0);

    private ClipDto ToDto(FileInfo f, string folder, int index, string basePath)
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
        string rel = folder.Length == 0 ? f.Name : $"{folder}/{f.Name}";
        string id = index < 0 ? rel : $"~{index}/{rel}";
        string videoUrl = $"https://{HostFor(index)}/{string.Join('/', rel.Split('/').Select(Uri.EscapeDataString))}?v={ticks:x}";
        string? thumb = meta.Duration > 0 ? Thumbnails.GetUrlOrQueue(f, meta.Duration) : null;
        return new ClipDto(id, Path.GetFileNameWithoutExtension(f.Name), folder, f.Name, f.Length, meta.Duration,
            meta.Width, meta.Height, f.CreationTimeUtc < f.LastWriteTimeUtc ? f.CreationTimeUtc : f.LastWriteTimeUtc,
            videoUrl, thumb, clipMeta?.Favorite ?? false, clipMeta?.Markers.ToArray() ?? Array.Empty<double>(), clipMeta?.Source,
            index < 0 ? null : LabelFor(basePath), index >= 0 && DeletesForGood(basePath));
    }

    /// <summary>Maps a clip id from the UI to a real path, refusing anything outside the library.</summary>
    public string ResolvePath(string id)
    {
        var (index, rel) = Split(id);
        string root = BaseOf(index);
        string full = Path.GetFullPath(Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Path is outside the clips folder");
        return full;
    }

    private (int Index, string Rel) Split(string id)
    {
        if (id.StartsWith('~'))
        {
            int slash = id.IndexOf('/');
            if (slash > 1 && int.TryParse(id.AsSpan(1, slash - 1), out int index) && index >= 0 && index < _extra.Count)
                return (index, id[(slash + 1)..]);
            throw new InvalidOperationException("That clips folder isn't connected");
        }
        return (-1, id);
    }

    /// <summary>Which folder a file sits in: -1 for the main folder, otherwise the extra folder's index.</summary>
    private int IndexOf(string fullPath)
    {
        for (int i = 0; i < _extra.Count; i++)
            if (fullPath.StartsWith(_extra[i].TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)) return i;
        return -1;
    }

    /// <summary>
    /// Moves clips to another clips folder (the main one is -1), into the game folder of the same name. Favorites,
    /// markers and where an imported clip came from go along, also onto drives that can't keep them in the file.
    /// </summary>
    public (int Moved, string? Error) MoveToLocation(IEnumerable<string> ids, int target)
    {
        string destRoot = BaseOf(target);
        if (!Directory.Exists(destRoot)) return (0, "That clips folder isn't connected.");
        int moved = 0;
        foreach (string id in ids)
        {
            string src = ResolvePath(id);
            if (IndexOf(src) == target) continue;
            try
            {
                string folder = Path.GetFileName(Path.GetDirectoryName(src)!);
                bool inRoot = string.Equals(Path.GetDirectoryName(src), BaseOf(IndexOf(src)).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
                string destDir = inRoot ? destRoot : Path.Combine(destRoot, folder);
                Directory.CreateDirectory(destDir);
                string dest = UniquePath(destDir, Path.GetFileNameWithoutExtension(src), Path.GetExtension(src));
                var meta = ClipMeta.Read(src);
                DateTime created = File.GetCreationTimeUtc(src), written = File.GetLastWriteTimeUtc(src);
                File.Move(src, dest);
                File.SetCreationTimeUtc(dest, created);
                File.SetLastWriteTimeUtc(dest, written);
                if (!meta.IsEmpty) ClipMeta.Write(dest, meta);
                string sidecar = src + ".meta.json";
                if (File.Exists(sidecar)) { File.SetAttributes(sidecar, FileAttributes.Normal); File.Delete(sidecar); }
                RemoveIfEmpty(Path.GetDirectoryName(src));
                moved++;
            }
            catch (Exception ex)
            {
                Log.Warn($"Couldn't move {src}: {ex.Message}");
                return (moved, ex is IOException && ex.Message.Contains("too large", StringComparison.OrdinalIgnoreCase)
                    ? "That clip is bigger than 4 GB, which this drive (FAT32) can't hold." : ex.Message);
            }
        }
        return (moved, null);
    }

    private string FolderPath(string folder)
    {
        if (string.IsNullOrWhiteSpace(folder)) return Root;
        return ResolvePath(ForegroundApp.SanitizeFolderName(folder));
    }

    public string MoveClip(string id, string folder)
    {
        string src = ResolvePath(id);
        // A clip stays on its own drive; dragging it to a game folder only changes the folder.
        string root = BaseOf(IndexOf(src));
        string destDir = string.IsNullOrWhiteSpace(folder) ? root : Path.Combine(root, ForegroundApp.SanitizeFolderName(folder));
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
        if (dir == null || Bases().Any(b => string.Equals(Path.GetFullPath(dir).TrimEnd('\\'), b.Path.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))) return;
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
        // The same game folder on a connected stick is renamed along with it.
        foreach (var (_, basePath) in ConnectedExtras())
        {
            string extraSrc = Path.Combine(basePath, ForegroundApp.SanitizeFolderName(oldName));
            if (Directory.Exists(extraSrc)) RenameIn(extraSrc, Path.Combine(basePath, ForegroundApp.SanitizeFolderName(newName)));
        }
        return RenameIn(FolderPath(oldName), FolderPath(newName));
    }

    private string RenameIn(string src, string dest)
    {
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
        if (Directory.Exists(path)) ShellOps.SendToRecycleBin(path);
        foreach (var (_, basePath) in ConnectedExtras())
        {
            string extra = Path.Combine(basePath, ForegroundApp.SanitizeFolderName(name));
            if (Directory.Exists(extra)) ShellOps.SendToRecycleBin(extra);
        }
    }

    public string RelativeId(string fullPath)
    {
        int index = IndexOf(fullPath);
        string rel = Path.GetRelativePath(BaseOf(index), fullPath).Replace(Path.DirectorySeparatorChar, '/');
        return index < 0 ? rel : $"~{index}/{rel}";
    }

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
        WatchExtras();
    }

    private void WatchExtras()
    {
        lock (_extraWatchers)
        {
            foreach (var w in _extraWatchers) w.Dispose();
            _extraWatchers.Clear();
            foreach (var (_, path) in ConnectedExtras())
            {
                try
                {
                    var w = new FileSystemWatcher(path) { IncludeSubdirectories = true, NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.Size };
                    FileSystemEventHandler on = (_, _) => _debounce.Change(500, Timeout.Infinite);
                    w.Created += on; w.Deleted += on; w.Changed += on; w.Renamed += (s, e) => on(s, e);
                    w.Error += (_, _) => _debounce.Change(500, Timeout.Infinite); // the stick was pulled out
                    w.EnableRaisingEvents = true;
                    _extraWatchers.Add(w);
                }
                catch (Exception ex) { Log.Warn($"Can't watch {path}: {ex.Message}"); }
            }
        }
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
        _drivePoll.Dispose();
        lock (_extraWatchers) foreach (var w in _extraWatchers) w.Dispose();
        _debounce.Dispose();
        if (_cacheDirty) SaveCache();
    }
}
