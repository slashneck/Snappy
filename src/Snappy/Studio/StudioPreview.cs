using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using Snappy.Core;
using Snappy.Input;
using Snappy.Video;

namespace Snappy.Studio;

/// <summary>
/// Feeds the Studio page while it is open: a picture of the recorded monitor about ten times a second, plus the
/// cameras and keys its layers use. All of it stops when you leave Studio.
/// </summary>
public sealed class StudioPreview : IDisposable
{
    private const int MaxWidth = 1280;
    private static readonly ImageCodecInfo JpegCodec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);

    private readonly Func<DisplayInfo?> _display;
    private readonly Thread _thread;
    private readonly object _gate = new();
    private volatile bool _stop;
    private volatile byte[]? _screen;
    private InputListener? _input;

    public StudioPreview(Func<DisplayInfo?> display)
    {
        _display = display;
        _thread = new Thread(Run) { IsBackground = true, Name = "studio-preview" };
        _thread.Start();
    }

    /// <summary>Latest monitor picture as JPEG.</summary>
    public byte[]? Screen => _screen;

    public void Update(StudioScene? scene)
    {
        var layers = scene?.Layers ?? new List<StudioLayer>();
        var inputs = layers.Where(l => l.Type == "inputs").ToList();
        lock (_gate)
        {
            if (inputs.Count > 0)
            {
                _input = InputHub.Claim(this, inputs.Where(l => l.ShowKeys).SelectMany(InputOverlayRenderer.KeysFor));
            }
            else if (_input != null)
            {
                InputHub.Release(this);
                _input = null;
            }
        }
        WebcamHub.SetClaims(this, layers.Where(l => l.Type == "webcam" && l.Visible).Select(l => l.Device));
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

    private void Run()
    {
        Bitmap? full = null, small = null;
        bool warned = false;
        try
        {
            while (!_stop)
            {
                long started = Clock.NowHns();
                try
                {
                    if (_display() is { } d)
                    {
                        if (full == null || full.Width != d.Width || full.Height != d.Height)
                        {
                            full?.Dispose();
                            full = new Bitmap(d.Width, d.Height, PixelFormat.Format24bppRgb);
                        }
                        using (var g = Graphics.FromImage(full))
                            g.CopyFromScreen(d.X, d.Y, 0, 0, new Size(d.Width, d.Height), CopyPixelOperation.SourceCopy);

                        int w = Math.Min(MaxWidth, d.Width), h = (int)Math.Round(d.Height * (double)w / d.Width);
                        if (small == null || small.Width != w || small.Height != h)
                        {
                            small?.Dispose();
                            small = new Bitmap(w, h, PixelFormat.Format24bppRgb);
                        }
                        using (var g = Graphics.FromImage(small))
                        {
                            g.InterpolationMode = InterpolationMode.Bilinear;
                            g.DrawImage(full, 0, 0, w, h);
                        }
                        _screen = Jpeg(small, 72);
                        warned = false;
                    }
                }
                catch (Exception ex)
                {
                    // Happens while a UAC prompt or the lock screen is up. Try again shortly.
                    if (!warned) Log.Warn($"Studio preview capture failed: {ex.Message}");
                    warned = true;
                }
                int spentMs = (int)((Clock.NowHns() - started) / 10_000);
                Thread.Sleep(Math.Max(15, 100 - spentMs));
            }
        }
        finally
        {
            full?.Dispose();
            small?.Dispose();
        }
    }

    public void Dispose()
    {
        _stop = true;
        if (_thread.IsAlive) _thread.Join(2000);
        lock (_gate)
        {
            if (_input != null) InputHub.Release(this);
            _input = null;
        }
        WebcamHub.Release(this);
    }
}
