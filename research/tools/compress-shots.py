#!/usr/bin/env python3
"""Compress the research reference screenshots.

Full-page captures of luxury hotel sites are 1440x5000-9000 (desktop) and
390x5000-14000 (phone) PNGs of 1-11 MB each.  We keep them readable but small:
scale to a modest width, slice very tall pages into vertical chunks, and store
progressive JPEGs.

usage: compress-shots.py <src-dir> <out-dir> <workwidth> <sliceh> <quality>
"""
import os
import sys
from PIL import Image

src, out, deskw, phonew, sliceh, quality = (
    sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]),
    int(sys.argv[5]), int(sys.argv[6]),
)
os.makedirs(out, exist_ok=True)

Image.MAX_IMAGE_PIXELS = None

rows = []
for name in sorted(os.listdir(src)):
    if not name.lower().endswith(".png"):
        continue
    stem = name[:-4]
    # phone captures were taken at DPR 2 (780 px wide); reference them at a
    # width close to the real 390 CSS px so the stored files stay small
    workw = phonew if stem.endswith("-phone") else deskw
    path = os.path.join(src, name)
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = min(1.0, workw / w)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    if scale < 1.0:
        im = im.resize((nw, nh), Image.LANCZOS)
    # slice tall pages so each stored image stays a readable, modest-size chunk
    n = max(1, (nh + sliceh - 1) // sliceh)
    parts = []
    for i in range(n):
        top = i * sliceh
        box = (0, top, nw, min(nh, top + sliceh))
        tile = im.crop(box)
        if n == 1:
            fname = stem + ".jpg"
        else:
            fname = f"{stem}--p{i + 1:02d}of{n:02d}.jpg"
        dst = os.path.join(out, fname)
        tile.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)
        parts.append((fname, os.path.getsize(dst), tile.size))
    rows.append((name, (w, h), (nw, nh), n, parts))
    im.close()

total = 0
for name, orig, scaled, n, parts in rows:
    print(f"{name}  {orig[0]}x{orig[1]} -> {scaled[0]}x{scaled[1]}  slices={n}")
    for fname, size, dim in parts:
        total += size
        print(f"    {fname:52s} {dim[0]}x{dim[1]:5d} {size/1024:8.1f} KB")
print(f"\nTOTAL {total/1024/1024:.1f} MB in {sum(r[3] for r in rows)} files")
