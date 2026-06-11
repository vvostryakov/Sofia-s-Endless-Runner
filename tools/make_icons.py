#!/usr/bin/env python3
"""Generate the PWA icons (icons/icon-192.png, icons/icon-512.png).

Pure stdlib (zlib + struct) so it runs anywhere; draws the game's look:
dark night sky, a neon three-lane track converging to the horizon, and a
gold coin as the sun. Rerun after art changes: python3 tools/make_icons.py
"""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def make_icon(size):
    px = bytearray(size * size * 3)

    def put(x, y, c):
        if 0 <= x < size and 0 <= y < size:
            i = (y * size + x) * 3
            px[i:i + 3] = bytes(c)

    def fill_circle(cx, cy, r, c):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    put(x, y, c)

    horizon = int(size * 0.42)
    sky_top, sky_bot = (7, 13, 26), (19, 32, 56)
    ground_top, ground_bot = (12, 36, 22), (28, 58, 34)

    for y in range(size):
        if y < horizon:
            t = y / max(1, horizon - 1)
            c = tuple(int(a + (b - a) * t) for a, b in zip(sky_top, sky_bot))
        else:
            t = (y - horizon) / max(1, size - horizon - 1)
            c = tuple(int(a + (b - a) * t) for a, b in zip(ground_top, ground_bot))
        for x in range(size):
            put(x, y, c)

    # stars
    for k in range(40):
        sx = (k * 97 + 13) % size
        sy = ((k * 53 + 7) % horizon)
        put(sx, sy, (200, 220, 255))
        if k % 5 == 0:
            put(sx + 1, sy, (200, 220, 255))

    # converging neon track edges + lane lines
    cx = size / 2
    near_hw = size * 0.46
    far_hw = size * 0.05
    edge = (94, 208, 106)
    lane = (60, 140, 80)
    for y in range(horizon, size):
        t = (y - horizon) / max(1, size - horizon - 1)
        hw = far_hw + (near_hw - far_hw) * t
        thick = max(1, int(size * 0.012 * (0.4 + t)))
        for d in range(thick):
            put(int(cx - hw) + d, y, edge)
            put(int(cx + hw) - d, y, edge)
        for frac in (-1 / 3, 1 / 3):
            put(int(cx + hw * frac * 2), y, lane)

    # horizon glow line
    for x in range(size):
        put(x, horizon, (140, 255, 120))
        put(x, horizon + 1, (60, 120, 70))

    # gold coin sun
    r = size * 0.16
    ccx, ccy = size * 0.68, size * 0.20
    fill_circle(ccx, ccy, r, (255, 215, 0))
    fill_circle(ccx - r * 0.25, ccy - r * 0.28, r * 0.32, (255, 245, 157))

    # PNG encode
    raw = b''.join(b'\x00' + bytes(px[y * size * 3:(y + 1) * size * 3]) for y in range(size))

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main():
    out = ROOT / 'icons'
    out.mkdir(exist_ok=True)
    for size in (192, 512):
        path = out / f'icon-{size}.png'
        path.write_bytes(make_icon(size))
        print(f'wrote {path} ({path.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
