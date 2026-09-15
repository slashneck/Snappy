using System.Runtime.InteropServices;

namespace Snappy.Core;

/// <summary>Sleeps until a QPC time with about 1 ms accuracy (Thread.Sleep alone can be 15 ms late).</summary>
public sealed class PreciseSleep : IDisposable
{
    private readonly IntPtr _timer = CreateWaitableTimerExW(IntPtr.Zero, null, 0x2 /* HIGH_RESOLUTION */, 0x1F0003);

    public void Until(long qpcHns)
    {
        long wait = qpcHns - Clock.NowHns();
        if (wait <= 0) return;
        if (_timer != IntPtr.Zero)
        {
            long due = -wait;
            if (SetWaitableTimer(_timer, ref due, 0, IntPtr.Zero, IntPtr.Zero, false))
            {
                WaitForSingleObject(_timer, uint.MaxValue);
                return;
            }
        }
        Thread.Sleep((int)Math.Max(1, wait / 10_000));
    }

    public void Dispose()
    {
        if (_timer != IntPtr.Zero) CloseHandle(_timer);
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateWaitableTimerExW(IntPtr attributes, string? name, uint flags, uint access);
    [DllImport("kernel32.dll")] private static extern bool SetWaitableTimer(IntPtr timer, ref long dueTime, int period, IntPtr completion, IntPtr arg, bool resume);
    [DllImport("kernel32.dll")] private static extern uint WaitForSingleObject(IntPtr handle, uint ms);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}
