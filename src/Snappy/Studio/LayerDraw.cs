using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace Snappy.Studio;

/// <summary>
/// Crop, fit, flip and rotation for Studio layers, in one place so pictures, GIFs and the facecam all follow the
/// same rules. The Studio page does the same maths for its preview.
/// </summary>
internal static class LayerDraw
{
    /// <summary>
    /// Draws a picture into a box of w by h: the crop comes off first, then it fills the box (or fits inside it
    /// keeping its shape), mirrored if the layer says so.
    /// </summary>
    public static void Picture(Graphics g, Image img, StudioLayer layer, int w, int h, ImageAttributes attributes)
    {
        float sx = (float)(img.Width * layer.CropL), sy = (float)(img.Height * layer.CropT);
        float sw = (float)(img.Width * (1 - layer.CropL - layer.CropR)), sh = (float)(img.Height * (1 - layer.CropT - layer.CropB));
        var target = new Rectangle(0, 0, w, h);
        if (layer.Fit == "fit")
        {
            double s = Math.Min(w / sw, h / sh);
            int tw = Math.Max(1, (int)Math.Round(sw * s)), th = Math.Max(1, (int)Math.Round(sh * s));
            target = new Rectangle((w - tw) / 2, (h - th) / 2, tw, th);
        }
        var saved = g.Save();
        Flip(g, w, h, layer.FlipX, layer.FlipY);
        g.DrawImage(img, target, sx, sy, sw, sh, GraphicsUnit.Pixel, attributes);
        g.Restore(saved);
    }

    /// <summary>Mirrors everything drawn afterwards inside a w by h box.</summary>
    public static void Flip(Graphics g, int w, int h, bool flipX, bool flipY)
    {
        if (flipX)
        {
            g.TranslateTransform(w, 0);
            g.ScaleTransform(-1, 1);
        }
        if (flipY)
        {
            g.TranslateTransform(0, h);
            g.ScaleTransform(1, -1);
        }
    }

    /// <summary>Size of the smallest canvas that holds a w by h box turned by this many degrees.</summary>
    public static (int W, int H) RotatedSize(int w, int h, double degrees)
    {
        if (degrees == 0) return (w, h);
        double r = degrees * Math.PI / 180, c = Math.Abs(Math.Cos(r)), s = Math.Abs(Math.Sin(r));
        return (Math.Max(2, (int)Math.Ceiling(w * c + h * s)), Math.Max(2, (int)Math.Ceiling(w * s + h * c)));
    }

    /// <summary>A new bitmap holding <paramref name="box"/> turned around its middle.</summary>
    public static Bitmap Rotate(Bitmap box, double degrees)
    {
        var (cw, ch) = RotatedSize(box.Width, box.Height, degrees);
        var canvas = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(canvas);
        StudioPipeline.Prepare(g);
        g.TranslateTransform(cw / 2f, ch / 2f);
        g.RotateTransform((float)degrees);
        g.DrawImage(box, -box.Width / 2f, -box.Height / 2f, box.Width, box.Height);
        return canvas;
    }
}

/// <summary>Turns a live layer's frames. Only frames that changed are turned again.</summary>
internal sealed class RotatedSource : ILayerSource
{
    private readonly ILayerSource _inner;
    private readonly int _w, _h;
    private readonly byte[] _pixels;
    private readonly Bitmap _box, _canvas;
    private readonly Graphics _g;

    public RotatedSource(ILayerSource inner, int w, int h, double degrees)
    {
        _inner = inner;
        _w = w;
        _h = h;
        _pixels = new byte[w * h * 4];
        _box = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        var (cw, ch) = LayerDraw.RotatedSize(w, h, degrees);
        _canvas = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
        _g = Graphics.FromImage(_canvas);
        StudioPipeline.Prepare(_g);
        _g.TranslateTransform(cw / 2f, ch / 2f);
        _g.RotateTransform((float)degrees);
    }

    public bool Render(byte[] bgra, long nowHns)
    {
        if (!_inner.Render(_pixels, nowHns)) return false;
        var data = _box.LockBits(new Rectangle(0, 0, _w, _h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try { Marshal.Copy(_pixels, 0, data.Scan0, _pixels.Length); }
        finally { _box.UnlockBits(data); }
        _g.Clear(Color.Transparent);
        _g.DrawImage(_box, -_w / 2f, -_h / 2f, _w, _h);
        StudioPipeline.CopyPixels(_canvas, bgra);
        return true;
    }

    public void Dispose()
    {
        _inner.Dispose();
        _g.Dispose();
        _canvas.Dispose();
        _box.Dispose();
    }
}
