using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace Snappy.Platform;

/// <summary>Figures out what you were doing when you clipped, so clips land in a per-game/app folder like ShadowPlay.</summary>
public static class ForegroundApp
{
    private static readonly HashSet<string> ShellProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "explorer", "ShellExperienceHost", "StartMenuExperienceHost", "SearchHost", "SearchApp",
        "LockApp", "Snappy", "ApplicationFrameHost", "TextInputHost", "dwm", "Idle",
    };

    private static readonly string[] GenericProductNames =
    {
        "Unity", "Unreal", "Microsoft® Windows® Operating System", "Microsoft Windows Operating System", "Game", "Launcher",
    };

    public static string DetectFolderName()
    {
        try
        {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return "Desktop";
            GetWindowThreadProcessId(hwnd, out uint pid);
            using var proc = Process.GetProcessById((int)pid);
            if (ShellProcesses.Contains(proc.ProcessName)) return "Desktop";

            string? exe = ProcessImagePath(pid);
            string? name = null;
            if (exe != null)
            {
                var info = FileVersionInfo.GetVersionInfo(exe);
                name = PickName(info.ProductName) ?? PickName(info.FileDescription);
            }
            name ??= PickName(WindowTitle(hwnd));
            name ??= proc.ProcessName.Replace("-Win64-Shipping", "", StringComparison.OrdinalIgnoreCase);
            return SanitizeFolderName(name);
        }
        catch
        {
            return "Desktop";
        }
    }

    /// <summary>Process of the app in front, or null for the desktop and Windows itself.</summary>
    public static (int Pid, string Name)? Current()
    {
        try
        {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return null;
            GetWindowThreadProcessId(hwnd, out uint pid);
            using var proc = Process.GetProcessById((int)pid);
            return ShellProcesses.Contains(proc.ProcessName) ? null : ((int)pid, proc.ProcessName);
        }
        catch
        {
            return null;
        }
    }

    public static bool IsRunning(int pid, string processName)
    {
        try
        {
            using var proc = Process.GetProcessById(pid);
            return string.Equals(proc.ProcessName, processName, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Apps with an open window right now, for linking games to Studio scenes.</summary>
    public static List<(string Exe, string Name)> RunningApps()
    {
        var apps = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        using var self = Process.GetCurrentProcess();
        foreach (var proc in Process.GetProcesses())
        {
            using (proc)
            {
                try
                {
                    if (proc.SessionId != self.SessionId || apps.ContainsKey(proc.ProcessName) || ShellProcesses.Contains(proc.ProcessName)) continue;
                    if (proc.MainWindowHandle == IntPtr.Zero || proc.MainWindowTitle.Length == 0) continue;
                    string? exe = ProcessImagePath((uint)proc.Id);
                    apps[proc.ProcessName] = exe != null ? NameForExe(exe) : proc.ProcessName;
                }
                catch
                {
                    // exited meanwhile, or protected by anti-cheat
                }
            }
        }
        return apps.Select(kv => (kv.Key, kv.Value)).OrderBy(a => a.Value, StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>Friendly name from an exe's version info, or its file name.</summary>
    public static string NameForExe(string path)
    {
        string? name = null;
        try
        {
            var info = FileVersionInfo.GetVersionInfo(path);
            name = PickName(info.ProductName) ?? PickName(info.FileDescription);
        }
        catch { }
        return name ?? Path.GetFileNameWithoutExtension(path).Replace("-Win64-Shipping", "", StringComparison.OrdinalIgnoreCase);
    }

    public static string SanitizeFolderName(string name)
    {
        var sb = new StringBuilder();
        foreach (char c in name)
        {
            if (c is '™' or '®' or '©') continue;
            sb.Append(Array.IndexOf(Path.GetInvalidFileNameChars(), c) >= 0 ? ' ' : c);
        }
        string s = string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries)).Trim(' ', '.');
        if (s.Length > 60) s = s[..60].Trim();
        return s.Length == 0 ? "Desktop" : s;
    }

    private static string? PickName(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate)) return null;
        candidate = candidate.Trim();
        if (GenericProductNames.Any(g => candidate.StartsWith(g, StringComparison.OrdinalIgnoreCase))) return null;
        foreach (string suffix in new[] { " Internet Browser", " Web Browser", " Browser" })
        {
            if (candidate.EndsWith(suffix, StringComparison.OrdinalIgnoreCase) && candidate.Length > suffix.Length + 2)
            {
                candidate = candidate[..^suffix.Length]; // "Opera GX Internet Browser" -> "Opera GX"
                break;
            }
        }
        return candidate;
    }

    private static string? WindowTitle(IntPtr hwnd)
    {
        var sb = new StringBuilder(256);
        return GetWindowText(hwnd, sb, sb.Capacity) > 0 ? sb.ToString() : null;
    }

    private static string? ProcessImagePath(uint pid)
    {
        IntPtr h = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid);
        if (h == IntPtr.Zero) return null;
        try
        {
            var sb = new StringBuilder(1024);
            int size = sb.Capacity;
            return QueryFullProcessImageName(h, 0, sb, ref size) ? sb.ToString() : null;
        }
        finally { CloseHandle(h); }
    }

    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hwnd, StringBuilder sb, int max);
    [DllImport("kernel32.dll")] private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder sb, ref int size);
}
