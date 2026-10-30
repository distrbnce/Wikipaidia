"""Draw the extension's simple vector-like monogram without dependencies."""
from pathlib import Path
import struct
import zlib

OUT = Path(__file__).resolve().parents[1] / "extension" / "icons"
OUT.mkdir(exist_ok=True)


def segment_distance(x, y, ax, ay, bx, by):
    t = max(0, min(1, ((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)))
    return ((x-ax-t*(bx-ax))**2+(y-ay-t*(by-ay))**2)**0.5


def create(size):
    rows = []
    lines = [(25, 40, 39, 88), (39, 88, 54, 49), (54, 49, 70, 88), (70, 88, 85, 40)]
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            channels = [0, 0, 0, 0]
            for ox, oy in [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)]:
                x, y = (i+ox)*128/size, (j+oy)*128/size
                cx, cy = max(27, min(101, x)), max(27, min(101, y))
                color = (32, 52, 76, 255) if (x-cx)**2+(y-cy)**2 <= 23**2 else (0, 0, 0, 0)
                if color[3] and any(segment_distance(x, y, *line) < 3.6 for line in lines):
                    color = (250, 247, 238, 255)
                if (x-97)**2+(y-31)**2 < 8**2:
                    color = (205, 161, 78, 255)
                channels = [a+b for a, b in zip(channels, color)]
            row.extend(round(v/4) for v in channels)
        rows.append(row)
    def chunk(kind, data):
        return struct.pack(">I", len(data))+kind+data+struct.pack(">I", zlib.crc32(kind+data))
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(b"".join(rows)))+chunk(b"IEND", b"")
    (OUT / f"icon-{size}.png").write_bytes(data)


for dimension in (16, 32, 48, 128):
    create(dimension)
