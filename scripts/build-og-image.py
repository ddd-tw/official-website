#!/usr/bin/env python3
"""產生社群分享縮圖：全站預設兩張＋每個頁面一張。

尺寸固定 1200×630（1.91:1）——Facebook / LinkedIn / X 的 large summary card 就是這個
比例，圖片比例不合就會被裁掉兩側（初版是 2472×840 的 logo 橫幅，貼到 FB 會變成放大
切半的字）。所有內容都留在安全邊界內置中，即使平台改用方形裁切也還看得懂。

產出：
    public/og-image.png        全站預設（zh，＝首頁）
    public/og-image-en.png     全站預設（en，＝英文首頁）
    public/og/*.png            各頁專屬（六個主要頁面 ×2 語言＋每篇文章）
    src/data/og-images.json    路徑 → 圖片的對照表，Base.astro 據此輸出 og:image

用法：
    python3 scripts/build-og-image.py

新增文章後要重跑（不跑也不會壞，只是那頁退回全站預設圖）。改標語或配色也重跑。
需要 Pillow 與 rsvg-convert（`brew install librsvg`）。品牌字型（Space Grotesk /
Noto Sans TC）會自動下載到 ~/.cache/ddd-tw-og-fonts/，不進版控。
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_CACHE = Path.home() / ".cache" / "ddd-tw-og-fonts"
FONTS = {
    "SpaceGrotesk[wght].ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf",
    "NotoSansTC[wght].ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf",
}
LATIN, CJK = "SpaceGrotesk[wght].ttf", "NotoSansTC[wght].ttf"

W, H = 1200, 630
SAFE_W = 1000  # 文字最大寬度，左右各留 100px
BG = (27, 34, 51)  # --ink #1b2233
CREAM = (246, 242, 233)  # #f6f2e9
MUTED = (154, 158, 170)
ACCENT = (224, 106, 79)  # 深色底的 --accent #e06a4f
FOOTER = "DDD TAIWAN · ddd-tw.com"

# 六個主要頁面的卡片文案。標題沿用各頁 h1（含 .hl 那一段做橘色底線），
# lines 的每一行是 (底線前, 底線, 底線後)。
CORE_PAGES: dict[str, dict] = {
    "/": {
        "out": "og-image.png",  # 首頁 = 全站預設圖
        "eyebrow": "DOMAIN-DRIVEN DESIGN · TAIWAN",
        "lines": [("從", "問題領域", "出發，"), ("催生真正有價值的解決方案。", "", "")],
    },
    "/en/": {
        "out": "og-image-en.png",
        "eyebrow": "DOMAIN-DRIVEN DESIGN · TAIWAN",
        "lines": [("Start from the ", "problem domain", ","), ("deliver solutions that truly matter.", "", "")],
    },
    "/events/": {
        "eyebrow": "EVENTS",
        "lines": [("參與", "活動", "")],
        "sub": "定期聚會、年度大會、讀書會 — 自 2018 年起累積 30+ 場，還在增加中。",
    },
    "/en/events/": {
        "eyebrow": "EVENTS",
        "lines": [("Meet the community ", "in person", "")],
        "sub": "Meetups, the annual conference, and a book club — 30+ gatherings since 2018.",
    },
    "/knowledge/": {
        "eyebrow": "KNOWLEDGE BASE",
        "lines": [("知識", "庫", "")],
        "sub": "書單、Papers、影片、開源專案 — 由社群共同整理，從入門到深水區。",
    },
    "/en/knowledge/": {
        "eyebrow": "KNOWLEDGE BASE",
        "lines": [("The community's ", "library", "")],
        "sub": "Books, papers, videos, and open-source projects — curated by the community.",
    },
    "/community/": {
        "eyebrow": "COMMUNITY",
        "lines": [("社群與", "人", "")],
        "sub": "2018 年成立的非營利志工社群 — 先加入 Discord，討論真正發生的地方。",
    },
    "/en/community/": {
        "eyebrow": "COMMUNITY",
        "lines": [("Find your ", "people", "")],
        "sub": "A non-profit, volunteer-run community since 2018 — start on Discord, where the conversation happens.",
    },
    "/governance/": {
        "eyebrow": "GOVERNANCE",
        "lines": [("治理與", "政策", "")],
        "sub": "DDD Taiwan 如何運作，以及我們對隱私與社群互動的準則。",
    },
    "/en/governance/": {
        "eyebrow": "GOVERNANCE",
        "lines": [("Governance & ", "policy", "")],
        "sub": "How DDD Taiwan is run, and our policies on privacy and community conduct.",
    },
    "/me/": {
        "eyebrow": "MY JOURNEY",
        "lines": [("我的", "參與旅程", "")],
        "sub": "用報名 email 查詢你的位階、徽章與成就卡。",
    },
    "/en/me/": {
        "eyebrow": "MY JOURNEY",
        "lines": [("My ", "journey", "")],
        "sub": "Look up your rank, badges, and achievement card by email.",
    },
}

CJK_RANGES = ((0x2E80, 0x9FFF), (0xF900, 0xFAFF), (0xFF00, 0xFFEF), (0x3000, 0x303F))
# 這些標點不能出現在行首（中文排版的避頭點）
NO_LINE_START = "。，、；：？！）」』】〉》・…～%"


def ensure_fonts() -> None:
    FONT_CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in FONTS.items():
        dest = FONT_CACHE / name
        if dest.exists() and dest.stat().st_size > 50_000:
            continue
        print(f"下載字型 {name} …")
        urllib.request.urlretrieve(url, dest)


def has_cjk(text: str) -> bool:
    return any(any(lo <= ord(ch) <= hi for lo, hi in CJK_RANGES) for ch in text)


def font(name: str, size: int, weight: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT_CACHE / name), size)
    f.set_variation_by_name(weight)
    return f


def text_font(text: str, size: int, weight: str) -> ImageFont.FreeTypeFont:
    """Space Grotesk 沒有中日韓字，含中文的文字一律走 Noto Sans TC。"""
    return font(CJK if has_cjk(text) else LATIN, size, weight)


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
    return Image.open(BytesIO(out)).convert("RGBA")


def tracked_width(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, tracking: float) -> float:
    if not text:
        return 0.0
    return sum(draw.textlength(ch, font=f) + tracking for ch in text) - tracking


def draw_tracked(
    draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, f: ImageFont.FreeTypeFont, fill, tracking: float
) -> None:
    """逐字加字距（PIL 沒有 letter-spacing）。"""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_w: float) -> list[str]:
    """中文逐字斷行（避頭點）、西文照空白斷詞；混排時走逐字。"""
    if not has_cjk(text):
        lines, cur = [], ""
        for word in text.split():
            cand = f"{cur} {word}".strip()
            if cur and draw.textlength(cand, font=f) > max_w:
                lines.append(cur)
                cur = word
            else:
                cur = cand
        return lines + [cur] if cur else lines

    # 中文逐字斷，但連續的英數（Event Storming、2026-07）當成一個不可拆的單位
    units = re.findall(r"[A-Za-z0-9][A-Za-z0-9.,'’\-–]*|\s+|.", text)
    lines, cur = [], ""
    for u in units:
        if u.isspace() and not cur:
            continue
        if cur and draw.textlength(cur + u, font=f) > max_w and u.strip() and u not in NO_LINE_START:
            lines.append(cur.rstrip())
            cur = u
        else:
            cur += u
    return lines + [cur.rstrip()] if cur.strip() else lines


def line_height(f: ImageFont.FreeTypeFont, cjk: bool) -> int:
    return round(f.size * (1.44 if cjk else 1.32))


# logo 下方到底部之間留給文字的空間
CONTENT_TOP, CONTENT_BOTTOM = 184, 590


def stack_of(n_title: int, title_lh: int, n_sub: int, sub_lh: int) -> list[tuple[str, int]]:
    """垂直排版的區塊清單（種類, 高度），順序即繪製順序。"""
    stack = [("eyebrow", 26), ("gap", 32), ("title", n_title * title_lh)]
    if n_sub:
        stack += [("gap", 26), ("sub", n_sub * sub_lh)]
    return stack + [("gap", 34), ("rule", 2), ("gap", 32), ("footer", 28)]


def fit_title(
    draw: ImageDraw.ImageDraw, text: str, n_sub: int, sub_lh: int
) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    """由大到小試字級，找第一個「行數 ≤ 4 且整疊排得進畫面」的；最小字級仍溢出就截斷。

    只看行數不夠——長標題會把橘線與頁尾推出畫布底部（初版的長篇文章就這樣被切掉）。
    """
    room = CONTENT_BOTTOM - CONTENT_TOP
    for size in range(56, 32, -4):
        f = text_font(text, size, "Bold")
        lines = wrap(draw, text, f, SAFE_W)
        lh = line_height(f, has_cjk(text))
        if len(lines) <= 4 and sum(h for _, h in stack_of(len(lines), lh, n_sub, sub_lh)) <= room:
            return f, lines, lh
    f = text_font(text, 36, "Bold")
    lh = line_height(f, has_cjk(text))
    lines = wrap(draw, text, f, SAFE_W)[:4]
    lines[-1] = lines[-1][: max(1, len(lines[-1]) - 1)] + "…"
    return f, lines, lh


def render_card(spec: dict) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # 背景：左右各放一組放大的品牌雙圓外框，切出畫面外；壓到很淡，只當底紋不搶字
    motif = render_mark(620, outline_only=True)
    motif.putalpha(motif.getchannel("A").point(lambda a: int(a * 0.07)))
    img.paste(motif, (-250, (H - 620) // 2), motif)
    img.paste(motif, (W - 370, (H - 620) // 2), motif)

    mark = render_mark(96)
    img.paste(mark, ((W - 96) // 2, 62), mark)

    eyebrow_f = text_font(spec["eyebrow"], 21, "Medium")
    eyebrow_tr = 21 * 0.24
    footer_f = font(LATIN, 24, "Medium")
    footer_tr = 24 * 0.16

    sub_f, sub_lines, sub_lh = None, [], 0
    if spec.get("sub"):
        sub_f = text_font(spec["sub"], 27, "Regular")
        sub_lines = wrap(draw, spec["sub"], sub_f, SAFE_W - 60)[:2]
        sub_lh = round(sub_f.size * 1.5)

    # 標題：手寫的一到兩行（可帶底線片段），或整段自動排版縮放（文章標題）
    if "lines" in spec:
        title_text = "".join("".join(seg) for seg in spec["lines"])
        title_f = text_font(title_text, 58 if has_cjk(title_text) else 56, "Bold")
        title_lines: list[list[str]] = [list(seg) for seg in spec["lines"]]
        title_lh = line_height(title_f, has_cjk(title_text))
    else:
        title_f, wrapped, title_lh = fit_title(draw, spec["title"], len(sub_lines), sub_lh)
        title_lines = [[ln, "", ""] for ln in wrapped]

    # 整疊內容在 logo 下方的區域垂直居中
    stack = stack_of(len(title_lines), title_lh, len(sub_lines), sub_lh)
    y = CONTENT_TOP + max(0, (CONTENT_BOTTOM - CONTENT_TOP - sum(h for _, h in stack)) // 2)

    for kind, h in stack:
        if kind == "gap":
            y += h
        elif kind == "eyebrow":
            wid = tracked_width(draw, spec["eyebrow"], eyebrow_f, eyebrow_tr)
            draw_tracked(draw, ((W - wid) / 2, y), spec["eyebrow"], eyebrow_f, MUTED, eyebrow_tr)
            y += h
        elif kind == "title":
            for pre, hl, post in title_lines:
                widths = [draw.textlength(s, font=title_f) for s in (pre, hl, post)]
                x = (W - sum(widths)) / 2
                for idx, (seg, seg_w) in enumerate(zip((pre, hl, post), widths)):
                    if not seg:
                        continue
                    draw.text((x, y), seg, font=title_f, fill=CREAM)
                    if idx == 1:  # 對應站上 .hl 的 inset 0 -4px 底線
                        base = y + title_f.getbbox("H")[3] + 12
                        draw.rectangle([x, base, x + seg_w, base + 5], fill=ACCENT)
                    x += seg_w
                y += title_lh
        elif kind == "sub":
            for ln in sub_lines:
                wid = draw.textlength(ln, font=sub_f)
                draw.text(((W - wid) / 2, y), ln, font=sub_f, fill=MUTED)
                y += sub_lh
        elif kind == "rule":
            draw.rectangle([(W - 84) / 2, y, (W + 84) / 2, y + 2], fill=ACCENT)
            y += h
        elif kind == "footer":
            wid = tracked_width(draw, FOOTER, footer_f, footer_tr)
            draw_tracked(draw, ((W - wid) / 2, y), FOOTER, footer_f, CREAM, footer_tr)
            y += h

    return img


def read_frontmatter(path: Path) -> dict[str, str]:
    """只讀得懂本專案文章用到的單行 key: value（沒有 PyYAML 依賴）。"""
    text = path.read_text()
    if not text.startswith("---"):
        return {}
    body = text.split("---", 2)[1]
    data: dict[str, str] = {}
    for line in body.splitlines():
        m = re.match(r"^([a-zA-Z]+):\s*(.*)$", line)
        if m:
            data[m.group(1)] = m.group(2).strip().strip("\"'")
    return data


def post_specs() -> dict[str, dict]:
    """每篇已發佈文章一張卡：標題自動排版，副標放作者與日期。"""
    specs: dict[str, dict] = {}
    for md in sorted((ROOT / "src" / "content" / "posts").glob("*.md")):
        fm = read_frontmatter(md)
        if fm.get("draft") == "true" or not fm.get("title"):
            continue
        is_en = fm.get("lang") == "en"
        path = f"/en/posts/{md.stem}/" if is_en else f"/posts/{md.stem}/"
        specs[path] = {
            "eyebrow": "ARTICLE" if is_en else "社群文章",
            "title": fm["title"],
            "sub": f"{fm.get('author', 'DDD Taiwan')} · {fm.get('pubDate', '')}".strip(" ·"),
        }
    return specs


def out_name(path: str) -> str:
    slug = path.strip("/").replace("/", "-") or "home"
    return f"og/{slug}.png"


def main() -> int:
    ensure_fonts()

    specs = {**CORE_PAGES, **post_specs()}
    (ROOT / "public" / "og").mkdir(exist_ok=True)

    manifest: dict[str, str] = {}
    for path, spec in specs.items():
        name = spec.get("out") or out_name(path)
        dest = ROOT / "public" / name
        render_card(spec).save(dest, optimize=True)
        manifest[path] = f"/{name}"
        print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024} KB  ← {path}")

    out = ROOT / "src" / "data" / "og-images.json"
    out.write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2) + "\n")
    print(f"\n{out.relative_to(ROOT)}  {len(manifest)} 筆")
    return 0


if __name__ == "__main__":
    sys.exit(main())
