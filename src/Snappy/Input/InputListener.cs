using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.Input;

/// <summary>What the input overlay shows at one moment.</summary>
public sealed class InputState
{
    public HashSet<int> Keys { get; } = new();
    public HashSet<int> Buttons { get; } = new();
    public int Wheel { get; set; }  // -1, 0, 1
    public double Vx { get; set; }  // mouse movement over the last 90 ms
    public double Vy { get; set; }
    public long TimeMs { get; set; }
}

/// <summary>
/// Live keyboard and mouse state for the Studio input layer. Only keys some layer asks for are looked at; every other
/// key press is ignored the moment it arrives. Nothing is stored or written anywhere.
/// Uses Raw Input with INPUTSINK, which is read-only and keeps working while a game has focus.
/// Raw Input registration is per process, so there is only ever one listener (see <see cref="InputHub"/>).
/// </summary>
public sealed class InputListener : IDisposable
{
    private const long VelocityWindowHns = 90 * 10_000;
    private const long WheelHoldHns = 180 * 10_000;

    private readonly object _gate = new();
    private readonly Thread _thread;
    private readonly WndProc _wndProc; // keep the delegate alive
    private HashSet<int> _keys = new();
    private readonly HashSet<int> _down = new();
    private readonly HashSet<int> _buttons = new();
    private readonly (long T, int X, int Y)[] _moves = new (long, int, int)[2048];
    private int _moveHead, _moveCount;
    private long _wheelHns;
    private int _wheelDir;
    private int _lastAbsX = int.MinValue, _lastAbsY;
    private uint _threadId;
    private IntPtr _hwnd;

    public InputListener()
    {
        _wndProc = WindowProc;
        _thread = new Thread(Run) { IsBackground = true, Name = "input-listener", Priority = ThreadPriority.AboveNormal };
        _thread.Start();
    }

    public void SetKeys(IEnumerable<int> keys)
    {
        lock (_gate)
        {
            _keys = keys.ToHashSet();
            _down.IntersectWith(_keys);
        }
    }

    public InputState Live()
    {
        long now = Clock.NowHns();
        var st = new InputState { TimeMs = now / 10_000 };
        lock (_gate)
        {
            st.Keys.UnionWith(_down);
            st.Buttons.UnionWith(_buttons);
            if (now - _wheelHns < WheelHoldHns) st.Wheel = _wheelDir;
            long from = now - VelocityWindowHns;
            int vx = 0, vy = 0;
            for (int i = 1; i <= _moveCount; i++)
            {
                var m = _moves[(_moveHead - i + _moves.Length) % _moves.Length];
                if (m.T < from) break;
                vx += m.X;
                vy += m.Y;
            }
            st.Vx = vx;
            st.Vy = vy;
        }
        return st;
    }

    private void Run()
    {
        _threadId = GetCurrentThreadId();
        var wc = new WNDCLASSEX
        {
            cbSize = Marshal.SizeOf<WNDCLASSEX>(),
            lpfnWndProc = Marshal.GetFunctionPointerForDelegate(_wndProc),
            hInstance = GetModuleHandle(null),
            lpszClassName = "SnappyInputSink",
        };
        RegisterClassEx(ref wc);
        _hwnd = CreateWindowEx(0, "SnappyInputSink", "", 0, 0, 0, 0, 0, new IntPtr(-3) /* HWND_MESSAGE */, IntPtr.Zero, wc.hInstance, IntPtr.Zero);

        var devices = new[]
        {
            new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 6, dwFlags = RIDEV_INPUTSINK, hwndTarget = _hwnd }, // keyboard
            new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 2, dwFlags = RIDEV_INPUTSINK, hwndTarget = _hwnd }, // mouse
        };
        if (!RegisterRawInputDevices(devices, (uint)devices.Length, (uint)Marshal.SizeOf<RAWINPUTDEVICE>()))
            Log.Warn($"Input listener: RegisterRawInputDevices failed ({Marshal.GetLastWin32Error()})");

        while (GetMessage(out MSG msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }

        var remove = new[]
        {
            new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 6, dwFlags = RIDEV_REMOVE },
            new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 2, dwFlags = RIDEV_REMOVE },
        };
        RegisterRawInputDevices(remove, 2, (uint)Marshal.SizeOf<RAWINPUTDEVICE>());
        DestroyWindow(_hwnd);
    }

    private unsafe IntPtr WindowProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        if (msg != WM_INPUT) return DefWindowProc(hwnd, msg, wParam, lParam);

        uint size = 0;
        uint headerSize = (uint)sizeof(RAWINPUTHEADER);
        GetRawInputData(lParam, RID_INPUT, IntPtr.Zero, ref size, headerSize);
        if (size == 0 || size > 1024) return DefWindowProc(hwnd, msg, wParam, lParam);
        byte* buffer = stackalloc byte[(int)size];
        if (GetRawInputData(lParam, RID_INPUT, (IntPtr)buffer, ref size, headerSize) != size)
            return DefWindowProc(hwnd, msg, wParam, lParam);

        long now = Clock.NowHns();
        var header = (RAWINPUTHEADER*)buffer;
        byte* data = buffer + headerSize;

        lock (_gate)
        {
            if (header->dwType == RIM_TYPEKEYBOARD)
            {
                var kb = (RAWKEYBOARD*)data;
                int vk = kb->VKey;
                if (_keys.Contains(vk))
                {
                    if ((kb->Flags & RI_KEY_BREAK) != 0) _down.Remove(vk);
                    else _down.Add(vk);
                }
            }
            else if (header->dwType == RIM_TYPEMOUSE)
            {
                var m = (RAWMOUSE*)data;
                ushort f = m->usButtonFlags;
                for (int b = 0; b < 5; b++)
                {
                    if ((f & (1 << (b * 2))) != 0) _buttons.Add(b + 1);
                    if ((f & (2 << (b * 2))) != 0) _buttons.Remove(b + 1);
                }
                if ((f & RI_MOUSE_WHEEL) != 0)
                {
                    _wheelHns = now;
                    _wheelDir = Math.Sign((short)m->usButtonData);
                }

                int dx, dy;
                if ((m->usFlags & MOUSE_MOVE_ABSOLUTE) != 0)
                {
                    // Tablets and remote desktop report absolute positions, so turn them into deltas.
                    if (_lastAbsX == int.MinValue) { _lastAbsX = m->lLastX; _lastAbsY = m->lLastY; }
                    dx = (m->lLastX - _lastAbsX) / 32;
                    dy = (m->lLastY - _lastAbsY) / 32;
                    _lastAbsX = m->lLastX;
                    _lastAbsY = m->lLastY;
                }
                else
                {
                    dx = m->lLastX;
                    dy = m->lLastY;
                }
                if (dx != 0 || dy != 0)
                {
                    _moves[_moveHead] = (now, dx, dy);
                    _moveHead = (_moveHead + 1) % _moves.Length;
                    if (_moveCount < _moves.Length) _moveCount++;
                }
            }
        }
        return DefWindowProc(hwnd, msg, wParam, lParam);
    }

    public void Dispose()
    {
        if (_threadId != 0) PostThreadMessage(_threadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
        if (_thread.IsAlive) _thread.Join(1000);
    }

    private const uint WM_INPUT = 0x00FF, WM_QUIT = 0x0012, RID_INPUT = 0x10000003;
    private const uint RIDEV_INPUTSINK = 0x00000100, RIDEV_REMOVE = 0x00000001;
    private const uint RIM_TYPEMOUSE = 0, RIM_TYPEKEYBOARD = 1;
    private const ushort RI_KEY_BREAK = 1, RI_MOUSE_WHEEL = 0x0400, MOUSE_MOVE_ABSOLUTE = 1;

    private delegate IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct RAWINPUTDEVICE { public ushort usUsagePage, usUsage; public uint dwFlags; public IntPtr hwndTarget; }

    [StructLayout(LayoutKind.Sequential)]
    private struct RAWINPUTHEADER { public uint dwType, dwSize; public IntPtr hDevice, wParam; }

    [StructLayout(LayoutKind.Sequential)]
    private struct RAWKEYBOARD { public ushort MakeCode, Flags, Reserved, VKey; public uint Message, ExtraInformation; }

    [StructLayout(LayoutKind.Explicit)]
    private struct RAWMOUSE
    {
        [FieldOffset(0)] public ushort usFlags;
        [FieldOffset(4)] public ushort usButtonFlags;
        [FieldOffset(6)] public ushort usButtonData;
        [FieldOffset(8)] public uint ulRawButtons;
        [FieldOffset(12)] public int lLastX;
        [FieldOffset(16)] public int lLastY;
        [FieldOffset(20)] public uint ulExtraInformation;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WNDCLASSEX
    {
        public int cbSize; public uint style; public IntPtr lpfnWndProc; public int cbClsExtra, cbWndExtra;
        public IntPtr hInstance, hIcon, hCursor, hbrBackground; public string? lpszMenuName; public string lpszClassName; public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int x, y; }

    [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] devices, uint count, uint size);
    [DllImport("user32.dll")] private static extern uint GetRawInputData(IntPtr hRawInput, uint command, IntPtr data, ref uint size, uint headerSize);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern ushort RegisterClassEx(ref WNDCLASSEX wc);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateWindowEx(uint exStyle, string cls, string name, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr param);
    [DllImport("user32.dll")] private static extern bool DestroyWindow(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern IntPtr DefWindowProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern int GetMessage(out MSG msg, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread, uint msg, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
}

/// <summary>Shares the single <see cref="InputListener"/> between everything that wants live input.</summary>
public static class InputHub
{
    private static readonly object Gate = new();
    private static readonly Dictionary<object, HashSet<int>> Claims = new();
    private static InputListener? _listener;

    public static InputListener Claim(object owner, IEnumerable<int> keys)
    {
        lock (Gate)
        {
            Claims[owner] = keys.ToHashSet();
            _listener ??= new InputListener();
            _listener.SetKeys(Claims.Values.SelectMany(k => k));
            return _listener;
        }
    }

    public static void Release(object owner)
    {
        lock (Gate)
        {
            if (!Claims.Remove(owner)) return;
            if (Claims.Count == 0)
            {
                _listener?.Dispose();
                _listener = null;
            }
            else
            {
                _listener?.SetKeys(Claims.Values.SelectMany(k => k));
            }
        }
    }
}
