using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using Snappy.Core;

namespace Snappy.Video;

/// <summary>
/// Puts FFmpeg ahead of the game on the graphics card, the way OBS does for itself. When a game keeps the card fully
/// busy, the few small copies a recording needs would otherwise queue behind whole game frames, and the clip repeats
/// frames. The game hardly notices, the copies take a fraction of a millisecond.
/// </summary>
internal static class GpuPriority
{
    private const int High = 4, Realtime = 5;

    public static void Raise(Process proc) => Task.Run(async () =>
    {
        // With the card scheduling its own work (hardware accelerated GPU scheduling) realtime can make games hitch,
        // high is enough there.
        int priority = HardwareScheduling() ? High : Realtime;
        // Windows only accepts this once the process has opened the graphics card, a moment after it starts.
        for (int i = 0; i < 50; i++)
        {
            try
            {
                if (proc.HasExited) return;
                if (D3DKMTSetProcessSchedulingPriorityClass(proc.Handle, priority) == 0) return;
            }
            catch
            {
                return;
            }
            await Task.Delay(100);
        }
        Log.Info("Couldn't give FFmpeg priority on the graphics card, recording without it");
    });

    private static bool HardwareScheduling()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\GraphicsDrivers");
            return key?.GetValue("HwSchMode") is int mode && mode == 2;
        }
        catch
        {
            return false;
        }
    }

    [DllImport("gdi32.dll")]
    private static extern int D3DKMTSetProcessSchedulingPriorityClass(IntPtr process, int priority);
}
