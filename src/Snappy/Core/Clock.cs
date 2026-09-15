using System.Diagnostics;

namespace Snappy.Core;

/// <summary>
/// One master clock for the whole app: QueryPerformanceCounter expressed in 100ns units ("hns").
/// WASAPI capture timestamps and FFmpeg's ddagrab timestamps are both QPC-based, so audio and
/// video line up on this timeline without drift.
/// </summary>
public static class Clock
{
    public const long HnsPerSecond = 10_000_000;

    public static long NowHns()
    {
        long ticks = Stopwatch.GetTimestamp();
        if (Stopwatch.Frequency == HnsPerSecond) return ticks;
        return (long)((Int128)ticks * HnsPerSecond / Stopwatch.Frequency);
    }

    public static long SecondsToHns(double seconds) => (long)(seconds * HnsPerSecond);

    public static double HnsToSeconds(long hns) => hns / (double)HnsPerSecond;
}
