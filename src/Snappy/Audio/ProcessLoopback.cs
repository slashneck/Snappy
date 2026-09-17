using System.Runtime.InteropServices;
using Snappy.Platform;

namespace Snappy.Audio;

/// <summary>A program that is putting sound out, and the name its track would carry.</summary>
public readonly record struct AudioProgram(int ProcessId, string Name);

/// <summary>
/// Windows can hand out the sound of one single program instead of the whole desktop ("process loopback").
/// This is the plumbing for it: finding out who is making noise right now, and opening an audio client that
/// only hears that one program. Needs Windows 11, or Windows 10 build 20348.
/// </summary>
internal static class ProcessLoopback
{
    private const string VirtualDevice = "VAD\\Process_Loopback";
    private const int VT_BLOB = 65;
    private const float SilenceFloor = 0.0008f; // under this a session is open but not really playing

    public const uint AUDCLNT_STREAMFLAGS_EVENTCALLBACK = 0x00040000;

    private static readonly Guid IID_IAudioSessionManager2 = new("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");
    private static readonly HashSet<string> Ignored = new(StringComparer.OrdinalIgnoreCase)
    {
        "Snappy", "audiodg", "svchost", "dwm", "csrss", "SystemSettings", "ShellExperienceHost", "TextInputHost",
    };

    public static bool Supported { get; } = Environment.OSVersion.Version.Build >= 20348;

    /// <summary>Opens an audio client that hears one program and everything it started.</summary>
    public static IAudioClient Open(int processId)
    {
        int size = Marshal.SizeOf<ActivationParams>();
        IntPtr blob = Marshal.AllocHGlobal(size);
        IntPtr variant = Marshal.AllocHGlobal(Marshal.SizeOf<PropVariant>());
        try
        {
            Marshal.StructureToPtr(new ActivationParams { Type = 1, ProcessId = (uint)processId, Mode = 0 }, blob, false);
            Marshal.StructureToPtr(new PropVariant { vt = VT_BLOB, pointer = size, pointer2 = blob }, variant, false);

            var handler = new Completion();
            var iid = Wasapi.IID_IAudioClient;
            ActivateAudioInterfaceAsync(VirtualDevice, ref iid, variant, handler, out var operation);
            if (!handler.Wait(4000)) throw new TimeoutException("Windows did not answer the audio request");
            operation.GetActivateResult(out int hr, out object client);
            Marshal.ReleaseComObject(operation);
            Marshal.ThrowExceptionForHR(hr);
            return (IAudioClient)client;
        }
        finally
        {
            Marshal.FreeHGlobal(variant);
            Marshal.FreeHGlobal(blob);
        }
    }

    /// <summary>
    /// The programs whose meter is above silence at this moment. Helper processes are folded into the program that
    /// started them, so a browser with ten tabs is one entry and not ten.
    /// </summary>
    public static List<AudioProgram> Playing(string deviceId)
    {
        var found = new Dictionary<int, AudioProgram>();
        IMMDeviceEnumerator? en = null;
        IMMDevice? dev = null;
        IAudioSessionManager2? manager = null;
        IAudioSessionEnumerator? sessions = null;
        try
        {
            en = Wasapi.CreateEnumerator();
            if (deviceId.Length == 0) en.GetDefaultAudioEndpoint(EDataFlow.Render, ERole.Console, out dev);
            else en.GetDevice(deviceId, out dev);

            var iid = IID_IAudioSessionManager2;
            dev.Activate(ref iid, Wasapi.CLSCTX_ALL, IntPtr.Zero, out object managerObj);
            manager = (IAudioSessionManager2)managerObj;
            manager.GetSessionEnumerator(out sessions);
            sessions.GetCount(out int count);

            Dictionary<int, (int Parent, string Exe)>? tree = null;
            int self = Environment.ProcessId;
            for (int i = 0; i < count; i++)
            {
                object? session = null;
                try
                {
                    sessions.GetSession(i, out session);
                    var control = (IAudioSessionControl2)session;
                    control.GetState(out int state);
                    if (state != 1) continue;                      // 1 = running
                    if (control.IsSystemSoundsSession() == 0) continue; // S_OK means it is the Windows sounds session
                    control.GetProcessId(out uint pid);
                    if (pid == 0 || pid == self) continue;
                    if (((IAudioMeterInformation)session).GetPeakValue(out float peak) != 0 || peak < SilenceFloor) continue;

                    tree ??= ProcessTree(); // only worth building once somebody is actually playing
                    int root = Root(tree, (int)pid);
                    if (found.ContainsKey(root)) continue;
                    string name = NameOf(tree, root);
                    if (name.Length == 0) continue;
                    found[root] = new AudioProgram(root, name);
                }
                catch (COMException)
                {
                    // the program closed while we were looking at it
                }
                finally
                {
                    if (session != null) Marshal.ReleaseComObject(session);
                }
            }
        }
        finally
        {
            if (sessions != null) Marshal.ReleaseComObject(sessions);
            if (manager != null) Marshal.ReleaseComObject(manager);
            if (dev != null) Marshal.ReleaseComObject(dev);
            if (en != null) Marshal.ReleaseComObject(en);
        }
        return found.Values.ToList();
    }

    /// <summary>Names cost a look into the exe's version info, so each program is only read once.</summary>
    private static readonly Dictionary<string, string> Names = new(StringComparer.OrdinalIgnoreCase);

    private static string NameOf(Dictionary<int, (int Parent, string Exe)> tree, int pid)
    {
        if (!tree.TryGetValue(pid, out var entry)) return "";
        string bare = Path.GetFileNameWithoutExtension(entry.Exe);
        if (Ignored.Contains(bare)) return "";
        if (Names.TryGetValue(bare, out string? known)) return known;

        string? path = ForegroundApp.ProcessImagePath((uint)pid);
        string name = ForegroundApp.SanitizeFolderName(path != null ? ForegroundApp.NameForExe(path) : bare);
        if (Names.Count > 64) Names.Clear();
        Names[bare] = name;
        return name;
    }

    /// <summary>Walks up to the first process of the same program, e.g. from a browser tab to the browser itself.</summary>
    private static int Root(Dictionary<int, (int Parent, string Exe)> tree, int pid)
    {
        for (int hops = 0; hops < 8; hops++)
        {
            if (!tree.TryGetValue(pid, out var me)) break;
            if (!tree.TryGetValue(me.Parent, out var parent)) break;
            if (!string.Equals(parent.Exe, me.Exe, StringComparison.OrdinalIgnoreCase)) break;
            pid = me.Parent;
        }
        return pid;
    }

    private static Dictionary<int, (int Parent, string Exe)> ProcessTree()
    {
        var map = new Dictionary<int, (int, string)>();
        IntPtr snap = CreateToolhelp32Snapshot(0x2 /* processes */, 0);
        if (snap == IntPtr.Zero || snap == new IntPtr(-1)) return map;
        try
        {
            var entry = new ProcessEntry32 { dwSize = (uint)Marshal.SizeOf<ProcessEntry32>() };
            if (!Process32First(snap, ref entry)) return map;
            do
            {
                map[(int)entry.th32ProcessID] = ((int)entry.th32ParentProcessID, entry.szExeFile);
            } while (Process32Next(snap, ref entry));
        }
        finally
        {
            CloseHandle(snap);
        }
        return map;
    }

    [ComVisible(true)]
    private sealed class Completion : IActivateAudioInterfaceCompletionHandler
    {
        private readonly ManualResetEventSlim _done = new(false);
        public void ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation) => _done.Set();
        public bool Wait(int ms) => _done.Wait(ms);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ActivationParams
    {
        public uint Type;      // 1 = process loopback
        public uint ProcessId;
        public uint Mode;      // 0 = this program and the ones it started
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct ProcessEntry32
    {
        public uint dwSize;
        public uint cntUsage;
        public uint th32ProcessID;
        public IntPtr th32DefaultHeapID;
        public uint th32ModuleID;
        public uint cntThreads;
        public uint th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
    }

    [DllImport("Mmdevapi.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void ActivateAudioInterfaceAsync([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid iid,
        IntPtr activationParams, IActivateAudioInterfaceCompletionHandler handler,
        out IActivateAudioInterfaceAsyncOperation operation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "Process32FirstW")]
    private static extern bool Process32First(IntPtr snapshot, ref ProcessEntry32 entry);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "Process32NextW")]
    private static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry32 entry);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateEvent(IntPtr attributes, bool manualReset, bool initialState, string? name);

    [DllImport("kernel32.dll")]
    public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", EntryPoint = "CloseHandle")]
    public static extern bool CloseEvent(IntPtr handle);
}

[ComImport, Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IActivateAudioInterfaceCompletionHandler
{
    void ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation);
}

[ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IActivateAudioInterfaceAsyncOperation
{
    void GetActivateResult(out int result, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
}

[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionManager2
{
    void GetAudioSessionControl(IntPtr sessionId, uint flags, out IntPtr control);
    void GetSimpleAudioVolume(IntPtr sessionId, uint flags, out IntPtr volume);
    void GetSessionEnumerator(out IAudioSessionEnumerator sessions);
    void RegisterSessionNotification(IntPtr notification);
    void UnregisterSessionNotification(IntPtr notification);
    void RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string sessionId, IntPtr notification);
    void UnregisterDuckNotification(IntPtr notification);
}

[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionEnumerator
{
    void GetCount(out int count);
    void GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session);
}

[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionControl2
{
    // IAudioSessionControl
    void GetState(out int state);
    void GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
    void SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr eventContext);
    void GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
    void SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr eventContext);
    void GetGroupingParam(out Guid grouping);
    void SetGroupingParam(ref Guid grouping, IntPtr eventContext);
    void RegisterAudioSessionNotification(IntPtr notifications);
    void UnregisterAudioSessionNotification(IntPtr notifications);
    // IAudioSessionControl2
    void GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    void GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
    void GetProcessId(out uint processId);
    [PreserveSig] int IsSystemSoundsSession();
    void SetDuckingPreference(bool optOut);
}

[ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioMeterInformation
{
    [PreserveSig] int GetPeakValue(out float peak);
}
