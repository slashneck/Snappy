using System.Collections.Specialized;
using System.Diagnostics;
using Microsoft.VisualBasic.FileIO;

namespace Snappy.Platform;

/// <summary>Explorer-style file actions. Deleting always goes to the Recycle Bin, never permanent.</summary>
public static class ShellOps
{
    public static void SendToRecycleBin(string path)
    {
        if (Directory.Exists(path))
            FileSystem.DeleteDirectory(path, UIOption.OnlyErrorDialogs, RecycleOption.SendToRecycleBin);
        else if (File.Exists(path))
            FileSystem.DeleteFile(path, UIOption.OnlyErrorDialogs, RecycleOption.SendToRecycleBin);
    }

    public static void ShowInExplorer(string path)
    {
        if (File.Exists(path))
            Process.Start("explorer.exe", $"/select,\"{path}\"");
        else if (Directory.Exists(path))
            Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
    }

    /// <summary>Puts the file on the clipboard so it can be pasted straight into Discord, a chat, or Explorer. Must run on an STA thread.</summary>
    public static void CopyFileToClipboard(string path)
    {
        var files = new StringCollection { path };
        Clipboard.SetFileDropList(files);
    }
}
