using System.Diagnostics;
using System.Text.RegularExpressions;
using Snappy.Core;
using Snappy.Platform;

namespace Snappy.Library;

public sealed record ImportScan(string Folder, int Count, long Bytes, string Source, List<string> Games, long FreeBytes, bool SameDrive);

public sealed record ImportProgress(int Done, int Total, string Current);

public sealed record ImportResult(int Imported, int Skipped, int Failed, bool Cancelled, string? Error);

/// <summary>
/// Brings clips from another recorder (NVIDIA, Medal, Xbox Game Bar, OBS...) into the library: sorted into a folder per
/// game, with their original dates, and marked with the app they came from. Copying leaves the originals alone.
/// Moving takes them out of the other app's folder, and only after the copy is complete. MKV files are rewrapped into
/// MP4 on the way (nothing is re-encoded) so they play and get thumbnails like every other clip.
/// </summary>
public static partial class ClipImporter
{
    private static readonly string[] VideoExtensions = { ".mp4", ".mov", ".m4v", ".mkv" };

    /// <summary>Folder names that say where clips were saved, not what they show.</summary>
    private static readonly HashSet<string> GenericFolders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Videos", "Video", "Clips", "Clip", "Medal", "NVIDIA", "ShadowPlay", "Captures", "Replays", "Replay", "Highlights",
        "Recordings", "Radeon ReLive", "ReLive", "AMD", "Outplayed", "Overwolf", "Game Bar", "Xbox", "Screen Recordings",
        "Instant Replay", "Snappy", "Snapy",
    };

    public static ImportScan Scan(string folder, string libraryRoot)
    {
        var files = Enumerate(folder, libraryRoot).ToList();
        var games = files.GroupBy(f => GameFor(f, folder), StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count()).Select(g => g.Key).ToList();
        long bytes = files.Sum(f => f.Length);
        long free = 0;
        try { free = new DriveInfo(Path.GetPathRoot(Path.GetFullPath(libraryRoot))!).AvailableFreeSpace; } catch { }
        return new ImportScan(folder, files.Count, bytes, GuessSource(folder, files), games, free, SameVolume(folder, libraryRoot));
    }

    public static async Task<ImportResult> RunAsync(string folder, string libraryRoot, string source, bool move,
        IProgress<ImportProgress>? progress, CancellationToken ct)
    {
        var files = Enumerate(folder, libraryRoot).ToList();
        long needed = move && SameVolume(folder, libraryRoot) ? 0 : files.Sum(f => f.Length);
        try
        {
            long free = new DriveInfo(Path.GetPathRoot(Path.GetFullPath(libraryRoot))!).AvailableFreeSpace;
            if (needed > free - (512L << 20))
                return new ImportResult(0, 0, 0, false,
                    $"These clips need {needed / 1073741824.0:0.#} GB, but only {free / 1073741824.0:0.#} GB is free where your clips are.");
        }
        catch (Exception ex)
        {
            Log.Warn($"Couldn't check free space before importing: {ex.Message}");
        }

        int imported = 0, skipped = 0, failed = 0;
        Log.Info($"Importing {files.Count} clips from {folder} ({source}, {(move ? "move" : "copy")})");
        for (int i = 0; i < files.Count; i++)
        {
            if (ct.IsCancellationRequested) return new ImportResult(imported, skipped, failed, true, null);
            var file = files[i];
            progress?.Report(new ImportProgress(i, files.Count, file.Name));
            try
            {
                string game = GameFor(file, folder);
                string dir = Path.Combine(libraryRoot, game);
                Directory.CreateDirectory(dir);
                bool remux = file.Extension.Equals(".mkv", StringComparison.OrdinalIgnoreCase);
                string name = Path.GetFileNameWithoutExtension(file.Name);
                string ext = remux ? ".mp4" : file.Extension.ToLowerInvariant();
                string target = Path.Combine(dir, name + ext);
                if (File.Exists(target) && (remux || new FileInfo(target).Length == file.Length))
                {
                    skipped++; // already imported earlier
                    continue;
                }
                target = LibraryService.UniquePath(dir, name, ext);

                bool done = remux && await RemuxAsync(file.FullName, target, ct);
                if (!done)
                {
                    if (remux) target = LibraryService.UniquePath(dir, name, file.Extension.ToLowerInvariant());
                    if (move && SameVolume(file.FullName, target)) File.Move(file.FullName, target);
                    else await CopyAsync(file.FullName, target, ct);
                }

                File.SetCreationTimeUtc(target, file.CreationTimeUtc);
                File.SetLastWriteTimeUtc(target, file.LastWriteTimeUtc);
                ClipMeta.Update(target, m => m.Source = source);
                // A move deletes the original only once its copy is complete and in place.
                if (move && File.Exists(file.FullName)) File.Delete(file.FullName);
                imported++;
            }
            catch (OperationCanceledException)
            {
                return new ImportResult(imported, skipped, failed, true, null);
            }
            catch (Exception ex)
            {
                failed++;
                Log.Warn($"Couldn't import {file.FullName}: {ex.Message}");
            }
        }
        progress?.Report(new ImportProgress(files.Count, files.Count, ""));
        Log.Info($"Import done: {imported} imported, {skipped} already there, {failed} failed");
        return new ImportResult(imported, skipped, failed, false, null);
    }

    private static IEnumerable<FileInfo> Enumerate(string folder, string libraryRoot)
    {
        string root = Path.GetFullPath(libraryRoot).TrimEnd('\\') + '\\';
        var options = new EnumerationOptions { RecurseSubdirectories = true, IgnoreInaccessible = true, AttributesToSkip = FileAttributes.Hidden | FileAttributes.System };
        return new DirectoryInfo(folder).EnumerateFiles("*", options)
            .Where(f => VideoExtensions.Contains(f.Extension, StringComparer.OrdinalIgnoreCase) && f.Length > 64 * 1024
                        && !f.FullName.StartsWith(root, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Which recorder made these, from the folder and the way the files are named.</summary>
    public static string GuessSource(string folder, IReadOnlyCollection<FileInfo> files)
    {
        string path = folder.ToLowerInvariant();
        var names = files.Take(200).Select(f => f.Name).ToList();
        int Share(Regex r) => names.Count == 0 ? 0 : names.Count(n => r.IsMatch(n)) * 100 / names.Count;
        if (path.Contains("nvidia") || path.Contains("shadowplay") || Share(NvidiaName()) > 50) return "NVIDIA";
        if (path.Contains("medal") || Share(MedalName()) > 50) return "Medal";
        if (path.Contains("relive") || path.Contains("radeon")) return "AMD ReLive";
        if (path.Contains("outplayed")) return "Outplayed";
        if (path.Contains("steam")) return "Steam";
        if (path.EndsWith("\\captures") || path.Contains("\\captures\\")) return "Xbox Game Bar";
        if (files.Count > 0 && files.Count(f => f.Extension.Equals(".mkv", StringComparison.OrdinalIgnoreCase)) * 2 > files.Count) return "OBS";
        return "Other app";
    }

    /// <summary>The game a clip shows: its folder when that says something, otherwise the start of its file name.</summary>
    public static string GameFor(FileInfo file, string importRoot)
    {
        string root = Path.GetFullPath(importRoot).TrimEnd('\\');
        for (var dir = file.Directory; dir != null && dir.FullName.TrimEnd('\\').Length > root.Length; dir = dir.Parent)
            if (!GenericFolders.Contains(dir.Name)) return Clean(dir.Name);

        string name = Path.GetFileNameWithoutExtension(file.Name);
        var medal = MedalName().Match(file.Name);
        if (medal.Success) return Clean(medal.Groups[1].Value);
        var dated = DatedName().Match(name);
        if (dated.Success && dated.Groups[1].Value.Trim().Length > 0) return Clean(dated.Groups[1].Value);
        return "Imported";
    }

    private static string Clean(string name)
    {
        string clean = ForegroundApp.SanitizeFolderName(name.Replace('_', ' ').Trim(' ', '-', '.'));
        return clean.Length == 0 ? "Imported" : clean;
    }

    private static bool SameVolume(string a, string b) =>
        string.Equals(Path.GetPathRoot(Path.GetFullPath(a)), Path.GetPathRoot(Path.GetFullPath(b)), StringComparison.OrdinalIgnoreCase);

    /// <summary>Copies next to the target first, so a half-copied clip never shows up in the library.</summary>
    private static async Task CopyAsync(string from, string to, CancellationToken ct)
    {
        string part = to + ".importing";
        try
        {
            await using (var src = new FileStream(from, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 1 << 20, useAsync: true))
            await using (var dst = new FileStream(part, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 20, useAsync: true))
                await src.CopyToAsync(dst, 1 << 20, ct);
            if (new FileInfo(part).Length != new FileInfo(from).Length) throw new IOException("The copy came out incomplete");
            File.Move(part, to);
        }
        catch
        {
            try { File.Delete(part); } catch { }
            throw;
        }
    }

    /// <summary>MKV into MP4 without re-encoding. False when the streams don't fit into MP4; the MKV is then copied as is.</summary>
    private static async Task<bool> RemuxAsync(string from, string to, CancellationToken ct)
    {
        string part = to + ".importing";
        var psi = ClipMedia.NewFfmpeg(new[]
        {
            "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", from, "-map", "0:v", "-map", "0:a?",
            "-c", "copy", "-movflags", "+faststart", "-f", "mp4", part,
        });
        using var proc = Process.Start(psi)!;
        try { proc.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
        proc.StandardInput.Close();
        string err = await proc.StandardError.ReadToEndAsync(ct);
        await proc.WaitForExitAsync(ct);
        if (proc.ExitCode == 0 && File.Exists(part) && new FileInfo(part).Length > 0)
        {
            File.Move(part, to);
            return true;
        }
        Log.Warn($"Couldn't rewrap {from} into MP4, copying it as it is: {err.Trim()}");
        try { File.Delete(part); } catch { }
        return false;
    }

    [GeneratedRegex(@"\d{4}\.\d{2}\.\d{2} - \d{2}\.\d{2}\.\d{2}\.\d{2}")] private static partial Regex NvidiaName();
    [GeneratedRegex(@"^MedalTV(.+?)\d{12,14}", RegexOptions.IgnoreCase)] private static partial Regex MedalName();
    [GeneratedRegex(@"^(.*?)[\s_\-]*(?:\d{4}[.\-_]\d{2}[.\-_]\d{2}|\d{8}[_\-]?\d{6}).*$")] private static partial Regex DatedName();
}
