using Microsoft.Win32;
using Snappy.Core;

namespace Snappy.Platform;

/// <summary>"Start with Windows": a per-user Run entry (no admin rights, removable from Task Manager > Startup apps).</summary>
public static class Autostart
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "Snappy";

    private static string Command => $"\"{Environment.ProcessPath}\" --background";

    public static bool IsEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey);
        return key?.GetValue(ValueName) is string v && v.Equals(Command, StringComparison.OrdinalIgnoreCase);
    }

    public static void Apply(bool enabled)
    {
        if (AppPaths.IsIsolatedTestRun) return; // test runs never touch the real startup entry
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKey);
            if (enabled) key.SetValue(ValueName, Command);
            else if (key.GetValue(ValueName) != null) key.DeleteValue(ValueName);
        }
        catch (Exception ex)
        {
            Log.Error("Updating the Start with Windows entry failed", ex);
        }
    }
}
