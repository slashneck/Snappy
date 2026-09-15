namespace Snappy.Core;

/// <summary>
/// Fixed-size circular byte arena holding variable-length records (encoded video frames or PCM chunks).
/// Memory is reserved once up front in 256 MB segments (so replays can be many GB long), untouched pages cost
/// nothing until written, and old records are simply overwritten. Nothing touches the disk until a clip is saved.
/// Single writer, any number of readers. Readers copy outside the lock and re-validate afterwards.
/// </summary>
public sealed class RingArena
{
    public readonly record struct Entry(long Pos, int Length, long TimeHns, long DurationHns, int Flags, int Session, long Aux);

    public const int FlagKeyframe = 1;
    private const int DefaultSegmentSize = 256 * 1024 * 1024;

    private readonly byte[][] _segments;
    private readonly int _segmentSize;
    private readonly long _capacity;
    private readonly object _gate = new();
    private readonly Queue<Entry> _entries = new();
    private long _writeTotal; // monotonically increasing logical write position

    public RingArena(long capacityBytes) : this(Math.Max(1 << 20, capacityBytes), DefaultSegmentSize) { }

    /// <summary>Tiny segments are only used by the self-test to exercise every boundary case.</summary>
    internal RingArena(long capacityBytes, int segmentSize)
    {
        _capacity = capacityBytes;
        _segmentSize = segmentSize;
        int count = (int)((_capacity + segmentSize - 1) / segmentSize);
        _segments = new byte[count][];
        for (int i = 0; i < count; i++)
            _segments[i] = GC.AllocateUninitializedArray<byte>((int)Math.Min(segmentSize, _capacity - (long)i * segmentSize));
    }

    public long CapacityBytes => _capacity;

    public long UsedBytes
    {
        get { lock (_gate) return _entries.Count == 0 ? 0 : _writeTotal - _entries.Peek().Pos; }
    }

    public int Count
    {
        get { lock (_gate) return _entries.Count; }
    }

    /// <summary>Time covered from the oldest to the newest record, without copying the index.</summary>
    public long SpanHns()
    {
        lock (_gate)
        {
            if (_entries.Count < 2) return 0;
            long first = _entries.Peek().TimeHns, last = first;
            foreach (var e in _entries) last = e.TimeHns; // Queue has no Last(); this is O(n) but allocation-free
            return last - first;
        }
    }

    public int? OldestSession
    {
        get { lock (_gate) return _entries.Count == 0 ? null : _entries.Peek().Session; }
    }

    public void Append(ReadOnlySpan<byte> data, long timeHns, long durationHns, int flags, int session, long aux = 0)
    {
        if (data.Length == 0 || data.Length > _capacity / 4) return; // absurd record; never let one frame wipe the buffer

        lock (_gate)
        {
            // Evict records whose bytes are about to be overwritten.
            while (_entries.Count > 0 && _writeTotal + data.Length - _entries.Peek().Pos > _capacity)
                _entries.Dequeue();

            CopyIn(_writeTotal, data);
            _entries.Enqueue(new Entry(_writeTotal, data.Length, timeHns, durationHns, flags, session, aux));
            _writeTotal += data.Length;
        }
    }

    /// <summary>Drops records that started before <paramref name="cutoffHns"/>.</summary>
    public void EvictOlderThan(long cutoffHns)
    {
        lock (_gate)
        {
            while (_entries.Count > 0 && _entries.Peek().TimeHns < cutoffHns)
                _entries.Dequeue();
        }
    }

    public void Clear()
    {
        lock (_gate) _entries.Clear();
    }

    /// <summary>Returns metadata for every record that starts at or after <paramref name="fromHns"/>.</summary>
    public Entry[] Snapshot(long fromHns = long.MinValue)
    {
        lock (_gate)
            return _entries.Where(e => e.TimeHns >= fromHns).ToArray();
    }

    /// <summary>Copies a record's bytes. Returns false if it was overwritten while copying.</summary>
    public bool TryRead(in Entry entry, Span<byte> destination)
    {
        if (destination.Length < entry.Length || !IsValid(entry)) return false;
        CopyOut(entry.Pos, destination[..entry.Length]);
        return IsValid(entry); // re-check: the writer may have lapped us mid-copy
    }

    private bool IsValid(in Entry entry) => Interlocked.Read(ref _writeTotal) - entry.Pos <= _capacity;

    private void CopyIn(long pos, ReadOnlySpan<byte> data)
    {
        while (data.Length > 0)
        {
            long p = pos % _capacity;
            var segment = _segments[p / _segmentSize];
            int offset = (int)(p % _segmentSize);
            int n = Math.Min(data.Length, segment.Length - offset);
            data[..n].CopyTo(segment.AsSpan(offset));
            data = data[n..];
            pos += n;
        }
    }

    private void CopyOut(long pos, Span<byte> destination)
    {
        while (destination.Length > 0)
        {
            long p = pos % _capacity;
            var segment = _segments[p / _segmentSize];
            int offset = (int)(p % _segmentSize);
            int n = Math.Min(destination.Length, segment.Length - offset);
            segment.AsSpan(offset, n).CopyTo(destination);
            destination = destination[n..];
            pos += n;
        }
    }
}
