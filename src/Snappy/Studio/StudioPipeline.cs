using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using Snappy.Core;
using Snappy.Input;

namespace Snappy.Studio;

/// <summary>
/// Turns the Studio scene into extra FFmpeg inputs and overlay filters for one capture run.
/// Still images are drawn once into a PNG at their final size. Live layers (GIF, facecam, key presses) are drawn here
/// and streamed to FFmpeg as raw frames over named pipes.
/// </summary>
public sealed class StudioPipeline : IDisposable
{
    private readonly List<LiveLayerFeed> _feeds = new();
    private readonly List<(int Input, int X, int Y, bool Live)> _overlays = new();

    public List<string> InputArgs { get; } = new();

    private static string CacheDir => Path.Combine(AppPaths.LocalDataDir, "studio-cache");

    public static StudioPipeline? TryCreate(StudioScene scene, int outW, int outH, int fps, int sessionId,
        Func<long> zeroTime, out string? error)
    {
        error = null;
        var pipeline = new StudioPipeline();
        try
        {
            pipeline.Build(scene, outW, outH, fps, sessionId, zeroTime);
            if (pipeline._overlays.Count > 0) return pipeline;
        }
        catch (Exception ex)
        {
            Log.Error("Studio layers could not be prepared", ex);
            error = ex.Message;
        }
        pipeline.Dispose();
        return null;
    }

    private void Build(StudioScene scene, int outW, int outH, int fps, int sessionId, Func<long> zeroTime)
    {
        Directory.CreateDirectory(CacheDir);
        foreach (string old in Directory.EnumerateFiles(CacheDir))
            try { File.Delete(old); } catch { }

        int input = 0;
        foreach (var layer in scene.ActiveLayers)
        {
            int x = (int)Math.Round(layer.X * outW), y = (int)Math.Round(layer.Y * outH);
            int w = (int)Math.Round(layer.W * outW), h = (int)Math.Round(layer.H * outH);
            if (w < 2 || h < 2) continue;

            if (layer.Type == "image")
            {
                string png = Path.Combine(CacheDir, $"{layer.Id}-{w}x{h}.png");
                RenderStill(Path.Combine(StudioSetup.MediaDir, layer.File), w, h, layer.Opacity, png);
                InputArgs.AddRange(new[] { "-i", Quote(png) });
            }
            else
            {
                ILayerSource? source = layer.Type switch
                {
                    "gif" => new GifSource(Path.Combine(StudioSetup.MediaDir, layer.File), w, h, layer.Opacity),
                    "webcam" => new WebcamSource(layer, w, h),
                    "inputs" => new InputsSource(layer, w, h),
                    _ => null,
                };
                if (source == null) continue;
                int rate = layer.Type == "inputs" ? Math.Min(fps, 60) : Math.Min(fps, 30);
                var feed = new LiveLayerFeed(source, $"snappy-{Environment.ProcessId}-{sessionId}-{input}", w, h, rate, zeroTime);
                _feeds.Add(feed);
                InputArgs.AddRange(new[]
                {
                    "-f", "rawvideo", "-pix_fmt", "bgra", "-video_size", $"{w}x{h}", "-framerate", rate.ToString(),
                    "-thread_queue_size", "8", "-i", Quote(feed.PipePath),
                });
            }
            _overlays.Add((input++, x, y, layer.Type != "image"));
        }
    }

    /// <summary>Filter graph text that stacks the layers onto <paramref name="input"/>, bottom layer first.</summary>
    public string Compose(string input, string output)
    {
        var sb = new StringBuilder();
        string current = input;
        for (int i = 0; i < _overlays.Count; i++)
        {
            var o = _overlays[i];
            string next = i == _overlays.Count - 1 ? output : $"layer{i}";
            // If a live layer stops (camera unplugged), it just disappears instead of freezing the recording.
            sb.Append($";[{current}][{o.Input}:v]overlay=x={o.X}:y={o.Y}:format=rgb:eof_action={(o.Live ? "pass" : "repeat")}[{next}]");
            current = next;
        }
        return sb.ToString();
    }

    private static void RenderStill(string source, int w, int h, double opacity, string destination)
    {
        using var img = Image.FromFile(source);
        using var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            Prepare(g);
            using var attributes = Attributes(opacity);
            g.DrawImage(img, new Rectangle(0, 0, w, h), 0, 0, img.Width, img.Height, GraphicsUnit.Pixel, attributes);
        }
        bmp.Save(destination, ImageFormat.Png);
    }

    internal static void Prepare(Graphics g)
    {
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.SmoothingMode = SmoothingMode.AntiAlias;
    }

    internal static ImageAttributes Attributes(double opacity)
    {
        var a = new ImageAttributes();
        a.SetWrapMode(WrapMode.TileFlipXY); // avoids a faint see-through seam along the edges when scaling
        if (opacity < 0.999) a.SetColorMatrix(new ColorMatrix { Matrix33 = (float)Math.Clamp(opacity, 0, 1) });
        return a;
    }

    internal static void CopyPixels(Bitmap bmp, byte[] destination)
    {
        var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try { Marshal.Copy(data.Scan0, destination, 0, bmp.Width * bmp.Height * 4); }
        finally { bmp.UnlockBits(data); }
    }

    private static string Quote(string path) => $"\"{path}\"";

    public void Dispose()
    {
        foreach (var feed in _feeds) feed.Dispose();
        _feeds.Clear();
    }
}

/// <summary>Draws one frame of a live layer: BGRA, top-down, straight alpha.</summary>
internal interface ILayerSource : IDisposable
{
    void Render(byte[] bgra, long nowHns);
}

/// <summary>
/// Streams a live layer to FFmpeg. Frame n is written when the capture clock reaches frame n, so what the layer shows
/// lines up with the screen frame it gets blended onto.
/// </summary>
internal sealed class LiveLayerFeed : IDisposable
{
    private readonly ILayerSource _source;
    private readonly NamedPipeServerStream _pipe;
    private readonly Func<long> _zeroTime;
    private readonly CancellationTokenSource _cts = new();
    private readonly Thread _thread;

    public string PipePath { get; }
    public int Width { get; }
    public int Height { get; }
    public int Fps { get; }

    /// <param name="zeroTime">QPC time of the capture's first frame, or long.MaxValue while it isn't known yet.</param>
    public LiveLayerFeed(ILayerSource source, string pipeName, int width, int height, int fps, Func<long> zeroTime)
    {
        _source = source;
        _zeroTime = zeroTime;
        Width = width;
        Height = height;
        Fps = fps;
        PipePath = @"\\.\pipe\" + pipeName;
        _pipe = new NamedPipeServerStream(pipeName, PipeDirection.Out, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 0, width * height * 4);
        _thread = new Thread(Run) { IsBackground = true, Name = "studio-layer", Priority = ThreadPriority.AboveNormal };
        _thread.Start();
    }

    private void Run()
    {
        try
        {
            _pipe.WaitForConnectionAsync(_cts.Token).GetAwaiter().GetResult();
            var frame = new byte[Width * Height * 4];
            using var sleep = new PreciseSleep();
            for (long n = 0; !_cts.IsCancellationRequested; n++)
            {
                long zero = _zeroTime();
                if (zero != long.MaxValue) sleep.Until(zero + n * Clock.HnsPerSecond / Fps);
                _source.Render(frame, Clock.NowHns());
                _pipe.Write(frame, 0, frame.Length);
            }
        }
        catch (OperationCanceledException) { }
        catch (ObjectDisposedException) { }
        catch (IOException) { } // FFmpeg closed its end
        catch (Exception ex)
        {
            Log.Error("Studio layer stopped", ex);
        }
    }

    public void Dispose()
    {
        _cts.Cancel();
        try { _pipe.Dispose(); } catch { }
        if (_thread.IsAlive) _thread.Join(2000);
        _source.Dispose();
    }
}

internal sealed class InputsSource : ILayerSource
{
    private readonly InputOverlayRenderer _renderer;
    private readonly InputListener _listener;

    public InputsSource(StudioLayer layer, int w, int h)
    {
        _renderer = new InputOverlayRenderer(layer, w, h);
        _listener = InputHub.Claim(this, layer.ShowKeys ? InputOverlayRenderer.KeysFor(layer) : Enumerable.Empty<int>());
    }

    public void Render(byte[] bgra, long nowHns) => _renderer.Render(_listener.Live(), bgra);

    public void Dispose()
    {
        InputHub.Release(this);
        _renderer.Dispose();
    }
}

internal sealed class GifSource : ILayerSource
{
    private const long MemoryBudget = 256L << 20;

    private readonly List<byte[]> _frames = new();
    private readonly List<long> _ends = new(); // when each frame stops showing, in ms from the start of the loop
    private readonly long _startHns = Clock.NowHns();
    private readonly long _totalMs;

    public GifSource(string path, int w, int h, double opacity)
    {
        using var img = Image.FromFile(path);
        var dimension = new FrameDimension(img.FrameDimensionsList[0]);
        int count = Math.Max(1, img.GetFrameCount(dimension));
        int[] delays = FrameDelaysMs(img, count);
        // Long GIFs at a large size would eat a lot of RAM, so keep every n-th frame (each shown for longer).
        int step = (int)Math.Max(1, Math.Ceiling((double)count * w * h * 4 / MemoryBudget));

        using var canvas = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(canvas);
        StudioPipeline.Prepare(g);
        using var attributes = StudioPipeline.Attributes(opacity);
        long t = 0;
        for (int i = 0; i < count; i += step)
        {
            img.SelectActiveFrame(dimension, i);
            g.Clear(Color.Transparent);
            g.DrawImage(img, new Rectangle(0, 0, w, h), 0, 0, img.Width, img.Height, GraphicsUnit.Pixel, attributes);
            var pixels = new byte[w * h * 4];
            StudioPipeline.CopyPixels(canvas, pixels);
            _frames.Add(pixels);
            for (int k = i; k < Math.Min(count, i + step); k++) t += delays[k];
            _ends.Add(t);
        }
        _totalMs = Math.Max(1, t);
    }

    private static int[] FrameDelaysMs(Image img, int count)
    {
        var delays = Enumerable.Repeat(100, count).ToArray();
        try
        {
            byte[]? raw = img.GetPropertyItem(0x5100)?.Value; // PropertyTagFrameDelay, 1/100 s per frame
            if (raw != null)
                for (int i = 0; i < count && (i + 1) * 4 <= raw.Length; i++)
                {
                    int cs = BitConverter.ToInt32(raw, i * 4);
                    delays[i] = cs < 2 ? 100 : cs * 10; // browsers also treat 0 and 1 as 100 ms
                }
        }
        catch (ArgumentException) { } // single frame GIF without a delay tag
        return delays;
    }

    public void Render(byte[] bgra, long nowHns)
    {
        long ms = (nowHns - _startHns) / 10_000 % _totalMs;
        int i = 0;
        while (i < _ends.Count - 1 && _ends[i] <= ms) i++;
        Buffer.BlockCopy(_frames[i], 0, bgra, 0, bgra.Length);
    }

    public void Dispose() => _frames.Clear();
}

internal sealed class WebcamSource : ILayerSource
{
    private readonly StudioLayer _layer;
    private readonly int _w, _h;
    private readonly byte[] _alpha;
    private readonly byte[] _rendered;
    private readonly Bitmap _out;
    private readonly Graphics _g;
    private readonly ImageAttributes _attributes = StudioPipeline.Attributes(1);
    private Bitmap? _camera;
    private long _sequence = -1;

    public WebcamSource(StudioLayer layer, int w, int h)
    {
        _layer = layer;
        _w = w;
        _h = h;
        _alpha = ShapeAlpha(layer.Shape, w, h, layer.Opacity);
        _rendered = new byte[w * h * 4];
        _out = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        _g = Graphics.FromImage(_out);
        _g.InterpolationMode = InterpolationMode.HighQualityBilinear;
        _g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        WebcamHub.SetClaims(this, new[] { layer.Device });
    }

    public void Render(byte[] bgra, long nowHns)
    {
        var frame = WebcamHub.Get(_layer.Device)?.Latest;
        if (frame == null)
        {
            Array.Clear(bgra);
            _sequence = -1;
            return;
        }
        if (frame.Sequence != _sequence)
        {
            _sequence = frame.Sequence;
            if (_camera == null || _camera.Width != frame.Width || _camera.Height != frame.Height)
            {
                _camera?.Dispose();
                _camera = new Bitmap(frame.Width, frame.Height, PixelFormat.Format32bppRgb);
            }
            var data = _camera.LockBits(new Rectangle(0, 0, frame.Width, frame.Height), ImageLockMode.WriteOnly, PixelFormat.Format32bppRgb);
            try { Marshal.Copy(frame.Bgra, 0, data.Scan0, frame.Bgra.Length); }
            finally { _camera.UnlockBits(data); }

            // Fill the layer and crop what sticks out, like object-fit: cover.
            double scale = Math.Max((double)_w / frame.Width, (double)_h / frame.Height);
            float sw = (float)(_w / scale), sh = (float)(_h / scale);
            _g.ResetTransform();
            if (_layer.Mirror)
            {
                _g.TranslateTransform(_w, 0);
                _g.ScaleTransform(-1, 1);
            }
            _g.DrawImage(_camera, new Rectangle(0, 0, _w, _h), (frame.Width - sw) / 2, (frame.Height - sh) / 2, sw, sh, GraphicsUnit.Pixel, _attributes);
            StudioPipeline.CopyPixels(_out, _rendered);
            for (int i = 0, p = 3; i < _alpha.Length; i++, p += 4) _rendered[p] = _alpha[i];
        }
        Buffer.BlockCopy(_rendered, 0, bgra, 0, _rendered.Length);
    }

    /// <summary>Per pixel alpha for the layer shape (corner radius matches the Studio preview), times opacity.</summary>
    private static byte[] ShapeAlpha(string shape, int w, int h, double opacity)
    {
        using var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        using (var path = new GraphicsPath())
        using (var white = new SolidBrush(Color.White))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            if (shape == "circle")
            {
                path.AddEllipse(0, 0, w, h);
            }
            else if (shape == "rounded")
            {
                float d = Math.Min(w, h) * 0.24f;
                path.AddArc(0, 0, d, d, 180, 90);
                path.AddArc(w - d, 0, d, d, 270, 90);
                path.AddArc(w - d, h - d, d, d, 0, 90);
                path.AddArc(0, h - d, d, d, 90, 90);
                path.CloseFigure();
            }
            else
            {
                path.AddRectangle(new Rectangle(0, 0, w, h));
            }
            g.FillPath(white, path);
        }
        var pixels = new byte[w * h * 4];
        StudioPipeline.CopyPixels(bmp, pixels);
        var alpha = new byte[w * h];
        double k = Math.Clamp(opacity, 0, 1);
        for (int i = 0; i < alpha.Length; i++) alpha[i] = (byte)Math.Round(pixels[i * 4 + 3] * k);
        return alpha;
    }

    public void Dispose()
    {
        WebcamHub.Release(this);
        _g.Dispose();
        _out.Dispose();
        _camera?.Dispose();
        _attributes.Dispose();
    }
}
