using System.Runtime.InteropServices;

namespace Snappy.UI;

/// <summary>
/// The other windows on the screen, the way Snappy sees them when she's out on the desktop: the visible parts of their
/// top edges are ledges she can stand on, and she clears them off the desktop for a while. Only ordinary windows count
/// (never Snappy's own, never a full screen game or video), and every window she clears comes back exactly as it was.
/// </summary>
internal static class DesktopWindows
{
    /// <summary>Windows on the given part of the screen, front to back, with the rectangle you actually see.</summary>
    private static List<(IntPtr Hwnd, Rectangle Rect)> Ordinary(Rectangle area)
    {
        var found = new List<(IntPtr, Rectangle)>();
        int self = Environment.ProcessId;
        EnumWindows((hwnd, _) =>
        {
            if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || IsZoomed(hwnd) || GetWindow(hwnd, 4 /* GW_OWNER */) != IntPtr.Zero) return true;
            if (GetWindowTextLength(hwnd) == 0) return true;
            if ((GetWindowLong(hwnd, -20 /* GWL_EXSTYLE */) & 0x80 /* TOOLWINDOW */) != 0) return true;
            GetWindowThreadProcessId(hwnd, out int pid);
            if (pid == self) return true;
            if (DwmGetWindowAttribute(hwnd, 14 /* DWMWA_CLOAKED */, out int cloaked, 4) == 0 && cloaked != 0) return true;
            if (DwmGetWindowAttribute(hwnd, 9 /* DWMWA_EXTENDED_FRAME_BOUNDS */, out RECT r, Marshal.SizeOf<RECT>()) != 0) return true;
            var rect = Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
            if (rect.Width < 120 || rect.Height < 80 || !area.IntersectsWith(rect)) return true;
            // full screen is a game or a video, never a playground
            if (rect.Contains(Screen.FromRectangle(rect).Bounds)) return true;
            found.Add((hwnd, rect));
            return true;
        }, IntPtr.Zero);
        return found;
    }

    /// <summary>
    /// The top edges she could stand on: (left, right, y) in screen pixels, only the stretches no window in front
    /// covers, and only where there's room for her.
    /// </summary>
    public static List<(int Left, int Right, int Y)> Ledges(Rectangle area, int minWidth)
    {
        var windows = Ordinary(area);
        var ledges = new List<(int, int, int)>();
        for (int i = 0; i < windows.Count; i++)
        {
            var r = windows[i].Rect;
            if (r.Top <= area.Top + minWidth) continue;
            var free = new List<(int L, int R)> { (Math.Max(r.Left, area.Left), Math.Min(r.Right, area.Right)) };
            for (int j = 0; j < i; j++)
            {
                var above = windows[j].Rect;
                if (above.Top > r.Top - 4 || above.Bottom < r.Top) continue;
                free = free.SelectMany(f => f.R <= above.Left || f.L >= above.Right ? new[] { f }
                    : new[] { (f.L, Math.Min(f.R, above.Left)), (Math.Max(f.L, above.Right), f.R) }.Where(x => x.Item2 - x.Item1 > 0)).ToList();
            }
            ledges.AddRange(free.Where(f => f.R - f.L >= minWidth).Select(f => (f.L, f.R, r.Top)));
        }
        return ledges;
    }

    /// <summary>The windows she cleared off the desktop, each with exactly how it was shown, so they can come back.</summary>
    public sealed class Cleared
    {
        internal readonly List<(IntPtr Hwnd, WINDOWPLACEMENT Was)> Windows = new();
        public int Count => Windows.Count;
    }

    /// <summary>
    /// Clears the desktop the way Win+D would, for the windows on this screen only: every ordinary window (maximized ones
    /// too, never a full screen game or video) is minimized without taking the focus anywhere.
    /// </summary>
    public static Cleared ClearDesktop(Rectangle area)
    {
        var cleared = new Cleared();
        int self = Environment.ProcessId;
        EnumWindows((hwnd, _) =>
        {
            if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || GetWindow(hwnd, 4 /* GW_OWNER */) != IntPtr.Zero || GetWindowTextLength(hwnd) == 0) return true;
            if ((GetWindowLong(hwnd, -20 /* GWL_EXSTYLE */) & 0x80 /* TOOLWINDOW */) != 0) return true;
            GetWindowThreadProcessId(hwnd, out int pid);
            if (pid == self) return true;
            if (DwmGetWindowAttribute(hwnd, 14 /* DWMWA_CLOAKED */, out int cloaked, 4) == 0 && cloaked != 0) return true;
            if (!GetWindowRect(hwnd, out RECT r)) return true;
            var rect = Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
            if (!area.IntersectsWith(rect) || (rect.Contains(Screen.FromRectangle(rect).Bounds) && !IsZoomed(hwnd))) return true;
            var was = new WINDOWPLACEMENT { length = Marshal.SizeOf<WINDOWPLACEMENT>() };
            if (!GetWindowPlacement(hwnd, ref was)) return true;
            cleared.Windows.Add((hwnd, was));
            return true;
        }, IntPtr.Zero);
        foreach (var (hwnd, _) in cleared.Windows) ShowWindowAsync(hwnd, 7 /* SW_SHOWMINNOACTIVE */);
        return cleared;
    }

    /// <summary>Every window she cleared away, back as it was (maximized ones maximized again), back to front.</summary>
    public static void Restore(Cleared cleared)
    {
        foreach (var (hwnd, was) in Enumerable.Reverse(cleared.Windows))
        {
            if (!IsWindow(hwnd) || !IsIconic(hwnd)) continue;   // closed, or already brought back by hand
            var back = was;
            back.showCmd = was.showCmd == 3 /* SW_SHOWMAXIMIZED */ ? 3u : 4u /* SW_SHOWNOACTIVATE */;
            SetWindowPlacement(hwnd, ref back);
        }
    }

    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)]
    internal struct WINDOWPLACEMENT { public int length; public uint flags; public uint showCmd; private POINT min, max; private RECT normal; }
    private delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
    [DllImport("user32.dll", EntryPoint = "GetWindowTextLengthW")] private static extern int GetWindowTextLength(IntPtr hwnd);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out int pid);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] private static extern bool GetWindowPlacement(IntPtr hwnd, ref WINDOWPLACEMENT placement);
    [DllImport("user32.dll")] private static extern bool SetWindowPlacement(IntPtr hwnd, ref WINDOWPLACEMENT placement);
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr hwnd, int cmd);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out int value, int size);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT value, int size);
}
