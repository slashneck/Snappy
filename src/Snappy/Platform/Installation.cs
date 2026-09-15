using System.Diagnostics;
using Microsoft.Win32;
using Snappy.Core;
using Snappy.UI;

namespace Snappy.Platform;

/// <summary>
/// The per-user install the setup creates: the "Installed apps" entry and uninstalling.
/// Uninstalling removes the program only. Clips, screenshots, settings and Studio scenes stay on the PC.
/// </summary>
public static class Installation
{
    private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Snappy";

    public static void RefreshUninstallEntry(string installDir)
    {
        if (AppPaths.IsIsolatedTestRun) return; // test runs never touch the real "Installed apps" list
        try
        {
            string exe = Path.Combine(installDir, "Snappy.exe");
            long kb = new DirectoryInfo(installDir).EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length) / 1024;
            using var key = Registry.CurrentUser.CreateSubKey(UninstallKey);
            key.SetValue("DisplayName", "Snappy");
            key.SetValue("DisplayVersion", Updater.Current.ToString());
            key.SetValue("Publisher", "Snappy");
            key.SetValue("DisplayIcon", exe);
            key.SetValue("InstallLocation", installDir);
            key.SetValue("UninstallString", $"\"{exe}\" --uninstall");
            key.SetValue("URLInfoAbout", Updater.RepoUrl);
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            key.SetValue("EstimatedSize", (int)Math.Min(int.MaxValue, kb), RegistryValueKind.DWord);
        }
        catch (Exception ex)
        {
            Log.Warn($"Couldn't update the uninstall entry: {ex.Message}");
        }
    }

    public static int Uninstall()
    {
        string installDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        if (!File.Exists(Path.Combine(installDir, Updater.ManifestName)))
        {
            DarkDialog.Ask("Nothing to uninstall", "This copy of Snappy wasn't installed by the setup, so you can simply delete its folder.", "OK", null);
            return 1;
        }
        var settings = AppSettings.Load();
        if (!DarkDialog.Ask("Uninstall Snappy?",
                "Snappy is removed from this PC. Your clips, screenshots, settings and Studio scenes stay where they are.",
                "Uninstall"))
            return 1;

        StopOtherInstances(installDir);
        try { Autostart.Apply(false); } catch { }
        foreach (string shortcut in new[]
                 {
                     Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Snappy.lnk"),
                     Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Snappy.lnk"),
                 })
        {
            try { File.Delete(shortcut); } catch { }
        }
        try { Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, throwOnMissingSubKey: false); } catch { }

        string self = Environment.ProcessPath ?? Path.Combine(installDir, "Snappy.exe");
        foreach (string rel in Updater.ReadManifest(installDir))
        {
            string path = Path.Combine(installDir, rel);
            if (!path.Equals(self, StringComparison.OrdinalIgnoreCase)) Updater.DeleteWithRetry(path);
        }
        Updater.DeleteWithRetry(Path.Combine(installDir, Updater.ManifestName));
        Updater.RemoveEmptyFolders(installDir);

        // Caches only (thumbnails, previews, the WebView profile). Settings live in the roaming folder and stay.
        try { Directory.Delete(AppPaths.LocalDataDir, recursive: true); } catch { }

        DarkDialog.Ask("Snappy is uninstalled", $"Your clips are still in {settings.ClipsFolder}.", "OK", null);

        // The running exe can't delete itself, so a short-lived cmd removes it and the then empty folder.
        Process.Start(new ProcessStartInfo("cmd.exe",
            $"/c ping 127.0.0.1 -n 3 >nul & del /f /q \"{self}\" & rd \"{installDir}\"")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
        });
        return 0;
    }

    private static void StopOtherInstances(string installDir)
    {
        foreach (var proc in Process.GetProcessesByName("Snappy"))
        {
            using (proc)
            {
                try
                {
                    if (proc.Id == Environment.ProcessId) continue;
                    string? path = proc.MainModule?.FileName;
                    if (path == null || !path.StartsWith(installDir, StringComparison.OrdinalIgnoreCase)) continue;
                    proc.Kill(entireProcessTree: true);
                    proc.WaitForExit(5000);
                }
                catch { }
            }
        }
    }
}
