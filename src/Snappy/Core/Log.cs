namespace Snappy.Core;

/// <summary>Tiny local log file (%AppData%\Snappy\snappy.log), rotated at 2 MB. Never leaves the PC.</summary>
public static class Log
{
    private static readonly object Gate = new();
    private const long MaxBytes = 2 * 1024 * 1024;

    public static string FilePath => Path.Combine(AppPaths.DataDir, "snappy.log");

    public static void Info(string message) => Write("INFO", message);
    public static void Warn(string message) => Write("WARN", message);
    public static void Error(string message, Exception? ex = null) =>
        Write("ERROR", ex == null ? message : $"{message}: {ex}");

    private static void Write(string level, string message)
    {
        string line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{level}] {message}{Environment.NewLine}";
        lock (Gate)
        {
            try
            {
                var info = new FileInfo(FilePath);
                if (info.Exists && info.Length > MaxBytes)
                {
                    File.Copy(FilePath, FilePath + ".old", overwrite: true);
                    File.Delete(FilePath);
                }
                File.AppendAllText(FilePath, line);
            }
            catch
            {
                // Logging must never take the recorder down.
            }
        }
        Console.Write(line);
    }
}

public static class AppPaths
{
#if DEBUG
    /// <summary>
    /// Development only: SNAPPY_DATA_DIR gives a test run its own settings, caches, clips folder and single-instance
    /// lock, so it can never touch (or collide with) a real Snappy running on the same PC.
    /// </summary>
    private static string? TestRoot => Environment.GetEnvironmentVariable("SNAPPY_DATA_DIR") is { Length: > 0 } d ? d : null;
#else
    private static string? TestRoot => null;
#endif

    public static bool IsIsolatedTestRun => TestRoot != null;

    /// <summary>Appended to mutex/event names so an isolated test instance doesn't talk to the real one.</summary>
    public static string InstanceSuffix => IsIsolatedTestRun ? "-isolated-test" : "";

    public static string DataDir
    {
        get
        {
            string dir = TestRoot is { } t ? Path.Combine(t, "Roaming")
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Snappy");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    /// <summary>Machine-local cache data (thumbnails, WebView2 profile), kept out of the roaming profile.</summary>
    public static string LocalDataDir
    {
        get
        {
            string dir = TestRoot is { } t ? Path.Combine(t, "Local")
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Snappy");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public static string WebRoot => Path.Combine(AppContext.BaseDirectory, "wwwroot");

    public static string FfmpegExe => Path.Combine(AppContext.BaseDirectory, "ffmpeg", "ffmpeg.exe");

    public static string DefaultClipsDir => TestRoot is { } t ? Path.Combine(t, "Clips")
        : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyVideos), "Snappy");

    public static string DefaultScreenshotsDir => TestRoot is { } t ? Path.Combine(t, "Screenshots")
        : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), "Snappy");
}
