"""Packs PNG renders into a Windows .ico (stdlib only).
Sizes <= 48 are stored as classic 32-bit DIBs (best compatibility with tray/WinForms); larger ones as PNG.
Usage: python build_ico.py out.ico a.png b.png ...
"""
import struct
import sys
import zlib


def read_png_rgba(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", path
    pos, idat, width = 8, b"", 0
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and color in (2, 6) and interlace == 0, (path, depth, color, interlace)
            channels = 4 if color == 6 else 3
        elif kind == b"IDAT":
            idat += body
        pos += 12 + length
    raw = zlib.decompress(idat)
    stride = width * channels
    rows, prev = [], bytearray(stride)
    for y in range(height):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            if f == 1:
                line[i] = (line[i] + a) & 255
            elif f == 2:
                line[i] = (line[i] + b) & 255
            elif f == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line) if channels == 4 else bytes(b for px in range(width) for b in (*line[px * 3:px * 3 + 3], 255)))
        prev = line
    return width, height, rows, data


def dib(width, height, rows):
    header = struct.pack("<IiiHHIIiiII", 40, width, height * 2, 1, 32, 0, 0, 0, 0, 0, 0)
    pixels = bytearray()
    for row in reversed(rows):  # bottom-up BGRA
        for x in range(width):
            r, g, b, a = row[x * 4:x * 4 + 4]
            pixels += bytes((b, g, r, a))
    mask_row = ((width + 31) // 32) * 4
    return header + bytes(pixels) + bytes(mask_row * height)


def main():
    out, pngs = sys.argv[1], sys.argv[2:]
    images = []
    for p in pngs:
        w, h, rows, raw = read_png_rgba(p)
        images.append((w, h, raw if w > 48 else dib(w, h, rows)))
    images.sort(key=lambda i: i[0])
    offset = 6 + 16 * len(images)
    directory, blobs = b"", b""
    for w, h, blob in images:
        directory += struct.pack("<BBBBHHII", w if w < 256 else 0, h if h < 256 else 0, 0, 0, 1, 32, len(blob), offset + len(blobs))
        blobs += blob
    open(out, "wb").write(struct.pack("<HHH", 0, 1, len(images)) + directory + blobs)
    print(f"{out}: {', '.join(str(i[0]) for i in images)}")


main()
