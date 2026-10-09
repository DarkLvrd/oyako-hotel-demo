#!/usr/bin/env python3
"""Stitch the viewport chunks written by capture-proof.mjs into one full-page JPEG.

Each chunk records the scroll offset it was taken at, so overlaps are resolved by
pasting in order: a later chunk simply overwrites the repeated strip.

usage: stitch-proof.py <chunks.json> <out.jpg> [--width 1200] [--quality 72]
"""
import json
import sys
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def arg(flag, default):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


manifest_path = sys.argv[1]
out_path = sys.argv[2]
target_w = int(arg('--width', '1200'))
quality = int(arg('--quality', '72'))

man = json.load(open(manifest_path))
chunks = man['chunks']
dpr = man.get('dpr', 1)
viewport_h = man['viewportH']
total = man['height']

# Work in device pixels, then scale the finished sheet once.
scale = dpr
sheet = Image.new('RGB', (man['width'] * dpr, total * dpr), 'white')

for c in chunks:
    im = Image.open(c['file']).convert('RGB')
    sheet.paste(im, (0, int(c['y'] * scale)))

# Trim anything that ended up beyond the last real pixel of the page.
sheet = sheet.crop((0, 0, sheet.width, min(sheet.height, total * dpr)))

if target_w and sheet.width > target_w:
    ratio = target_w / sheet.width
    sheet = sheet.resize((target_w, max(1, round(sheet.height * ratio))), Image.LANCZOS)

sheet.save(out_path, 'JPEG', quality=quality, optimize=True, progressive=True)
print(f'stitched {len(chunks)} chunks -> {out_path} {sheet.width}x{sheet.height}')
