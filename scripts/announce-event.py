#!/usr/bin/env python3
"""
scripts/announce-event.py

把新上架的活動 md 發成 Discord 公告（設計文件 §8.3 的「一次 POST，最便宜的高觸及通道」）。
由 .github/workflows/announce-event.yml 呼叫，也可本機乾跑：

  python3 scripts/announce-event.py src/content/events/2026-09-meetup.md --dry-run

原則：宣傳是 best-effort。解析不出來或發送失敗都只警告，絕不讓 CI 失敗、
不阻擋活動上架（活動頁靠 deploy.yml，與本腳本無關）。
"""

import json
import os
import sys
import urllib.error
import urllib.request

SITE = "https://ddd-tw.com"
BRAND = 0x24417E  # --brand-solid，與 src/styles/global.css 一致
# 「活動通知」身分組（Onboarding 讓成員自選）。提及它而不是 @everyone。
EVENT_ROLE_ID = os.environ.get("DISCORD_EVENT_ROLE_ID", "1543273228938514482")

TYPE_LABEL = {
    "meetup": "Meetup", "conference": "年會", "bookclub": "讀書會",
    "workshop": "Workshop", "tour": "DDD Tour",
}


def parse_frontmatter(path):
    """只解析本專案 events schema 用到的欄位：純量、行內陣列、註解、引號。

    刻意不引入 PyYAML——runner 上不一定有，而這裡的格式受 _template.md 約束，
    複雜度不值得一個依賴。解析不出 title/date 就回 None，由呼叫端跳過。
    """
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if not text.startswith("---"):
        return None, ""
    _, fm, *rest = text.split("---", 2)
    body = (rest[0] if rest else "").strip()
    data = {}
    for line in fm.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, _, val = line.partition(":")
        key, val = key.strip(), val.strip()
        if not val or val.startswith("#"):
            continue
        val = val.split(" #")[0].strip().strip('"').strip("'")
        if val.startswith("[") and val.endswith("]"):
            data[key] = [v.strip().strip('"').strip("'")
                         for v in val[1:-1].split(",") if v.strip()]
        else:
            data[key] = val
    return data, body


def build_embed(meta, body, slug):
    date = str(meta.get("date", ""))
    fields = [{"name": "日期", "value": date or "—", "inline": True},
              {"name": "類型", "value": TYPE_LABEL.get(meta.get("type", ""),
                                                       meta.get("type", "—")), "inline": True}]
    if meta.get("location"):
        fields.append({"name": "地點", "value": meta["location"], "inline": True})
    if meta.get("speakers"):
        fields.append({"name": "講者", "value": "、".join(meta["speakers"]), "inline": False})
    if meta.get("topics"):
        fields.append({"name": "主題", "value": " · ".join(meta["topics"]), "inline": False})
    if meta.get("registrationDeadline"):
        fields.append({"name": "報名截止", "value": str(meta["registrationDeadline"]),
                       "inline": True})

    # 連結優先序：外部售票頁 → 自營報名頁 → 活動列表
    if meta.get("link"):
        url = meta["link"]
    elif meta.get("registration") == "onsite":
        url = f"{SITE}/register/{slug}/"
    else:
        url = f"{SITE}/events/"

    embed = {
        "title": meta.get("title", slug),
        "url": url,
        "description": (body.split("\n\n")[0] if body else "")[:600],
        "color": BRAND,
        "fields": fields,
        "footer": {"text": "DDD Taiwan · ddd-tw.com"},
    }
    if date:
        embed["timestamp"] = f"{date}T00:00:00Z" if len(date) == 10 else None
        if embed["timestamp"] is None:
            del embed["timestamp"]
    return embed


def post(webhook, payload):
    req = urllib.request.Request(webhook, data=json.dumps(payload).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    # 少了 User-Agent 會被 Cloudflare 以 error code 1010 擋掉（urllib 預設 UA 在封鎖名單上）。
    req.add_header("User-Agent", "DDDTW-Announcer (+https://ddd-tw.com)")
    with urllib.request.urlopen(req) as r:
        return r.status


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    webhook = os.environ.get("DISCORD_WEBHOOK_URL", "")
    if not args:
        print("沒有要公告的活動檔，結束。")
        return
    if not webhook and not dry:
        print("⚠ 未設定 DISCORD_WEBHOOK_URL，略過公告（不視為失敗）。")
        return

    for path in args:
        slug = os.path.basename(path).removesuffix(".md")
        try:
            meta, body = parse_frontmatter(path)
        except OSError as e:
            print(f"⚠ 讀不到 {path}：{e}")
            continue
        if not meta or not meta.get("title"):
            print(f"⚠ {path} 解析不出 title，略過。")
            continue

        payload = {
            "content": f"<@&{EVENT_ROLE_ID}> 新活動上架",
            "embeds": [build_embed(meta, body, slug)],
            # 只允許提及「活動通知」這一個身分組，杜絕文案誤觸 @everyone。
            "allowed_mentions": {"parse": [], "roles": [EVENT_ROLE_ID]},
        }
        if dry:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            continue
        try:
            print(f"→ {slug}：HTTP {post(webhook, payload)}")
        except urllib.error.HTTPError as e:
            print(f"⚠ {slug} 發送失敗 HTTP {e.code}：{e.read().decode()[:200]}")
        except urllib.error.URLError as e:
            print(f"⚠ {slug} 連線失敗：{e.reason}")


if __name__ == "__main__":
    main()
