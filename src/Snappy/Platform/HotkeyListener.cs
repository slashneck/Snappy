using System.Runtime.InteropServices;
using System.Windows.Forms;
using Snappy.Core;

namespace Snappy.Platform;

/// <summary>
/// Global hotkeys via a low-level keyboard hook on its own thread. Unlike RegisterHotKey this still fires in games
/// that block normal hotkeys, it doesn't steal the key from other apps, and the hook is re-armed every 30 s because
/// Windows silently drops hooks that ever respond too slowly.
/// </summary>
public sealed class HotkeyListener : IDisposable
{
    private readonly Thread _thread;
    private readonly LowLevelKeyboardProc _proc; // keep delegate alive
    private IntPtr _hook;
    private uint _threadId;
    private volatile HotkeySetting[] _hotkeys = Array.Empty<HotkeySetting>();
    private readonly HashSet<int> _held = new();

    /// <summary>Raised on a thread-pool thread with the index of the hotkey that fired.</summary>
    public event Action<int>? Pressed;

    public HotkeyListener()
    {
        _proc = HookCallback;
        _thread = new Thread(Run) { IsBackground = true, Name = "hotkeys", Priority = ThreadPriority.Highest };
        _thread.Start();
    }

    public void SetHotkeys(params HotkeySetting[] hotkeys) => _hotkeys = hotkeys;

    private void Run()
    {
        _threadId = GetCurrentThreadId();
        Install();
        SetTimer(IntPtr.Zero, IntPtr.Zero, 30_000, IntPtr.Zero);
        while (GetMessage(out MSG msg, IntPtr.Zero, 0, 0) > 0)
        {
            if (msg.message == WM_TIMER) Install();
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
        if (_hook != IntPtr.Zero) UnhookWindowsHookEx(_hook);
    }

    private void Install()
    {
        IntPtr fresh = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(null), 0);
        if (fresh == IntPtr.Zero)
        {
            Log.Warn($"SetWindowsHookEx failed: {Marshal.GetLastWin32Error()}");
            return;
        }
        if (_hook != IntPtr.Zero) UnhookWindowsHookEx(_hook);
        _hook = fresh;
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int msg = (int)wParam;
            int vk = Marshal.ReadInt32(lParam);
            if (msg is WM_KEYDOWN or WM_SYSKEYDOWN)
            {
                if (_held.Add(vk)) // ignore auto-repeat
                {
                    var hks = _hotkeys;
                    for (int i = 0; i < hks.Length; i++)
                    {
                        if (Matches(hks[i], vk))
                        {
                            int index = i;
                            ThreadPool.QueueUserWorkItem(_ => Pressed?.Invoke(index));
                        }
                    }
                }
            }
            else if (msg is WM_KEYUP or WM_SYSKEYUP)
            {
                _held.Remove(vk);
            }
        }
        return CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    private static bool Matches(HotkeySetting hk, int vk)
    {
        if (!hk.IsSet || (int)hk.Key != vk) return false;
        return IsDown(Keys.ControlKey) == hk.Ctrl
               && IsDown(Keys.Menu) == hk.Alt
               && IsDown(Keys.ShiftKey) == hk.Shift
               && (IsDown(Keys.LWin) || IsDown(Keys.RWin)) == hk.Win;
    }

    private static bool IsDown(Keys k) => (GetAsyncKeyState((int)k) & 0x8000) != 0;

    public void Dispose()
    {
        if (_threadId != 0) PostThreadMessage(_threadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
    }

    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x100, WM_KEYUP = 0x101, WM_SYSKEYDOWN = 0x104, WM_SYSKEYUP = 0x105;
    private const int WM_TIMER = 0x113, WM_QUIT = 0x12;

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG { public IntPtr hwnd; public int message; public IntPtr wParam, lParam; public uint time; public int x, y; }

    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, LowLevelKeyboardProc fn, IntPtr mod, uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int vk);
    [DllImport("user32.dll")] private static extern int GetMessage(out MSG msg, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread, int msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] private static extern IntPtr SetTimer(IntPtr hwnd, IntPtr id, uint ms, IntPtr fn);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
}
