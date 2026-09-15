using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using Snappy.Core;

namespace Snappy.Platform;

public sealed record UpdateInfo(string Version, string Notes, string PageUrl, string DownloadUrl, long Size, string? Sha256);

/// <summary>
/// Finds new releases on GitHub and installs them. This is the only thing in Snappy that goes online, and it can be
/// switched off in Settings. An update only swaps the program files listed in the release's file list, so settings,
/// Studio scenes and clips are never touched.
/// </summary>
public static class Updater
{
    public const string Repo = "slashneck/Snappy";
    public const string RepoUrl = "https://github.com/" + Repo;
    public const string ManifestName = "snappy-files.txt";

    public static Version Current
    {
        get
        {
            var v = typeof(Updater).Assembly.GetName().Version ?? new Version(0, 0, 0);
            return new Version(v.Major, v.Minor, Math.Max(0, v.Build));
        }
    }

    /// <summary>Only installed copies update themselves; a build run from a dev folder never overwrites itself.</summary>
    public static bool CanSelfUpdate => File.Exists(Path.Combine(AppContext.BaseDirectory, ManifestName));

    private static string UpdatesDir => Path.Combine(AppPaths.LocalDataDir, "updates");

    private static HttpClient NewClient()
    {
        var http = new HttpClient { Timeout = TimeSpan.FromMinutes(15) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd($"Snappy/{Current}");
        return http;
    }

    public static async Task<UpdateInfo?> CheckAsync(CancellationToken ct = default)
    {
        using var http = NewClient();
        using var response = await http.GetAsync($"https://api.github.com/repos/{Repo}/releases/latest", ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null; // nothing released yet
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;

        string tag = root.GetProperty("tag_name").GetString() ?? "";
        if (!Version.TryParse(tag.TrimStart('v', 'V'), out var parsed)) return null;
        var version = new Version(parsed.Major, parsed.Minor, Math.Max(0, parsed.Build));
        if (version <= Current) return null;

        string zipName = $"Snappy-{version}-win-x64.zip";
        JsonElement? zip = null;
        string? checksumUrl = null;
        foreach (var asset in root.GetProperty("assets").EnumerateArray())
        {
            string name = asset.GetProperty("name").GetString() ?? "";
            if (name.Equals(zipName, StringComparison.OrdinalIgnoreCase)) zip = asset;
            else if (name.Equals(zipName + ".sha256", StringComparison.OrdinalIgnoreCase)) checksumUrl = asset.GetProperty("browser_download_url").GetString();
        }
        if (zip is not { } z) return null;

        string? sha = z.TryGetProperty("digest", out var digest) && digest.GetString() is { } d && d.StartsWith("sha256:", StringComparison.Ordinal)
            ? d[7..]
            : null;
        if (sha == null && checksumUrl != null)
            sha = (await http.GetStringAsync(checksumUrl, ct)).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();

        return new UpdateInfo(version.ToString(), root.TryGetProperty("body", out var body) ? body.GetString() ?? "" : "",
            root.GetProperty("html_url").GetString() ?? RepoUrl, z.GetProperty("browser_download_url").GetString()!,
            z.GetProperty("size").GetInt64(), sha);
    }

    /// <summary>Downloads and checks the release, then unpacks it next to Snappy's caches. Returns the unpacked app folder.</summary>
    public static async Task<string> DownloadAsync(UpdateInfo update, IProgress<double>? progress, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(update.Sha256) || update.Sha256.Length != 64)
            throw new InvalidOperationException("This release has no checksum, so it can't be verified. Download it from GitHub instead.");

        Directory.CreateDirectory(UpdatesDir);
        string zip = Path.Combine(UpdatesDir, $"Snappy-{update.Version}.zip");
        using (var http = NewClient())
        using (var response = await http.GetAsync(update.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, ct))
        {
            response.EnsureSuccessStatusCode();
            long total = response.Content.Headers.ContentLength ?? update.Size;
            await using var input = await response.Content.ReadAsStreamAsync(ct);
            await using var output = File.Create(zip);
            var buffer = new byte[1 << 16];
            long done = 0;
            int n;
            while ((n = await input.ReadAsync(buffer, ct)) > 0)
            {
                await output.WriteAsync(buffer.AsMemory(0, n), ct);
                done += n;
                if (total > 0) progress?.Report(Math.Min(1, (double)done / total));
            }
        }

        string actual;
        await using (var stream = File.OpenRead(zip))
            actual = Convert.ToHexString(await SHA256.HashDataAsync(stream, ct));
        if (!actual.Equals(update.Sha256, StringComparison.OrdinalIgnoreCase))
        {
            File.Delete(zip);
            throw new InvalidOperationException("The download was damaged, so nothing was changed. Try again later.");
        }

        string staging = Path.Combine(UpdatesDir, $"Snappy-{update.Version}");
        if (Directory.Exists(staging)) Directory.Delete(staging, true);
        ZipFile.ExtractToDirectory(zip, staging);
        File.Delete(zip);

        string appDir = File.Exists(Path.Combine(staging, "Snappy.exe"))
            ? staging
            : Directory.GetDirectories(staging).FirstOrDefault(dir => File.Exists(Path.Combine(dir, "Snappy.exe")))
              ?? throw new InvalidOperationException("The download doesn't contain Snappy");
        if (!File.Exists(Path.Combine(appDir, ManifestName))) throw new InvalidOperationException("The download has no file list");
        Log.Info($"Update {update.Version} downloaded and verified");
        return appDir;
    }

    /// <summary>Starts the downloaded copy, which swaps the files as soon as this process has exited.</summary>
    public static void StartInstall(string stagedAppDir)
    {
        var psi = new ProcessStartInfo(Path.Combine(stagedAppDir, "Snappy.exe")) { UseShellExecute = false };
        psi.ArgumentList.Add("--apply-update");
        psi.ArgumentList.Add(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar));
        psi.ArgumentList.Add(Environment.ProcessId.ToString());
        Process.Start(psi);
    }

    /// <summary>
    /// Runs from the downloaded copy. Waits for the old Snappy to close, deletes the files the old version shipped that
    /// the new one doesn't have, copies the new files in and starts Snappy again. Nothing outside the file lists is touched.
    /// </summary>
    public static int ApplyUpdate(string installDir, int oldPid)
    {
        string source = AppContext.BaseDirectory;
        try
        {
            try
            {
                using var old = Process.GetProcessById(oldPid);
                old.WaitForExit(30_000);
            }
            catch (ArgumentException) { } // already gone

            if (!File.Exists(Path.Combine(installDir, ManifestName)))
                throw new InvalidOperationException("That folder isn't an installed copy of Snappy");
            var newFiles = ReadManifest(source);
            var oldFiles = ReadManifest(installDir);

            foreach (string rel in oldFiles.Except(newFiles, StringComparer.OrdinalIgnoreCase))
                DeleteWithRetry(Path.Combine(installDir, rel));
            foreach (string rel in newFiles)
            {
                string to = Path.Combine(installDir, rel);
                Directory.CreateDirectory(Path.GetDirectoryName(to)!);
                CopyWithRetry(Path.Combine(source, rel), to);
            }
            CopyWithRetry(Path.Combine(source, ManifestName), Path.Combine(installDir, ManifestName));
            RemoveEmptyFolders(installDir);
            Installation.RefreshUninstallEntry(installDir);

            Log.Info($"Updated to {Current}");
            Process.Start(new ProcessStartInfo(Path.Combine(installDir, "Snappy.exe"), "--updated") { UseShellExecute = false });
            return 0;
        }
        catch (Exception ex)
        {
            Log.Error("Update failed", ex);
            MessageBox.Show($"Snappy couldn't finish the update:\n{ex.Message}\n\nYour clips, settings and Studio scenes are untouched. " +
                            $"You can get the new version from {RepoUrl}.", "Snappy", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            string exe = Path.Combine(installDir, "Snappy.exe");
            if (File.Exists(exe)) Process.Start(new ProcessStartInfo(exe) { UseShellExecute = false });
            return 1;
        }
    }

    /// <summary>Removes leftovers from a finished update. Called at startup.</summary>
    public static void CleanUp()
    {
        if (!Directory.Exists(UpdatesDir)) return;
        if (AppContext.BaseDirectory.StartsWith(UpdatesDir, StringComparison.OrdinalIgnoreCase)) return;
        _ = Task.Run(async () =>
        {
            for (int attempt = 0; attempt < 5; attempt++)
            {
                try
                {
                    Directory.Delete(UpdatesDir, true);
                    return;
                }
                catch
                {
                    await Task.Delay(3000); // the copy that did the update may still be closing
                }
            }
        });
    }

    internal static List<string> ReadManifest(string dir)
    {
        var files = new List<string>();
        foreach (string raw in File.ReadAllLines(Path.Combine(dir, ManifestName)))
        {
            string rel = raw.Trim().Replace('/', '\\');
            if (rel.Length == 0) continue;
            if (Path.IsPathRooted(rel) || rel.Split('\\').Contains("..") || rel.Equals(ManifestName, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException($"Unexpected entry in the file list: {rel}");
            files.Add(rel);
        }
        return files;
    }

    private static void CopyWithRetry(string from, string to)
    {
        for (int attempt = 0; ; attempt++)
        {
            try
            {
                File.Copy(from, to, overwrite: true);
                return;
            }
            catch (IOException) when (attempt < 40)
            {
                Thread.Sleep(250); // antivirus or the old process still holding the file
            }
        }
    }

    internal static void DeleteWithRetry(string path)
    {
        for (int attempt = 0; attempt < 20; attempt++)
        {
            try
            {
                if (File.Exists(path)) File.Delete(path);
                return;
            }
            catch (IOException)
            {
                Thread.Sleep(250);
            }
            catch (UnauthorizedAccessException)
            {
                Thread.Sleep(250);
            }
        }
    }

    internal static void RemoveEmptyFolders(string root)
    {
        foreach (string dir in Directory.EnumerateDirectories(root, "*", SearchOption.AllDirectories).OrderByDescending(d => d.Length))
        {
            try
            {
                if (!Directory.EnumerateFileSystemEntries(dir).Any()) Directory.Delete(dir);
            }
            catch { }
        }
    }
}
