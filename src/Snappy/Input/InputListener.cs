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
/// Uses Raw Input with INPUTSINK, which is read-only and keeps working while a game has focus. The mouse is only
/// listened to when a layer draws it, and input is read in batches a few times per frame instead of once per event,
/// so a mouse polling at 4000 or 8000 Hz doesn't wake Snappy thousands of times a second.
/// Raw Input registration is per process, so there is only ever one listener (see <see cref="InputHub"/>).
/// </summary>
public sealed class InputListener : IDisposable
{
    private const long VelocityWindowHns = 90 * 10_000;
    private const long WheelHoldHns = 180 * 10_000;
    private const int BatchMs = 6;

    private readonly object _gate = new();
    private readonly Thread _thread;
    private HashSet<int> _keys = new();
    private readonly HashSet<int> _down = new();
    private readonly HashSet<int> _buttons = new();
    private readonly (long T, int X, int Y)[] _moves = new (long, int, int)[4096];
    private int _moveHead, _moveCount;
    private long _wheelHns;
    private int _wheelDir;
    private int _lastAbsX = int.MinValue, _lastAbsY;
    private volatile bool _wantMouse, _stop;
    private bool _hasKeyboard, _hasMouse;
    private uint _threadId;
    private IntPtr _hwnd;

    public InputListener()
    {
        _thread = new Thread(Run) { IsBackground = true, Name = "input-listener", Priority = ThreadPriority.AboveNormal };
        _thread.Start();
    }

    public void SetKeys(IEnumerable<int> keys, bool mouse)
    {
        lock (_gate)
        {
            _keys = keys.ToHashSet();
            _down.IntersectWith(_keys);
            if (!mouse) { _buttons.Clear(); _moveCount = 0; }
        }
        _wantMouse = mouse;
        if (_threadId != 0) PostThreadMessage(_threadId, WM_APP_REGISTER, IntPtr.Zero, IntPtr.Zero);
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

    private unsafe void Run()
    {
        // The window only exists as a target for Raw Input and never handles a message itself, so it can use the
        // system's default procedure. No callback into this object means no stale callback once it is gone.
        IntPtr instance = GetModuleHandle(null);
        var wc = new WNDCLASSEX
        {
            cbSize = Marshal.SizeOf<WNDCLASSEX>(),
            lpfnWndProc = GetProcAddress(GetModuleHandle("user32.dll"), "DefWindowProcW"),
            hInstance = instance,
            lpszClassName = "SnappyInputSink",
        };
        RegisterClassEx(ref wc); // fails harmlessly when an earlier listener already registered it
        _hwnd = CreateWindowEx(0, "SnappyInputSink", "", 0, 0, 0, 0, 0, new IntPtr(-3) /* HWND_MESSAGE */, IntPtr.Zero, instance, IntPtr.Zero);
        _threadId = GetCurrentThreadId(); // only now does this thread have a queue that can take posted messages
        Register();

        const int bufferSize = 64 * 1024;
        IntPtr buffer = Marshal.AllocHGlobal(bufferSize);
        try
        {
            while (!_stop)
            {
                // Sleep until input or a message arrives, then give the queue a moment to fill so it's read in one go.
                MsgWaitForMultipleObjectsEx(0, IntPtr.Zero, 1000, QS_RAWINPUT | QS_POSTMESSAGE, MWMO_INPUTAVAILABLE);
                if (_stop) break;
                Thread.Sleep(BatchMs);
                Drain(buffer, bufferSize);

                while (PeekMessage(out MSG msg, IntPtr.Zero, 0, 0, PM_REMOVE))
                {
                    if (msg.message == WM_QUIT) { _stop = true; break; }
                    if (msg.message == WM_APP_REGISTER) Register();
                    else if (msg.message == WM_INPUT) One(msg.lParam);
                    else DispatchMessage(ref msg);
                }
            }
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
            var remove = new List<RAWINPUTDEVICE>();
            if (_hasKeyboard) remove.Add(new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 6, dwFlags = RIDEV_REMOVE });
            if (_hasMouse) remove.Add(new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 2, dwFlags = RIDEV_REMOVE });
            if (remove.Count > 0) RegisterRawInputDevices(remove.ToArray(), (uint)remove.Count, (uint)Marshal.SizeOf<RAWINPUTDEVICE>());
            DestroyWindow(_hwnd);
        }
    }

    /// <summary>Signs up for the keyboard when keys are wanted and the mouse only when a layer draws it.</summary>
    private void Register()
    {
        bool keyboard;
        lock (_gate) keyboard = _keys.Count > 0;
        bool mouse = _wantMouse;
        var change = new List<RAWINPUTDEVICE>();
        if (keyboard != _hasKeyboard)
            change.Add(new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 6, dwFlags = keyboard ? RIDEV_INPUTSINK : RIDEV_REMOVE, hwndTarget = keyboard ? _hwnd : IntPtr.Zero });
        if (mouse != _hasMouse)
            change.Add(new RAWINPUTDEVICE { usUsagePage = 1, usUsage = 2, dwFlags = mouse ? RIDEV_INPUTSINK : RIDEV_REMOVE, hwndTarget = mouse ? _hwnd : IntPtr.Zero });
        if (change.Count == 0) return;
        if (!RegisterRawInputDevices(change.ToArray(), (uint)change.Count, (uint)Marshal.SizeOf<RAWINPUTDEVICE>()))
        {
            Log.Warn($"Input listener: RegisterRawInputDevices failed ({Marshal.GetLastWin32Error()})");
            return;
        }
        _hasKeyboard = keyboard;
        _hasMouse = mouse;
    }

    /// <summary>Reads everything that queued up since the last pass.</summary>
    private unsafe void Drain(IntPtr buffer, int bufferSize)
    {
        uint headerSize = (uint)sizeof(RAWINPUTHEADER);
        long now = Clock.NowHns();
        while (true)
        {
            uint size = (uint)bufferSize;
            uint count = GetRawInputBuffer(buffer, ref size, headerSize);
            if (count == 0 || count == uint.MaxValue) return;
            byte* p = (byte*)buffer;
            lock (_gate)
            {
                for (uint i = 0; i < count; i++)
                {
                    var header = (RAWINPUTHEADER*)p;
                    Handle(header, p + headerSize, now);
                    p += (header->dwSize + 7) & ~7u; // records are 8-byte aligned
                }
            }
        }
    }

    /// <summary>A single WM_INPUT that was still in the queue after the batch read.</summary>
    private unsafe void One(IntPtr handle)
    {
        uint headerSize = (uint)sizeof(RAWINPUTHEADER);
        uint size = 0;
        GetRawInputData(handle, RID_INPUT, IntPtr.Zero, ref size, headerSize);
        if (size == 0 || size > 1024) return;
        byte* data = stackalloc byte[(int)size];
        if (GetRawInputData(handle, RID_INPUT, (IntPtr)data, ref size, headerSize) != size) return;
        lock (_gate) Handle((RAWINPUTHEADER*)data, data + headerSize, Clock.NowHns());
    }

    private unsafe void Handle(RAWINPUTHEADER* header, byte* data, long now)
    {
        if (header->dwType == RIM_TYPEKEYBOARD)
        {
            var kb = (RAWKEYBOARD*)data;
            int vk = kb->VKey;
            if (!_keys.Contains(vk)) return;
            if ((kb->Flags & RI_KEY_BREAK) != 0) _down.Remove(vk);
            else _down.Add(vk);
            return;
        }
        if (header->dwType != RIM_TYPEMOUSE || !_wantMouse) return;

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
        if (dx == 0 && dy == 0) return;
        // A batch shares one timestamp, so fold it into the newest entry instead of flooding the history.
        int newest = (_moveHead - 1 + _moves.Length) % _moves.Length;
        if (_moveCount > 0 && _moves[newest].T == now)
        {
            _moves[newest] = (now, _moves[newest].X + dx, _moves[newest].Y + dy);
            return;
        }
        _moves[_moveHead] = (now, dx, dy);
        _moveHead = (_moveHead + 1) % _moves.Length;
        if (_moveCount < _moves.Length) _moveCount++;
    }

    public void Dispose()
    {
        _stop = true;
        if (_threadId != 0) PostThreadMessage(_threadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
        if (_thread.IsAlive) _thread.Join(1000);
    }

    private const uint WM_INPUT = 0x00FF, WM_QUIT = 0x0012, WM_APP_REGISTER = 0x8001, RID_INPUT = 0x10000003;
    private const uint RIDEV_INPUTSINK = 0x00000100, RIDEV_REMOVE = 0x00000001;
    private const uint RIM_TYPEMOUSE = 0, RIM_TYPEKEYBOARD = 1;
    private const uint QS_POSTMESSAGE = 0x0008, QS_RAWINPUT = 0x0400, PM_REMOVE = 0x0001, MWMO_INPUTAVAILABLE = 0x0004;
    private const ushort RI_KEY_BREAK = 1, RI_MOUSE_WHEEL = 0x0400, MOUSE_MOVE_ABSOLUTE = 1;

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
    [DllImport("user32.dll")] private static extern uint GetRawInputBuffer(IntPtr data, ref uint size, uint headerSize);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern ushort RegisterClassEx(ref WNDCLASSEX wc);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateWindowEx(uint exStyle, string cls, string name, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr param);
    [DllImport("user32.dll")] private static extern bool DestroyWindow(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out MSG msg, IntPtr hwnd, uint min, uint max, uint remove);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern uint MsgWaitForMultipleObjectsEx(uint count, IntPtr handles, uint ms, uint wakeMask, uint flags);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread, uint msg, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("kernel32.dll", CharSet = CharSet.Ansi)] private static extern IntPtr GetProcAddress(IntPtr module, string name);
}

/// <summary>Shares the single <see cref="InputListener"/> between everything that wants live input.</summary>
public static class InputHub
{
    private static readonly object Gate = new();
    private static readonly Dictionary<object, (HashSet<int> Keys, bool Mouse)> Claims = new();
    private static InputListener? _listener;

    public static InputListener Claim(object owner, IEnumerable<int> keys, bool mouse)
    {
        lock (Gate)
        {
            Claims[owner] = (keys.ToHashSet(), mouse);
            _listener ??= new InputListener();
            Apply();
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
                Apply();
            }
        }
    }

    private static void Apply() =>
        _listener?.SetKeys(Claims.Values.SelectMany(c => c.Keys), Claims.Values.Any(c => c.Mouse));
}
