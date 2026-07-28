import struct
import zlib
import sys

def make_png(path, size, bg, fg):
    width = height = size
    raw = bytearray()
    cx = cy = size / 2
    r_outer = size * 0.38
    bar_w = size * 0.16
    for y in range(height):
        raw.append(0)
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            in_circle = dist <= r_outer
            in_bar_v = abs(dx) <= bar_w / 2 and abs(dy) <= r_outer * 0.75
            in_bar_h = abs(dy) <= bar_w / 2 and dx >= -r_outer * 0.75 and dx <= r_outer * 0.15 and dy <= 0
            mark = in_bar_v or in_bar_h
            if mark and in_circle:
                r, g, b = fg
            else:
                r, g, b = bg
            raw += bytes((r, g, b))

    def chunk(tag, data):
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        )

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)

bg = (20, 21, 26)
fg = (240, 200, 120)

make_png('public/icon-192.png', 192, bg, fg)
make_png('public/icon-512.png', 512, bg, fg)
print('done')
