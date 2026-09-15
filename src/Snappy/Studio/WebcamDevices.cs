using System.Diagnostics;
using System.Text.RegularExpressions;
using Snappy.Core;

namespace Snappy.Studio;

/// <summary>Cameras as FFmpeg's DirectShow input sees them (these names are what the capture pipeline opens).</summary>
public static partial class WebcamDevices
{
    public static async Task<List<string>> ListAsync()
    {
        var psi = new ProcessStartInfo(AppPaths.FfmpegExe)
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardInput = true,
        };
        foreach (string a in new[] { "-hide_banner", "-nostdin", "-list_devices", "true", "-f", "dshow", "-i", "dummy" })
            psi.ArgumentList.Add(a);
        try
        {
            using var proc = Process.Start(psi)!;
            proc.StandardInput.Close();
            string stderr = await proc.StandardError.ReadToEndAsync();
            await proc.WaitForExitAsync();
            return VideoDevice().Matches(stderr).Select(m => m.Groups[1].Value).Distinct().ToList();
        }
        catch (Exception ex)
        {
            Log.Warn($"Listing cameras failed: {ex.Message}");
            return new List<string>();
        }
    }

    [GeneratedRegex("\"([^\"]+)\"\\s*\\(video\\)")] private static partial Regex VideoDevice();
}
