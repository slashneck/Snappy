using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text.Json;
using Snappy.Core;
using Snappy.Input;
using Snappy.Video;

namespace Snappy.Studio;

/// <summary>
/// What the Studio page needs while it is open: the snapshot of your screen that layers are arranged on, plus the
/// cameras and keys those layers use. Nothing is captured until you press the snap hotkey, and the snapshot is
/// thrown away a while after you leave Studio.
/// </summary>
public sealed class StudioPreview : IDisposable
{
    private const int MaxWidth = 1600;
    private static readonly ImageCodecInfo JpegCodec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
    private static readonly object ForgetGate = new();
    private static System.Threading.Timer? _forget;

    private readonly object _gate = new();
    private readonly Dictionary<string, InputOverlayRenderer> _overlays = new();
    private volatile byte[]? _snapshot;
    private StudioScene? _scene;
    private InputListener? _input;
    private bool _gamepad;

    private static string SnapshotPath => Path.Combine(AppPaths.LocalDataDir, "studio-snapshot.jpg");

    public StudioPreview()
    {
        CancelForget();
        try
        {
            if (File.Exists(SnapshotPath)) _snapshot = File.ReadAllBytes(SnapshotPath);
        }
        catch (Exception ex)
        {
            Log.Warn($"The last Studio snapshot couldn't be read: {ex.Message}");
        }
    }

    /// <summary>The snapshot as JPEG, or null while none has been taken.</summary>
    public byte[]? Snapshot => _snapshot;

    /// <summary>Grabs the recorded monitor once and replaces the previous snapshot.</summary>
    public bool TakeSnapshot(DisplayInfo? display)
    {
        if (display == null) return false;
        try
        {
            using var full = new Bitmap(display.Width, display.Height, PixelFormat.Format24bppRgb);
            using (var g = Graphics.FromImage(full))
                g.CopyFromScreen(display.X, display.Y, 0, 0, new Size(display.Width, display.Height), CopyPixelOperation.SourceCopy);

            int w = Math.Min(MaxWidth, display.Width), h = (int)Math.Round(display.Height * (double)w / display.Width);
            using var small = new Bitmap(w, h, PixelFormat.Format24bppRgb);
            using (var g = Graphics.FromImage(small))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBilinear;
                g.DrawImage(full, 0, 0, w, h);
            }

            byte[] jpeg = Jpeg(small, 82);
            _snapshot = jpeg;
            try { File.WriteAllBytes(SnapshotPath, jpeg); }
            catch (Exception ex) { Log.Warn($"The Studio snapshot couldn't be saved: {ex.Message}"); }
            Log.Info($"Studio snapshot taken ({w}x{h})");
            return true;
        }
        catch (Exception ex)
        {
            // A UAC prompt or the lock screen blocks the copy. Nothing breaks, the old snapshot stays.
            Log.Warn($"Studio snapshot failed: {ex.Message}");
            return false;
        }
    }

    /// <summary>Claims the cameras and keys the scene being edited needs, and lets go of the rest.</summary>
    public void Update(StudioScene? scene)
    {
        var layers = scene?.Layers ?? new List<StudioLayer>();
        var inputs = layers.Where(l => l.Type == "inputs").ToList();
        bool wantsGamepad = inputs.Any(InputOverlayRenderer.NeedsGamepad);
        lock (_gate)
        {
            _scene = scene;
            foreach (var renderer in _overlays.Values) renderer.Dispose();
            _overlays.Clear();

            if (inputs.Count > 0) _input = InputHub.Claim(this, inputs.SelectMany(InputOverlayRenderer.KeysFor));
            else if (_input != null)
            {
                InputHub.Release(this);
                _input = null;
            }

            if (wantsGamepad && !_gamepad) GamepadHub.Claim(this);
            else if (!wantsGamepad && _gamepad) GamepadHub.Release(this);
            _gamepad = wantsGamepad;
        }
        WebcamHub.SetClaims(this, layers.Where(l => l.Type == "webcam" && l.Visible).Select(l => l.Device));
    }

    /// <summary>
    /// One overlay frame as PNG, drawn by the same renderer the recording uses, so the preview can't drift from it.
    /// Opacity is left to the page, which fades the whole layer.
    /// </summary>
    public byte[]? OverlayPng(string layerId, int width, int height)
    {
        lock (_gate)
        {
            var layer = _scene?.Layers.FirstOrDefault(l => l.Id == layerId && l.Type == "inputs");
            if (layer == null) return null;
            width = Math.Clamp(width, 8, 1600);
            height = Math.Clamp(height, 8, 1600);
            string key = $"{layerId}|{width}x{height}|{layer.Input}|{layer.Design}|{layer.Accent}|{layer.ShowKeys}|{layer.ShowMouse}|" +
                         $"{string.Join(',', layer.Presets)}|{string.Join(',', layer.ExtraKeys)}";
            if (!_overlays.TryGetValue(key, out var renderer))
            {
                foreach (string stale in _overlays.Keys.Where(k => k.StartsWith(layerId + "|", StringComparison.Ordinal)).ToList())
                {
                    _overlays[stale].Dispose();
                    _overlays.Remove(stale);
                }
                var copy = JsonSerializer.Deserialize<StudioLayer>(JsonSerializer.Serialize(layer))!;
                copy.Opacity = 1;
                renderer = new InputOverlayRenderer(copy, width, height);
                _overlays[key] = renderer;
            }
            var state = _input?.Live() ?? new InputState { TimeMs = Environment.TickCount64 };
            return renderer.RenderPng(state, _gamepad ? GamepadHub.Current : null);
        }
    }

    public InputState? LiveInput()
    {
        lock (_gate) return _input?.Live();
    }

    public static byte[]? CameraJpeg(string device)
    {
        var frame = WebcamHub.Get(device)?.Latest;
        if (frame == null) return null;
        using var bmp = new Bitmap(frame.Width, frame.Height, PixelFormat.Format32bppRgb);
        var data = bmp.LockBits(new Rectangle(0, 0, frame.Width, frame.Height), ImageLockMode.WriteOnly, PixelFormat.Format32bppRgb);
        try { Marshal.Copy(frame.Bgra, 0, data.Scan0, frame.Bgra.Length); }
        finally { bmp.UnlockBits(data); }
        return Jpeg(bmp, 80);
    }

    private static byte[] Jpeg(Bitmap bmp, long quality)
    {
        using var ms = new MemoryStream();
        using var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
        bmp.Save(ms, JpegCodec, parameters);
        return ms.ToArray();
    }

    /// <summary>The snapshot is only there to arrange layers on, so it goes away a while after leaving Studio.</summary>
    public static void ForgetLater(TimeSpan delay)
    {
        lock (ForgetGate)
        {
            _forget?.Dispose();
            _forget = new System.Threading.Timer(_ => Forget(), null, delay, Timeout.InfiniteTimeSpan);
        }
    }

    public static void CancelForget()
    {
        lock (ForgetGate)
        {
            _forget?.Dispose();
            _forget = null;
        }
    }

    public static void Forget()
    {
        CancelForget();
        try
        {
            if (File.Exists(SnapshotPath)) File.Delete(SnapshotPath);
        }
        catch (Exception ex)
        {
            Log.Warn($"The Studio snapshot couldn't be deleted: {ex.Message}");
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_input != null) InputHub.Release(this);
            _input = null;
            if (_gamepad) GamepadHub.Release(this);
            _gamepad = false;
            foreach (var renderer in _overlays.Values) renderer.Dispose();
            _overlays.Clear();
        }
        WebcamHub.Release(this);
    }
}
