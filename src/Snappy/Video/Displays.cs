using System.Runtime.InteropServices;

namespace Snappy.Video;

public sealed record DisplayInfo(int AdapterIndex, int OutputIndex, string DeviceName, string AdapterName,
    int X, int Y, int Width, int Height, bool IsPrimary, int VendorId)
{
    public string Label => $"{DeviceName.Replace(@"\\.\DISPLAY", "Display ")} · {Width}×{Height}{(IsPrimary ? " · primary" : "")}";
}

/// <summary>Enumerates monitors via DXGI so each one maps to the exact adapter/output index FFmpeg's ddagrab needs.</summary>
public static unsafe class Displays
{
    [DllImport("dxgi.dll")]
    private static extern int CreateDXGIFactory1(in Guid riid, out IntPtr factory);

    private static readonly Guid IID_IDXGIFactory1 = new("770aae78-f26f-4dba-a829-253c83d1b387");

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DXGI_OUTPUT_DESC
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
        public int Left, Top, Right, Bottom;
        public int AttachedToDesktop;
        public int Rotation;
        public IntPtr Monitor;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DXGI_ADAPTER_DESC
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string Description;
        public uint VendorId, DeviceId, SubSysId, Revision;
        public nuint DedicatedVideoMemory, DedicatedSystemMemory, SharedSystemMemory;
        public uint LuidLow;
        public int LuidHigh;
    }

    private static void** Vtbl(IntPtr obj) => *(void***)obj;
    private static void Release(IntPtr obj) { if (obj != IntPtr.Zero) Marshal.Release(obj); }

    public static List<DisplayInfo> Enumerate()
    {
        var result = new List<DisplayInfo>();
        if (CreateDXGIFactory1(IID_IDXGIFactory1, out IntPtr factory) < 0) return result;
        try
        {
            string primary = Screen.PrimaryScreen?.DeviceName ?? "";
            for (uint a = 0; ; a++)
            {
                IntPtr adapter;
                // IDXGIFactory1::EnumAdapters1 = vtable slot 12
                int hr = ((delegate* unmanaged[Stdcall]<IntPtr, uint, IntPtr*, int>)Vtbl(factory)[12])(factory, a, &adapter);
                if (hr < 0) break;
                try
                {
                    // IDXGIAdapter::GetDesc = slot 8
                    DXGI_ADAPTER_DESC adesc;
                    IntPtr adescPtr = Marshal.AllocHGlobal(Marshal.SizeOf<DXGI_ADAPTER_DESC>());
                    try
                    {
                        ((delegate* unmanaged[Stdcall]<IntPtr, IntPtr, int>)Vtbl(adapter)[8])(adapter, adescPtr);
                        adesc = Marshal.PtrToStructure<DXGI_ADAPTER_DESC>(adescPtr);
                    }
                    finally { Marshal.FreeHGlobal(adescPtr); }

                    for (uint o = 0; ; o++)
                    {
                        IntPtr output;
                        // IDXGIAdapter::EnumOutputs = slot 7
                        hr = ((delegate* unmanaged[Stdcall]<IntPtr, uint, IntPtr*, int>)Vtbl(adapter)[7])(adapter, o, &output);
                        if (hr < 0) break;
                        try
                        {
                            IntPtr odescPtr = Marshal.AllocHGlobal(Marshal.SizeOf<DXGI_OUTPUT_DESC>());
                            try
                            {
                                // IDXGIOutput::GetDesc = slot 7
                                ((delegate* unmanaged[Stdcall]<IntPtr, IntPtr, int>)Vtbl(output)[7])(output, odescPtr);
                                var d = Marshal.PtrToStructure<DXGI_OUTPUT_DESC>(odescPtr);
                                if (d.AttachedToDesktop != 0)
                                    result.Add(new DisplayInfo((int)a, (int)o, d.DeviceName, adesc.Description.Trim(),
                                        d.Left, d.Top, d.Right - d.Left, d.Bottom - d.Top,
                                        string.Equals(d.DeviceName, primary, StringComparison.OrdinalIgnoreCase), (int)adesc.VendorId));
                            }
                            finally { Marshal.FreeHGlobal(odescPtr); }
                        }
                        finally { Release(output); }
                    }
                }
                finally { Release(adapter); }
            }
        }
        finally { Release(factory); }
        return result;
    }

    /// <summary>The monitor handle Windows Graphics Capture needs for this display.</summary>
    public static IntPtr MonitorHandle(DisplayInfo display) =>
        MonitorFromPoint(new Point { X = display.X + display.Width / 2, Y = display.Y + display.Height / 2 }, 2 /* nearest */);

    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromPoint(Point point, uint flags);

    public static DisplayInfo? Resolve(string deviceName)
    {
        var all = Enumerate();
        return all.FirstOrDefault(d => string.Equals(d.DeviceName, deviceName, StringComparison.OrdinalIgnoreCase))
               ?? all.FirstOrDefault(d => d.IsPrimary)
               ?? all.FirstOrDefault();
    }
}
