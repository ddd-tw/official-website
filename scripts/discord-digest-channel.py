#!/usr/bin/env python3
"""
scripts/discord-digest-channel.py

DDD Taiwan — 每日社群選讀的發佈頻道，設定即程式碼。

建一個 **Forum 頻道** `📚每日選讀`（每篇文章 = 一個獨立 post + 討論串），
並帶四個主題 tag（DDD / AI / 架構 / 商業策略）對齊 community-digest 的 publish.py。

Forum 頻道天生適合這用途：webhook 帶 thread_name 會自動開新 post，社群成員
可直接在該 post 底下留言討論、可依 tag 篩選、可排序熱度。

用法：
  export DISCORD_BOT_TOKEN=...                          # bot token，勿進 git
  python3 scripts/discord-digest-channel.py plan        # 只讀：目標 vs 現況
  python3 scripts/discord-digest-channel.py apply       # 實際建立（冪等）

apply 完成後，webhook 由你在 Discord UI 建（頻道 → 編輯 → 整合 → Webhook →
New Webhook → 複製 URL），貼進 community-digest 的 GitHub Secret DISCORD_WEBHOOK_URL。
webhook URL 是機密，不經過本 script、不進聊天、不進版控。

前置：bot 需被邀入伺服器且具 MANAGE_CHANNELS（或臨時 Administrator，跑完踢掉，頻道保留）。
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

GUILD_ID = os.environ.get("DISCORD_GUILD_ID", "1540736464436985916")
TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
API = "https://discord.com/api/v10"

# ---- 目標設定（單一來源，改這裡就好）--------------------------------------
FORUM_CHANNEL_NAME = "📚每日選讀"
FORUM_TOPIC = (
    "每日自動策展的 DDD / AI / 軟體架構 / 商業策略選讀。"
    "每篇一個 post，歡迎在底下討論。由 community-digest 自動發佈。"
)
# tag 名稱必須對齊 community-digest/digest/publish.py 的 TAG_EMOJI
TAGS = [
    {"name": "DDD", "emoji": "🧩"},
    {"name": "AI", "emoji": "🤖"},
    {"name": "架構", "emoji": "🏛️"},
    {"name": "商業策略", "emoji": "📈"},
]

CHANNEL_TYPE_FORUM = 15


def request(method, path, body=None, soft=False):
    """呼叫 Discord API，遇 429 依 retry_after 重試。soft=True 時 HTTP 錯誤回傳
    {"__err": code, "__msg": ...} 而非中斷。"""
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    for _ in range(6):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bot {TOKEN}")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "DDDTW-DigestChannel (ddd-tw.com)")
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            payload = e.read().decode("utf-8", "replace")
            if soft and e.code != 429:
                try:
                    msg = json.loads(payload).get("message", payload)
                except Exception:
                    msg = payload
                return {"__err": e.code, "__msg": msg}
            if e.code == 429:
                wait = 1.0
                try:
                    wait = float(json.loads(payload).get("retry_after", 1.0))
                except Exception:
                    pass
                print(f"  · 觸發速率限制，{wait:.1f}s 後重試")
                time.sleep(wait + 0.2)
                continue
            raise SystemExit(f"✗ {method} {path} → HTTP {e.code}\n{payload}")
        except urllib.error.URLError as e:
            raise SystemExit(f"✗ 連線失敗：{e.reason}")
    raise SystemExit("✗ 重試多次仍被速率限制，稍後再試")


def _available_tags() -> list[dict]:
    return [{"name": t["name"], "emoji_name": t["emoji"], "moderated": False} for t in TAGS]


def find_forum(channels):
    return next(
        (c for c in channels if c["name"] == FORUM_CHANNEL_NAME and c["type"] == CHANNEL_TYPE_FORUM),
        None,
    )


def cmd_plan():
    channels = request("GET", f"/guilds/{GUILD_ID}/channels")
    forum = find_forum(channels)
    print("=== 目標 vs 現況 ===")
    print(f"[forum]  {FORUM_CHANNEL_NAME:<16} {'已存在 ✓（apply 會校正 tag）' if forum else '將建立 +'}")
    print(f"[tags]   {', '.join(t['emoji'] + t['name'] for t in TAGS)}")
    if forum:
        have = {t.get("name") for t in forum.get("available_tags", [])}
        want = {t["name"] for t in TAGS}
        missing = want - have
        print(f"         現有 tag：{sorted(have) or '（無）'}；缺：{sorted(missing) or '（無，一致）'}")
    print("\napply 後：在該頻道建 Webhook，URL 貼進 community-digest 的 Secret DISCORD_WEBHOOK_URL。")


def ensure_forum(channels):
    forum = find_forum(channels)
    if forum:
        # 冪等校正：確保四個 tag 都在（合併，不刪既有）
        have = {t.get("name"): t for t in forum.get("available_tags", [])}
        merged = list(forum.get("available_tags", []))
        for t in _available_tags():
            if t["name"] not in have:
                merged.append(t)
        request("PATCH", f"/channels/{forum['id']}", {"available_tags": merged})
        print(f"· forum 已存在，已校正 tag：{FORUM_CHANNEL_NAME} ({forum['id']})")
        return forum["id"]
    created = request(
        "POST", f"/guilds/{GUILD_ID}/channels",
        {
            "name": FORUM_CHANNEL_NAME,
            "type": CHANNEL_TYPE_FORUM,
            "topic": FORUM_TOPIC,
            "available_tags": _available_tags(),
        },
    )
    print(f"+ 已建立 forum 頻道：{FORUM_CHANNEL_NAME} ({created['id']})")
    return created["id"]


def cmd_apply():
    channels = request("GET", f"/guilds/{GUILD_ID}/channels")
    forum_id = ensure_forum(channels)
    print("\n✓ 完成。接下來：")
    print(f"  1. 在頻道 {FORUM_CHANNEL_NAME} → 編輯頻道 → 整合 → Webhook → New Webhook → 複製 URL")
    print("  2. 把該 URL 貼進 community-digest 的 GitHub Secret DISCORD_WEBHOOK_URL")
    print("  3. 到 Actions 手動觸發 daily-digest（勾 dry_run 先預覽，或直接跑）")
    print(f"  forum channel id = {forum_id}")


def main():
    if not TOKEN:
        raise SystemExit("✗ 請先 export DISCORD_BOT_TOKEN=...（勿寫進 git）")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if cmd == "plan":
        cmd_plan()
    elif cmd == "apply":
        cmd_apply()
    else:
        raise SystemExit(f"未知指令：{cmd}（用 plan 或 apply）")


if __name__ == "__main__":
    main()
