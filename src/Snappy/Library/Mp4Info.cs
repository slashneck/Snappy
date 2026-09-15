namespace Snappy.Library;

public readonly record struct Mp4Meta(double DurationSeconds, int Width, int Height);

/// <summary>
/// Reads duration and resolution straight from an MP4's moov box, without an FFmpeg process per clip,
/// so even a library with thousands of clips scans in a blink.
/// </summary>
public static class Mp4Info
{
    public static Mp4Meta? Read(string path)
    {
        try
        {
            using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 4096);
            var header = new byte[16];
            long pos = 0, len = fs.Length;
            while (pos + 8 <= len)
            {
                fs.Position = pos;
                if (fs.Read(header, 0, 8) < 8) return null;
                long size = BeU32(header, 0);
                string type = System.Text.Encoding.ASCII.GetString(header, 4, 4);
                int headerLen = 8;
                if (size == 1)
                {
                    if (fs.Read(header, 8, 8) < 8) return null;
                    size = (long)BeU64(header, 8);
                    headerLen = 16;
                }
                else if (size == 0)
                {
                    size = len - pos;
                }
                if (size < headerLen) return null;

                if (type == "moov")
                {
                    long bodyLen = size - headerLen;
                    if (bodyLen > 64 << 20) return null;
                    var body = new byte[bodyLen];
                    fs.ReadExactly(body);
                    return ParseMoov(body);
                }
                pos += size;
            }
        }
        catch
        {
            // Unreadable or still being written. The caller treats it as unknown.
        }
        return null;
    }

    private static Mp4Meta? ParseMoov(byte[] b)
    {
        double duration = 0;
        int width = 0, height = 0;
        foreach (var (type, start, end) in Children(b, 0, b.Length))
        {
            if (type == "mvhd" && end - start >= 32)
            {
                int v = b[start];
                long timescale = v == 1 ? BeU32(b, start + 20) : BeU32(b, start + 12);
                double dur = v == 1 ? BeU64(b, start + 24) : BeU32(b, start + 16);
                if (timescale > 0) duration = dur / timescale;
            }
            else if (type == "trak" && width == 0)
            {
                foreach (var (ct, cs, ce) in Children(b, start, end))
                {
                    if (ct != "tkhd") continue;
                    int v = b[cs];
                    int wOff = v == 1 ? 88 : 76;
                    if (ce - cs >= wOff + 8)
                    {
                        width = (int)(BeU32(b, cs + wOff) >> 16);
                        height = (int)(BeU32(b, cs + wOff + 4) >> 16);
                    }
                }
            }
        }
        return duration > 0 ? new Mp4Meta(duration, width, height) : null;
    }

    private static IEnumerable<(string Type, int Start, int End)> Children(byte[] b, int start, int end)
    {
        int pos = start;
        while (pos + 8 <= end)
        {
            long size = BeU32(b, pos);
            int headerLen = 8;
            if (size == 1 && pos + 16 <= end) { size = (long)BeU64(b, pos + 8); headerLen = 16; }
            if (size < headerLen || pos + size > end) yield break;
            yield return (System.Text.Encoding.ASCII.GetString(b, pos + 4, 4), pos + headerLen, (int)(pos + size));
            pos += (int)size;
        }
    }

    private static long BeU32(byte[] b, int o) => (long)((uint)b[o] << 24 | (uint)b[o + 1] << 16 | (uint)b[o + 2] << 8 | b[o + 3]);

    private static ulong BeU64(byte[] b, int o) => (ulong)BeU32(b, o) << 32 | (ulong)BeU32(b, o + 4);
}
