#!/usr/bin/env python3
"""產生社群分享縮圖：public/og-image.png（zh）與 public/og-image-en.png（en）。

尺寸固定 1200×630（1.91:1）——Facebook / LinkedIn / X 的 large summary card 就是這個
比例，圖片比例不合就會被裁掉兩側（舊版是 2472×840 的 logo 橫幅，貼到 FB 會變成放大
切半的字）。所有內容都留在安全邊界內，直接置中，即使平台改用方形裁切也還看得懂。

用法：
    python3 scripts/build-og-image.py

需要 Pillow 與 rsvg-convert（`brew install librsvg`）。品牌字型（Space Grotesk /
Noto Sans TC）會自動下載到 ~/.cache/ddd-tw-og-fonts/，不進版控。
"""

from __future__ import annotations

import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_CACHE = Path.home() / ".cache" / "ddd-tw-og-fonts"
FONTS = {
    "SpaceGrotesk[wght].ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf",
    "NotoSansTC[wght].ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf",
}

W, H = 1200, 630
BG = (27, 34, 51)  # --ink #1b2233
CREAM = (246, 242, 233)  # #f6f2e9
MUTED = (154, 158, 170)
ACCENT = (224, 106, 79)  # 深色底的 --accent #e06a4f

# 每個語系一張：eyebrow、標題（逐行，highlight 對應 .hl 的底線）、footer
PAGES = {
    "og-image.png": {
        "eyebrow": "DOMAIN-DRIVEN DESIGN · TAIWAN",
        "lines": [("從", "問題領域", "出發，"), ("催生真正有價值的解決方案。", "", "")],
        "cjk": True,
        "footer": "DDD TAIWAN · ddd-tw.com",
    },
    "og-image-en.png": {
        "eyebrow": "DOMAIN-DRIVEN DESIGN · TAIWAN",
        "lines": [("Start from the ", "problem domain", ","), ("deliver solutions that truly matter.", "", "")],
        "cjk": False,
        "footer": "DDD TAIWAN · ddd-tw.com",
    },
}


def ensure_fonts() -> None:
    FONT_CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in FONTS.items():
        dest = FONT_CACHE / name
        if dest.exists() and dest.stat().st_size > 50_000:
            continue
        print(f"下載字型 {name} …")
        urllib.request.urlretrieve(url, dest)


def font(name: str, size: int, weight: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_CACHE / name), size)
    f.set_variation_by_name(weight)
    return f


def render_mark(size: int, outline_only: bool = False) -> Image.Image:
    """把 public/logo.svg 換成米白配色後渲染成 PNG（logo 原色是深藍，貼在深底看不見）。

    outline_only 只留兩個圓的外框，用來當背景底紋——實心的透鏡與 D 淡化後會糊成一塊。
    """
    svg = (ROOT / "public" / "logo.svg").read_text()
    swap = {"#24417E": "#F6F2E9", "#F6F2E9": "#1B2233"}
    svg = re.sub("|".join(swap), lambda m: swap[m.group(0).upper()], svg, flags=re.I)
    if outline_only:
        svg = re.sub(r"<path[^>]*></path>", "", svg)
    out = subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size)],
        input=svg.encode(),
        capture_output=True,
        check=True,
    ).stdout
    from io import BytesIO

    return Image.open(BytesIO(out)).convert("RGBA")


def tracked_width(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, tracking: float) -> float:
    return sum(draw.textlength(ch, font=f) + tracking for ch in text) - (tracking if text else 0)


def draw_tracked(
    draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, f: ImageFont.FreeTypeFont, fill, tracking: float
) -> float:
    """逐字加字距（PIL 沒有 letter-spacing），回傳結束的 x。"""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking
    return x


def build(name: str, spec: dict) -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # 背景：左右各放一組放大的品牌雙圓外框，切出畫面外；壓到很淡，只當底紋不搶字
    motif = render_mark(620, outline_only=True)
    motif.putalpha(motif.getchannel("A").point(lambda a: int(a * 0.07)))
    img.paste(motif, (-250, (H - 620) // 2), motif)
    img.paste(motif, (W - 370, (H - 620) // 2), motif)

    mark = render_mark(104)
    img.paste(mark, ((W - 104) // 2, 70), mark)

    eyebrow_f = font("SpaceGrotesk[wght].ttf", 21, "Medium")
    tracking = 21 * 0.24
    ew = tracked_width(draw, spec["eyebrow"], eyebrow_f, tracking)
    draw_tracked(draw, ((W - ew) / 2, 202), spec["eyebrow"], eyebrow_f, MUTED, tracking)

    if spec["cjk"]:
        title_f = font("NotoSansTC[wght].ttf", 58, "Bold")
        line_h = 82
    else:
        title_f = font("SpaceGrotesk[wght].ttf", 56, "Bold")
        line_h = 76

    y = 268
    for pre, hl, post in spec["lines"]:
        widths = [draw.textlength(s, font=title_f) for s in (pre, hl, post)]
        x = (W - sum(widths)) / 2
        for idx, (seg, seg_w) in enumerate(zip((pre, hl, post), widths)):
            if not seg:
                continue
            draw.text((x, y), seg, font=title_f, fill=CREAM)
            if idx == 1:
                # 對應 .hl 的 inset 0 -4px 底線
                base = y + title_f.getbbox("H")[3] + 12
                draw.rectangle([x, base, x + seg_w, base + 5], fill=ACCENT)
            x += seg_w
        y += line_h

    draw.rectangle([(W - 84) / 2, 486, (W + 84) / 2, 488], fill=ACCENT)

    footer_f = font("SpaceGrotesk[wght].ttf", 24, "Medium")
    tracking = 24 * 0.16
    fw = tracked_width(draw, spec["footer"], footer_f, tracking)
    draw_tracked(draw, ((W - fw) / 2, 526), spec["footer"], footer_f, CREAM, tracking)

    dest = ROOT / "public" / name
    img.save(dest, optimize=True)
    print(f"{dest.relative_to(ROOT)}  {W}×{H}  {dest.stat().st_size // 1024} KB")


def main() -> int:
    ensure_fonts()
    for name, spec in PAGES.items():
        build(name, spec)
    return 0


if __name__ == "__main__":
    sys.exit(main())
