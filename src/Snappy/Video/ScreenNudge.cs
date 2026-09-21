using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.Video;

/// <summary>
/// Both ways of grabbing the screen only hand out a frame when something on it changes. On a completely still screen
/// that means no frames at all, and a clip saved then would end where the screen last moved. So when frames stop
/// coming for a moment, this flashes a single pixel in the corner of the recorded monitor. Windows redraws, the
/// grabber hands out a frame of the unchanged screen, and the replay keeps going. The pixel is nearly transparent,
/// left out of every recording and screenshot, and never shows up while anything on screen moves, which includes
/// every game.
/// </summary>
internal sealed class ScreenNudge : IDisposable
{
    private const long QuietHns = 250 * 10_000;

    private readonly Func<long> _lastFrameHns;
    private readonly Thread _thread;
    private volatile bool _stop;
    private volatile DisplayInfo? _display;

    public ScreenNudge(Func<long> lastFrameHns)
    {
        _lastFrameHns = lastFrameHns;
        _thread = new Thread(Run) { IsBackground = true, Name = "screen-nudge" };
        _thread.Start();
    }

    /// <summary>The monitor being recorded, or null while nothing is recorded.</summary>
    public DisplayInfo? Display
    {
        set => _display = value;
    }

    private void Run()
    {
        IntPtr instance = GetModuleHandle(null);
        var wc = new WNDCLASSEX
        {
            cbSize = Marshal.SizeOf<WNDCLASSEX>(),
            lpfnWndProc = GetProcAddress(GetModuleHandle("user32.dll"), "DefWindowProcW"),
            hInstance = instance,
            lpszClassName = "SnappyNudge",
        };
        RegisterClassEx(ref wc);
        IntPtr hwnd = CreateWindowEx(
            WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TOPMOST,
            "SnappyNudge", "", WS_POPUP, 0, 0, 1, 1, IntPtr.Zero, IntPtr.Zero, instance, IntPtr.Zero);
        if (hwnd == IntPtr.Zero)
        {
            Log.Warn("The screen nudge window couldn't be created; still screens may pause the replay");
            return;
        }
        SetLayeredWindowAttributes(hwnd, 0, 1, LWA_ALPHA);
        if (!SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)) SetWindowDisplayAffinity(hwnd, WDA_MONITOR);

        bool shown = false;
        try
        {
            while (!_stop)
            {
                MsgWaitForMultipleObjectsEx(0, IntPtr.Zero, 100, QS_ALLINPUT, 0);
                while (PeekMessage(out MSG msg, IntPtr.Zero, 0, 0, PM_REMOVE)) DispatchMessage(ref msg);

                var display = _display;
                bool quiet = display != null && Clock.NowHns() - _lastFrameHns() > QuietHns;
                if (quiet)
                {
                    // Every change of the pixel is one redraw, and one redraw is one fresh frame of the still screen.
                    if (!shown)
                        SetWindowPos(hwnd, HWND_TOPMOST, display!.X + display.Width - 1, display.Y + display.Height - 1, 1, 1,
                            SWP_NOACTIVATE | SWP_SHOWWINDOW);
                    else
                        ShowWindow(hwnd, SW_HIDE);
                    shown = !shown;
                }
                else if (shown)
                {
                    ShowWindow(hwnd, SW_HIDE);
                    shown = false;
                }
            }
        }
        finally
        {
            DestroyWindow(hwnd);
        }
    }

    public void Dispose()
    {
        _stop = true;
        if (_thread.IsAlive) _thread.Join(1000);
    }

    private const uint WS_POPUP = 0x80000000;
    private const uint WS_EX_LAYERED = 0x80000, WS_EX_TRANSPARENT = 0x20, WS_EX_TOOLWINDOW = 0x80, WS_EX_NOACTIVATE = 0x08000000, WS_EX_TOPMOST = 0x8;
    private const uint LWA_ALPHA = 0x2, WDA_MONITOR = 0x1, WDA_EXCLUDEFROMCAPTURE = 0x11;
    private const uint SWP_NOACTIVATE = 0x10, SWP_SHOWWINDOW = 0x40, QS_ALLINPUT = 0x4FF, PM_REMOVE = 0x1;
    private const int SW_HIDE = 0;
    private static readonly IntPtr HWND_TOPMOST = new(-1);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WNDCLASSEX
    {
        public int cbSize; public uint style; public IntPtr lpfnWndProc; public int cbClsExtra, cbWndExtra;
        public IntPtr hInstance, hIcon, hCursor, hbrBackground; public string? lpszMenuName; public string lpszClassName; public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int x, y; }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern ushort RegisterClassEx(ref WNDCLASSEX wc);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateWindowEx(uint exStyle, string cls, string name, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr param);
    [DllImport("user32.dll")] private static extern bool DestroyWindow(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint key, byte alpha, uint flags);
    [DllImport("user32.dll")] private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out MSG msg, IntPtr hwnd, uint min, uint max, uint remove);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern uint MsgWaitForMultipleObjectsEx(uint count, IntPtr handles, uint ms, uint wakeMask, uint flags);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("kernel32.dll", CharSet = CharSet.Ansi)] private static extern IntPtr GetProcAddress(IntPtr module, string name);
}
