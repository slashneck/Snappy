using System.Runtime.InteropServices;
using Snappy.Core;

namespace Snappy.Input;

/// <summary>What a controller looks like at one moment. Sticks and triggers run from -1 to 1 and 0 to 1.</summary>
public sealed class GamepadState
{
    public bool Connected;
    public ushort Buttons;
    public float LeftX, LeftY, RightX, RightY;
    public float LeftTrigger, RightTrigger;

    public bool Has(GamepadButton button) => (Buttons & (ushort)button) != 0;
}

[Flags]
public enum GamepadButton : ushort
{
    Up = 0x0001, Down = 0x0002, Left = 0x0004, Right = 0x0008,
    Start = 0x0010, Back = 0x0020, LeftStick = 0x0040, RightStick = 0x0080,
    LeftBumper = 0x0100, RightBumper = 0x0200,
    A = 0x1000, B = 0x2000, X = 0x4000, Y = 0x8000,
}

/// <summary>
/// Reads the first connected controller through XInput, which covers Xbox pads and the many pads that pretend to be
/// one. A PlayStation pad works the same way through Windows, only the button names differ.
/// </summary>
public sealed class GamepadListener : IDisposable
{
    private const int MaxPlayers = 4;
    private static readonly long SearchEvery = Clock.SecondsToHns(2);

    private readonly Thread _thread;
    private volatile bool _stop;
    private volatile GamepadState _state = new();
    private int _player = -1;
    private long _lastSearch;

    public GamepadListener()
    {
        _thread = new Thread(Run) { IsBackground = true, Name = "gamepad" };
        _thread.Start();
    }

    public GamepadState State => _state;

    private void Run()
    {
        while (!_stop)
        {
            try
            {
                Poll();
            }
            catch (DllNotFoundException)
            {
                Log.Warn("XInput isn't available on this PC, controller overlays stay empty");
                return;
            }
            catch (Exception ex)
            {
                Log.Warn($"Reading the controller failed: {ex.Message}");
            }
            Thread.Sleep(16);
        }
    }

    private void Poll()
    {
        // Asking an empty slot costs time, so unplugged slots are only checked every couple of seconds.
        if (_player < 0)
        {
            if (Clock.NowHns() - _lastSearch < SearchEvery) return;
            _lastSearch = Clock.NowHns();
            for (int i = 0; i < MaxPlayers; i++)
            {
                if (XInputGetState(i, out _) != 0) continue;
                _player = i;
                Log.Info($"Controller found in slot {i + 1}");
                break;
            }
            if (_player < 0)
            {
                _state = new GamepadState();
                return;
            }
        }

        if (XInputGetState(_player, out XINPUT_STATE raw) != 0)
        {
            Log.Info("Controller disconnected");
            _player = -1;
            _state = new GamepadState();
            return;
        }

        var pad = raw.Gamepad;
        _state = new GamepadState
        {
            Connected = true,
            Buttons = pad.wButtons,
            LeftX = Stick(pad.sThumbLX, 7849),
            LeftY = Stick(pad.sThumbLY, 7849),
            RightX = Stick(pad.sThumbRX, 8689),
            RightY = Stick(pad.sThumbRY, 8689),
            LeftTrigger = pad.bLeftTrigger <= 30 ? 0 : (pad.bLeftTrigger - 30) / 225f,
            RightTrigger = pad.bRightTrigger <= 30 ? 0 : (pad.bRightTrigger - 30) / 225f,
        };
    }

    /// <summary>Removes the dead zone and scales the rest to a full swing, so a small push already shows.</summary>
    private static float Stick(short value, float deadZone)
    {
        float v = value;
        if (Math.Abs(v) <= deadZone) return 0;
        float sign = Math.Sign(v);
        return sign * Math.Min(1, (Math.Abs(v) - deadZone) / (32767 - deadZone));
    }

    public void Dispose()
    {
        _stop = true;
        if (_thread.IsAlive) _thread.Join(500);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct XINPUT_GAMEPAD
    {
        public ushort wButtons;
        public byte bLeftTrigger, bRightTrigger;
        public short sThumbLX, sThumbLY, sThumbRX, sThumbRY;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct XINPUT_STATE
    {
        public uint dwPacketNumber;
        public XINPUT_GAMEPAD Gamepad;
    }

    [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
    private static extern int XInputGetState(int player, out XINPUT_STATE state);
}

/// <summary>Shares one controller reader between the recording layers and the Studio preview.</summary>
public static class GamepadHub
{
    private static readonly object Gate = new();
    private static readonly HashSet<object> Owners = new();
    private static GamepadListener? _listener;

    public static GamepadListener Claim(object owner)
    {
        lock (Gate)
        {
            Owners.Add(owner);
            return _listener ??= new GamepadListener();
        }
    }

    public static void Release(object owner)
    {
        lock (Gate)
        {
            if (!Owners.Remove(owner) || Owners.Count > 0) return;
            _listener?.Dispose();
            _listener = null;
        }
    }

    public static GamepadState? Current
    {
        get
        {
            lock (Gate) return _listener?.State;
        }
    }
}
