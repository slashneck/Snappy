namespace Snappy.Video;

/// <summary>
/// Minimal MPEG-TS parser for FFmpeg's single-video-stream output. Splits the byte stream into access units
/// (one encoded frame each, kept as raw 188-byte TS packets), with PTS, keyframe flag and arrival time.
/// </summary>
public sealed class TsDemuxer
{
    public const int PacketSize = 188;

    public delegate void AccessUnitHandler(ReadOnlySpan<byte> packets, long pts90k, bool keyframe, long arrivalHns);

    private readonly AccessUnitHandler _onAccessUnit;
    private readonly byte[] _carry = new byte[PacketSize];
    private int _carryLen;

    private byte[] _au = new byte[1 << 20];
    private int _auLen;
    private long _auPts = -1;
    private bool _auKey;
    private long _auArrival;

    private int _pmtPid = -1;
    private long _ptsEpoch;
    private long _lastRawPts = -1;

    public int VideoPid { get; private set; } = -1;
    public byte[]? PatPacket { get; private set; }
    public byte[]? PmtPacket { get; private set; }

    public TsDemuxer(AccessUnitHandler onAccessUnit) => _onAccessUnit = onAccessUnit;

    public void Feed(ReadOnlySpan<byte> data, long arrivalHns)
    {
        if (_carryLen > 0)
        {
            int need = PacketSize - _carryLen;
            if (data.Length < need)
            {
                data.CopyTo(_carry.AsSpan(_carryLen));
                _carryLen += data.Length;
                return;
            }
            data[..need].CopyTo(_carry.AsSpan(_carryLen));
            data = data[need..];
            _carryLen = 0;
            HandlePacket(_carry, arrivalHns);
        }

        while (data.Length >= PacketSize)
        {
            if (data[0] != 0x47)
            {
                // Lost sync (should never happen on a pipe), so scan for the next sync byte.
                int idx = data[1..].IndexOf((byte)0x47);
                if (idx < 0) return;
                data = data[(idx + 1)..];
                continue;
            }
            HandlePacket(data[..PacketSize], arrivalHns);
            data = data[PacketSize..];
        }

        data.CopyTo(_carry);
        _carryLen = data.Length;
    }

    private void HandlePacket(ReadOnlySpan<byte> p, long arrivalHns)
    {
        int pid = ((p[1] & 0x1F) << 8) | p[2];
        bool pusi = (p[1] & 0x40) != 0;
        int afc = (p[3] >> 4) & 3;
        int payloadOffset = 4;
        bool randomAccess = false;
        if ((afc & 2) != 0)
        {
            int afLen = p[4];
            if (afLen > 0) randomAccess = (p[5] & 0x40) != 0;
            payloadOffset = 5 + afLen;
        }
        bool hasPayload = (afc & 1) != 0 && payloadOffset < PacketSize;

        if (pid == 0 && pusi && hasPayload)
        {
            PatPacket = p.ToArray();
            ParsePat(p[payloadOffset..]);
            return;
        }
        if (pid == _pmtPid && pusi && hasPayload)
        {
            PmtPacket = p.ToArray();
            ParsePmt(p[payloadOffset..]);
            return;
        }
        if (pid != VideoPid || VideoPid < 0) return;

        if (pusi && hasPayload)
        {
            FlushAccessUnit();
            _auArrival = arrivalHns;
            _auKey = randomAccess;
            _auPts = ReadPesPts(p[payloadOffset..]);
        }
        else if (_auPts < 0)
        {
            return; // joined mid-frame
        }

        if (_auLen + PacketSize > _au.Length) Array.Resize(ref _au, _au.Length * 2);
        p.CopyTo(_au.AsSpan(_auLen));
        _auLen += PacketSize;
    }

    private void FlushAccessUnit()
    {
        if (_auLen > 0 && _auPts >= 0)
            _onAccessUnit(_au.AsSpan(0, _auLen), Unwrap(_auPts), _auKey, _auArrival);
        _auLen = 0;
        _auPts = -1;
    }

    private long Unwrap(long raw)
    {
        if (_lastRawPts >= 0 && raw < _lastRawPts - (1L << 32)) _ptsEpoch += 1L << 33;
        _lastRawPts = raw;
        return raw + _ptsEpoch;
    }

    private void ParsePat(ReadOnlySpan<byte> payload)
    {
        int ptr = payload[0];
        var s = payload[(1 + ptr)..];
        int sectionLen = ((s[1] & 0x0F) << 8) | s[2];
        int end = Math.Min(3 + sectionLen - 4, s.Length);
        for (int i = 8; i + 4 <= end; i += 4)
        {
            int program = (s[i] << 8) | s[i + 1];
            if (program != 0) { _pmtPid = ((s[i + 2] & 0x1F) << 8) | s[i + 3]; return; }
        }
    }

    private void ParsePmt(ReadOnlySpan<byte> payload)
    {
        int ptr = payload[0];
        var s = payload[(1 + ptr)..];
        int sectionLen = ((s[1] & 0x0F) << 8) | s[2];
        int end = Math.Min(3 + sectionLen - 4, s.Length);
        int progInfoLen = ((s[10] & 0x0F) << 8) | s[11];
        int i = 12 + progInfoLen;
        if (i + 5 <= end)
            VideoPid = ((s[i + 1] & 0x1F) << 8) | s[i + 2];
    }

    internal static long ReadPesPts(ReadOnlySpan<byte> pes)
    {
        if (pes.Length < 14 || pes[0] != 0 || pes[1] != 0 || pes[2] != 1) return -1;
        if ((pes[7] & 0x80) == 0) return -1;
        return ReadTs33(pes[9..]);
    }

    internal static long ReadTs33(ReadOnlySpan<byte> b) =>
        ((long)(b[0] >> 1) & 7) << 30 | (long)b[1] << 22 | (long)(b[2] >> 1) << 15 | (long)b[3] << 7 | (long)(b[4] >> 1);

    internal static void WriteTs33(Span<byte> b, long ts, int prefix)
    {
        ts &= (1L << 33) - 1;
        b[0] = (byte)((prefix << 4) | (int)((ts >> 29) & 0x0E) | 1);
        b[1] = (byte)(ts >> 22);
        b[2] = (byte)(((ts >> 14) & 0xFE) | 1);
        b[3] = (byte)(ts >> 7);
        b[4] = (byte)(((ts << 1) & 0xFE) | 1);
    }

    /// <summary>
    /// Shifts PTS/DTS/PCR of one access unit's packets by <paramref name="delta90k"/> and renumbers continuity
    /// counters, so frames from different capture sessions form one clean timeline in the saved clip.
    /// </summary>
    public static void RetimeAccessUnit(Span<byte> packets, long delta90k, ref int continuity)
    {
        for (int off = 0; off + PacketSize <= packets.Length; off += PacketSize)
        {
            var p = packets.Slice(off, PacketSize);
            bool pusi = (p[1] & 0x40) != 0;
            int afc = (p[3] >> 4) & 3;
            int payloadOffset = 4;

            if ((afc & 2) != 0)
            {
                int afLen = p[4];
                if (afLen >= 7 && (p[5] & 0x10) != 0)
                {
                    var pcr = p.Slice(6, 6);
                    long baseTs = (long)pcr[0] << 25 | (long)pcr[1] << 17 | (long)pcr[2] << 9 | (long)pcr[3] << 1 | (long)(pcr[4] >> 7);
                    int ext = ((pcr[4] & 1) << 8) | pcr[5];
                    baseTs = (baseTs + delta90k) & ((1L << 33) - 1);
                    pcr[0] = (byte)(baseTs >> 25);
                    pcr[1] = (byte)(baseTs >> 17);
                    pcr[2] = (byte)(baseTs >> 9);
                    pcr[3] = (byte)(baseTs >> 1);
                    pcr[4] = (byte)((int)((baseTs << 7) & 0x80) | 0x7E | (ext >> 8));
                    pcr[5] = (byte)ext;
                }
                payloadOffset = 5 + afLen;
            }

            if ((afc & 1) != 0)
            {
                p[3] = (byte)((p[3] & 0xF0) | (continuity & 0x0F));
                continuity++;
            }

            if (pusi && payloadOffset + 19 <= PacketSize)
            {
                var pes = p[payloadOffset..];
                if (pes[0] == 0 && pes[1] == 0 && pes[2] == 1)
                {
                    int ptsDts = pes[7] >> 6;
                    if ((ptsDts & 2) != 0) WriteTs33(pes[9..], ReadTs33(pes[9..]) + delta90k, ptsDts == 3 ? 3 : 2);
                    if (ptsDts == 3) WriteTs33(pes[14..], ReadTs33(pes[14..]) + delta90k, 1);
                }
            }
        }
    }
}
