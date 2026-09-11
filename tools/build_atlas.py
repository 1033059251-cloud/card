#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 78 张塔罗牌面打包成 5 张 atlas（精灵图），减少加载时的网络请求数。

用法：python3 tools/build_atlas.py
产物：assets/atlas_major.webp + atlas_{wands,cups,swords,pents}.webp
      （cell 尺寸固定 512x870，与前端 composeFront 拉伸结果一致）
依赖：PIL（pip install pillow）
"""
import io
import os
import sys
import urllib.request

from PIL import Image

BASE = "https://cdn.jsdelivr.net/gh/nishshoko/astra-cards@main/"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets")
CACHE = os.path.join(HERE, ".cache")

CELL_W, CELL_H = 512, 870
QUALITY = 84  # 与原始牌面体积/观感基本一致（约 130KB/张）

# 分组：key -> (卡片编号列表, 列数, 行数)
GROUPS = {
    "major": (list(range(0, 22)), 6, 4),      # major_00..major_21
    "wands": (list(range(1, 15)), 4, 4),      # wands_01..wands_14
    "cups":  (list(range(1, 15)), 4, 4),
    "swords": (list(range(1, 15)), 4, 4),
    "pents": (list(range(1, 15)), 4, 4),
}


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    cached = os.path.join(CACHE, name + ".webp")
    if os.path.exists(cached) and os.path.getsize(cached) > 0:
        with open(cached, "rb") as f:
            return f.read()
    url = BASE + name + ".webp"
    req = urllib.request.Request(url, headers={"User-Agent": "atlas-builder"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    with open(cached, "wb") as f:
        f.write(data)
    return data


def build_group(key):
    numbers, cols, rows = GROUPS[key]
    atlas = Image.new("RGB", (cols * CELL_W, rows * CELL_H), (0, 0, 0))
    for i, n in enumerate(numbers):
        name = f"{key}_{n:02d}"
        data = fetch(name)
        img = Image.open(io.BytesIO(data)).convert("RGB")
        # 与前端 drawImage(img, 0,0,512,870) 完全一致：整体拉伸到 cell
        img = img.resize((CELL_W, CELL_H), Image.LANCZOS)
        col, row = i % cols, i // cols
        atlas.paste(img, (col * CELL_W, row * CELL_H))
        sys.stdout.write(f"\r  {name}.webp -> col{col},row{row}")
        sys.stdout.flush()
    out = os.path.join(OUT, f"atlas_{key}.webp")
    atlas.save(out, "WEBP", quality=QUALITY, method=6)
    size = os.path.getsize(out)
    print(f"\r✅ atlas_{key}.webp  {cols}x{rows}={cols*rows} cells  {size/1024:.0f} KB")


def main():
    os.makedirs(OUT, exist_ok=True)
    for key in GROUPS:
        build_group(key)
    print("完成。atlas 已写入", OUT)


if __name__ == "__main__":
    main()
