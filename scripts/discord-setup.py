#!/usr/bin/env python3
"""
scripts/discord-setup.py

DDD Taiwan Discord 伺服器的身分組與頻道結構，設定即程式碼。

設計原則（見本檔 ROLES）：
  1. 權限角色與身分徽章角色分離——徽章一律 0 權限，改權限不會動到人。
  2. 不發 Administrator。核心團隊用明列權限，稽核記錄才能歸因。
  3. @everyone 削到「能看能講不能亂」，其餘往上加。
  4. 位階徽章沿用會員系統語彙（VO / Entity / AR / BC / DE）。

用法：
  export DISCORD_BOT_TOKEN=...            # bot token，勿進 git
  python3 scripts/discord-setup.py audit          # 只讀：身分組現況 vs 目標
  python3 scripts/discord-setup.py apply          # 建立缺少的身分組並排序
  python3 scripts/discord-setup.py apply --fix-everyone   # 一併收斂 @everyone
  python3 scripts/discord-setup.py channels       # 只讀：頻道結構的差異計畫
  python3 scripts/discord-setup.py channels --apply       # 實際建立/搬移頻道
  python3 scripts/discord-setup.py safety         # 只讀：驗證等級與 AutoMod 差異
  python3 scripts/discord-setup.py safety --apply         # 實際套用
  python3 scripts/discord-setup.py onboarding     # 只讀：入門引導問題
  python3 scripts/discord-setup.py onboarding --apply     # 建立問題並啟用

前置：bot 需被邀入伺服器。Discord 不允許 bot 授出自己沒有的權限，
最省事的做法是邀請時給 Administrator、跑完 apply 後把 bot 踢掉
（身分組會留下）：
  https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot&permissions=8
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

# Discord 權限位元（bit position）。用名稱組合，讓 review 時看得懂在給什麼。
PERMS = {
    "CREATE_INSTANT_INVITE": 0, "KICK_MEMBERS": 1, "BAN_MEMBERS": 2, "ADMINISTRATOR": 3,
    "MANAGE_CHANNELS": 4, "MANAGE_GUILD": 5, "ADD_REACTIONS": 6, "VIEW_AUDIT_LOG": 7,
    "PRIORITY_SPEAKER": 8, "STREAM": 9, "VIEW_CHANNEL": 10, "SEND_MESSAGES": 11,
    "SEND_TTS_MESSAGES": 12, "MANAGE_MESSAGES": 13, "EMBED_LINKS": 14, "ATTACH_FILES": 15,
    "READ_MESSAGE_HISTORY": 16, "MENTION_EVERYONE": 17, "USE_EXTERNAL_EMOJIS": 18,
    "VIEW_GUILD_INSIGHTS": 19, "CONNECT": 20, "SPEAK": 21, "MUTE_MEMBERS": 22,
    "DEAFEN_MEMBERS": 23, "MOVE_MEMBERS": 24, "USE_VAD": 25, "CHANGE_NICKNAME": 26,
    "MANAGE_NICKNAMES": 27, "MANAGE_ROLES": 28, "MANAGE_WEBHOOKS": 29,
    "MANAGE_GUILD_EXPRESSIONS": 30, "USE_APPLICATION_COMMANDS": 31, "REQUEST_TO_SPEAK": 32,
    "MANAGE_EVENTS": 33, "MANAGE_THREADS": 34, "CREATE_PUBLIC_THREADS": 35,
    "CREATE_PRIVATE_THREADS": 36, "USE_EXTERNAL_STICKERS": 37, "SEND_MESSAGES_IN_THREADS": 38,
    "USE_EMBEDDED_ACTIVITIES": 39, "MODERATE_MEMBERS": 40, "USE_SOUNDBOARD": 42,
    "CREATE_GUILD_EXPRESSIONS": 43, "CREATE_EVENTS": 44, "USE_EXTERNAL_SOUNDS": 45,
    "SEND_VOICE_MESSAGES": 46, "SEND_POLLS": 49, "USE_EXTERNAL_APPS": 50,
}


def bits(*names):
    total = 0
    for n in names:
        if n not in PERMS:
            raise KeyError(f"未知權限：{n}")
        total |= 1 << PERMS[n]
    return total


def names_of(value):
    inv = {v: k for k, v in PERMS.items()}
    return sorted(inv[b] for b in inv if int(value) & (1 << b))


# 品牌色取自 src/styles/global.css。深色主題是多數，所以位階由高到低用亮→淡的藍，
# 頂階用金色；興趣角色不給顏色（Discord 取「最高有顏色的角色」上色，
# 留白才不會蓋掉位階顏色）。
CORE = 0xC34A33
MOD = 0xE06A4F
CREW = 0x3E6AC0
SPEAKER = 0x8FAEE4

# 由上而下即身分組階層順序。Discord 新建的角色一律落在最底，
# 所以建立順序＝這份清單順序，最後再顯式排一次位置。
ROLES = [
    # ── 權限角色 ──────────────────────────────────────────────
    {
        "name": "核心團隊",
        "color": CORE,
        "hoist": True,
        "mentionable": True,
        "perms": bits(
            "MANAGE_GUILD", "MANAGE_ROLES", "MANAGE_CHANNELS", "MANAGE_WEBHOOKS",
            "MANAGE_GUILD_EXPRESSIONS", "CREATE_GUILD_EXPRESSIONS", "MANAGE_EVENTS",
            "CREATE_EVENTS", "VIEW_AUDIT_LOG", "VIEW_GUILD_INSIGHTS",
            "KICK_MEMBERS", "BAN_MEMBERS", "MODERATE_MEMBERS",
            "MANAGE_MESSAGES", "MANAGE_THREADS", "MANAGE_NICKNAMES", "MENTION_EVERYONE",
            "MUTE_MEMBERS", "DEAFEN_MEMBERS", "MOVE_MEMBERS", "PRIORITY_SPEAKER",
        ),
        "note": "2–3 人。刻意不給 Administrator。",
    },
    {
        "name": "版主",
        "color": MOD,
        "hoist": True,
        "mentionable": True,
        "perms": bits(
            "MANAGE_MESSAGES", "MANAGE_THREADS", "MODERATE_MEMBERS", "MANAGE_NICKNAMES",
            "VIEW_AUDIT_LOG", "KICK_MEMBERS", "MUTE_MEMBERS", "DEAFEN_MEMBERS", "MOVE_MEMBERS",
        ),
        "note": "禁言（timeout）為主，封鎖權留給核心團隊。",
    },
    {
        "name": "活動小組",
        "color": CREW,
        "hoist": False,
        "mentionable": True,
        "perms": bits("CREATE_EVENTS", "MANAGE_EVENTS", "MENTION_EVERYONE"),
        "note": "MENTION_EVERYONE 只在 #公告 的頻道 overwrite 生效才有意義。",
    },
    {
        "name": "講者",
        "color": SPEAKER,
        "hoist": False,
        "mentionable": True,
        "perms": bits("PRIORITY_SPEAKER", "REQUEST_TO_SPEAK", "STREAM", "CREATE_EVENTS"),
        "note": "活動期間授予，結束後回收。",
    },
    # ── 位階徽章（0 權限）────────────────────────────────────
    {"name": "Domain Expert", "color": 0xD4A24A, "hoist": True, "mentionable": False, "perms": 0,
     "note": "25 加權分以上，目前 2 人。"},
    {"name": "Bounded Context", "color": 0x5B83CF, "hoist": True, "mentionable": False, "perms": 0,
     "note": "15 分，目前 11 人。"},
    {"name": "Aggregate Root", "color": 0x6E93D8, "hoist": False, "mentionable": False, "perms": 0,
     "note": "8 分，目前 62 人。"},
    {"name": "Entity", "color": 0x8FAEE4, "hoist": False, "mentionable": False, "perms": 0,
     "note": "3 分，目前 244 人。"},
    {"name": "Value Object", "color": 0xA8B6CD, "hoist": False, "mentionable": False, "perms": 0,
     "note": "起始位階，目前 1263 人。"},
    # ── 興趣／通知角色（0 權限、不上色、可被提及）──────────
    {"name": "讀書會", "color": 0, "hoist": False, "mentionable": True, "perms": 0, "note": "Onboarding 自選。"},
    {"name": "年會志工", "color": 0, "hoist": False, "mentionable": True, "perms": 0, "note": "Onboarding 自選。"},
    {"name": "活動通知", "color": 0, "hoist": False, "mentionable": True, "perms": 0,
     "note": "取代 @everyone 的公告提及目標。"},
    {"name": "台北", "color": 0, "hoist": False, "mentionable": True, "perms": 0, "note": "Onboarding 自選。"},
    {"name": "台中", "color": 0, "hoist": False, "mentionable": True, "perms": 0, "note": "Onboarding 自選。"},
    {"name": "台南", "color": 0, "hoist": False, "mentionable": True, "perms": 0, "note": "Onboarding 自選。"},
]

# @everyone 只做減法：拿掉危險與會製造看不見空間的權限，其餘一律不動。
# 整片覆寫（設成固定 baseline）會順手關掉貼圖、音效板、投票這些沒有安全意義的功能，
# 對社群氣氛是淨損失，所以這裡只列真正要關的。
EVERYONE_DENY = [
    "ADMINISTRATOR", "MANAGE_GUILD", "MANAGE_ROLES", "MANAGE_CHANNELS", "MANAGE_WEBHOOKS",
    "MANAGE_MESSAGES", "MANAGE_THREADS", "MANAGE_NICKNAMES", "MENTION_EVERYONE",
    "KICK_MEMBERS", "BAN_MEMBERS", "MODERATE_MEMBERS", "VIEW_AUDIT_LOG",
    "MUTE_MEMBERS", "DEAFEN_MEMBERS", "MOVE_MEMBERS", "PRIORITY_SPEAKER",
    "SEND_TTS_MESSAGES",
    # 私人討論串會產生版主看不見的空間——這是唯一為了治理而關掉的「一般」功能。
    "CREATE_PRIVATE_THREADS",
]


def request(method, path, body=None, soft=False):
    """呼叫 Discord API，遇 429 依 retry_after 重試。

    soft=True 時，HTTP 錯誤回傳 {"__err": code, "__msg": ...} 而非中斷程式——
    用於逐一處理頻道這種「一個失敗不該拖垮整批」的場合。
    """
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(6):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bot {TOKEN}")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "DDDTW-RoleSetup (ddd-tw.com)")
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


def fetch_state():
    guild = request("GET", f"/guilds/{GUILD_ID}")
    roles = request("GET", f"/guilds/{GUILD_ID}/roles")
    channels = request("GET", f"/guilds/{GUILD_ID}/channels")
    # bot 不能用 /members/@me（@me 只對 OAuth 使用者有效），先問自己的 user id。
    self_user = request("GET", "/users/@me")
    me = request("GET", f"/guilds/{GUILD_ID}/members/{self_user['id']}")
    return guild, roles, channels, me


def bot_top_position(roles, me):
    mine = [r for r in roles if r["id"] in me.get("roles", [])]
    return max([r["position"] for r in mine], default=0)


def audit():
    guild, roles, channels, me = fetch_state()
    by_name = {r["name"]: r for r in roles}
    everyone = by_name.get("@everyone")

    print(f"伺服器：{guild['name']}  (id {guild['id']})")
    print(f"社群功能：{'已開啟' if 'COMMUNITY' in guild.get('features', []) else '未開啟 ← 建議開啟'}")
    print(f"驗證等級：{guild.get('verification_level')}  (0 無 / 1 低 / 2 中 ← 建議 / 3 高 / 4 最高)")
    print(f"管理動作需 2FA：{'是' if guild.get('mfa_level') else '否 ← 建議開啟'}")
    print(f"頻道數：{len(channels)}　現有身分組：{len(roles) - 1}（不含 @everyone）")
    print(f"bot 最高身分組位置：{bot_top_position(roles, me)}")

    print("\n── 現有身分組（由上而下）──")
    for r in sorted(roles, key=lambda r: -r["position"]):
        if r["name"] == "@everyone":
            continue
        perms = int(r["permissions"])
        tag = "  ⚠ ADMINISTRATOR" if perms & bits("ADMINISTRATOR") else ""
        kind = "整合/bot" if r.get("managed") else "手動"
        print(f"  {r['position']:>3}  {r['name']:<20} {kind:<8} 權限 {perms}{tag}")

    print("\n── 目標身分組 ──")
    missing = []
    for spec in ROLES:
        if spec["name"] in by_name:
            print(f"  ✓ 已存在  {spec['name']}")
        else:
            missing.append(spec)
            print(f"  + 待建立  {spec['name']:<18} {spec['note']}")

    if everyone:
        cur = int(everyone["permissions"])
        deny = bits(*EVERYONE_DENY)
        hit = names_of(cur & deny)
        print("\n── @everyone ──")
        print(f"  目前：{cur}")
        print("  建議關閉：" + (", ".join(hit) if hit else "（無，已乾淨）"))

    print(f"\n共 {len(missing)} 個身分組待建立。執行 apply 建立。")
    return missing


def apply(fix_everyone):
    guild, roles, channels, me = fetch_state()
    by_name = {r["name"]: r for r in roles}
    top = bot_top_position(roles, me)

    created = []
    for spec in ROLES:
        if spec["name"] in by_name:
            print(f"  ✓ 略過（已存在）{spec['name']}")
            continue
        body = {
            "name": spec["name"],
            "permissions": str(spec["perms"]),
            "color": spec["color"],
            "hoist": spec["hoist"],
            "mentionable": spec["mentionable"],
        }
        r = request("POST", f"/guilds/{GUILD_ID}/roles", body)
        created.append(r)
        print(f"  + 已建立 {spec['name']}  (id {r['id']})")
        time.sleep(0.4)

    # 顯式排序：把管理中的身分組整包排在 bot 最高身分組之下。
    managed = []
    for spec in ROLES:
        r = by_name.get(spec["name"]) or next((c for c in created if c["name"] == spec["name"]), None)
        if r:
            managed.append(r)
    # 新建的身分組全部並排在 position 1；此時 Discord 的階層檢查會放行整批排序，
    # 不需要先把 bot 的身分組拖到最上面（實測如此）。直接送出、由 Discord 裁決，
    # 不要自己先判定失敗——被拒時 soft 模式會把原因印出來。
    if managed:
        n = len(managed)
        payload = [{"id": r["id"], "position": n - i} for i, r in enumerate(managed)]
        r = request("PATCH", f"/guilds/{GUILD_ID}/roles", payload, soft=True)
        if isinstance(r, dict) and r.get("__err"):
            print(f"\n  ✗ 排序被拒：HTTP {r['__err']} {r['__msg']}")
            print(f"    bot 最高身分組位置 {top}。請在 UI 把 bot 的身分組拖高後重跑。")
        else:
            print(f"\n  ↕ 已排序 {n} 個身分組")

    if fix_everyone:
        everyone = by_name.get("@everyone")
        cur = int(everyone["permissions"])
        target = cur & ~bits(*EVERYONE_DENY)
        if target == cur:
            print("  ✓ @everyone 已無須調整")
        else:
            request("PATCH", f"/guilds/{GUILD_ID}/roles/{everyone['id']}",
                    {"permissions": str(target)})
            print(f"  ↻ @everyone {cur} → {target}")
            print("    關閉：" + ", ".join(names_of(cur & ~target)))

    print("\n完成。接著跑 channels --apply 與 safety --apply。")
    print("只能在 UI 手動做的：")
    print("  · 要求 2FA（僅伺服器擁有者可設，API 不開放給 bot）")
    print("  · Onboarding：把興趣角色掛成自選問題")
    print("  · #announcements 的 webhook（要複製 URL 給 GitHub Secret）")
    print("  · 跑完後把這支 bot 踢掉（身分組與頻道會保留）")



# ─────────────────────────────────────────────────────────────────────────────
# 頻道結構
#
# 骨架取自 Virtual DDD（General / Sessions / Topics），但刻意避開他們的沉積問題：
# 一次性活動不開常設頻道（用 #events-chat 的討論串或臨時頻道，結束後丟 Archive），
# 冷門議題不開常設頻道（用 #ask-anything 這個 Forum 吸收，某個題目持續熱才升格）。
#
# adopt：既有頻道改名/搬進類別，不重建，歷史訊息保留。
# ─────────────────────────────────────────────────────────────────────────────
TEXT, VOICE, CATEGORY, ANNOUNCEMENT, STAGE, FORUM = 0, 2, 4, 5, 13, 15

# 只有核心團隊與版主看得見
STAFF_ONLY = [
    ("@everyone", [], ["VIEW_CHANNEL"]),
    ("核心團隊", ["VIEW_CHANNEL"], []),
    ("版主", ["VIEW_CHANNEL"], []),
]
# 唯讀（公告、規則、封存）
READ_ONLY = [("@everyone", [], ["SEND_MESSAGES", "CREATE_PUBLIC_THREADS", "SEND_POLLS"])]
# 公告：一般人唯讀，公告者可發並可提及
ANNOUNCE = READ_ONLY + [
    ("核心團隊", ["SEND_MESSAGES", "MENTION_EVERYONE", "CREATE_PUBLIC_THREADS"], []),
    ("活動小組", ["SEND_MESSAGES", "MENTION_EVERYONE", "CREATE_PUBLIC_THREADS"], []),
]

CHANNELS = [
    ("資訊 · Information", [
        {"name": "announcements", "type": ANNOUNCEMENT, "ow": ANNOUNCE,
         "topic": "活動與社群公告。CI 的 webhook 也發在這裡。訂閱後可在自己的伺服器追蹤。"},
        {"name": "rules", "type": TEXT, "adopt": "rules", "ow": READ_ONLY,
         "topic": "社群守則與行為準則。"},
        {"name": "resources", "type": TEXT,
         "topic": "投影片、錄影、書單、外部好文。"},
    ]),
    ("大廳 · General", [
        {"name": "general", "type": TEXT, "adopt": "general",
         "topic": "什麼都可以聊。不確定發哪裡就發這裡。"},
        {"name": "introductions", "type": TEXT, "adopt": "introduction", "slowmode": 30,
         "topic": "自我介紹：你在做什麼、想在 DDD 學什麼。"},
    ]),
    ("活動 · Events", [
        {"name": "events-chat", "type": TEXT,
         "topic": "活動前提問、當天同步、會後討論。每場活動開一條討論串，不開新頻道。"},
        {"name": "book-club", "type": TEXT,
         "topic": "讀書會。每一本書開一條討論串。"},
        {"name": "議程直播", "type": STAGE,
         "topic": "線上議程與 open space。"},
        {"name": "會後續攤", "type": VOICE, "adopt": "General",
         "topic": "隨時可進來的語音房。"},
    ]),
    ("討論 · Topics", [
        {"name": "ask-anything", "type": FORUM,
         "topic": "有問題就開一篇。取代一堆冷門主題頻道——某個題目持續熱起來，再升格成常設頻道。"},
        {"name": "domain-driven-design", "type": TEXT,
         "topic": "戰略與戰術設計、限界脈絡、事件風暴。"},
        {"name": "architecture-and-systems", "type": TEXT,
         "topic": "系統設計、socio-technical、演進式架構。"},
    ]),
    ("社群 · Community", [
        {"name": "ddd-crew", "type": TEXT, "adopt": "ddd-crew",
         "topic": "與 DDD Crew 的協作與國際連結。"},
        {"name": "community-ideas", "type": TEXT,
         "topic": "想辦什麼、想改什麼、想幫什麼忙。"},
    ]),
    # Discord 建立社群伺服器時會自帶 #moderator-only，並把它指派為「社群更新頻道」
    # （官方通知的落點）。那個指派只能從 UI 改，且被指派的頻道無法刪除。
    # 決定保留 Discord 的原始配置：#moderator-only 當 staff 的討論區，本腳本不碰它
    # （它 deny @everyone 檢視，bot 也沒有存取權），這裡只補一個機器噪音專用頻道。
    ("Staff", [
        {"name": "staff-logs", "type": TEXT, "ow": STAFF_ONLY,
         "topic": "AutoMod 警示與自動化紀錄。人的討論在 #moderator-only。"},
    ]),
    ("Archive", [], {"ow": READ_ONLY,
                     "note": "活動結束的臨時頻道拖進來，唯讀保存，不刪。"}),
]


def resolve_overwrites(spec_ow, roles_by_name):
    """把 (角色名, allow, deny) 轉成 Discord 的 permission_overwrites。"""
    out = []
    for role_name, allow, deny in spec_ow:
        r = roles_by_name.get(role_name)
        if not r:
            print(f"    ⚠ 找不到身分組「{role_name}」，略過這條 overwrite")
            continue
        out.append({"id": r["id"], "type": 0,
                    "allow": str(bits(*allow) if allow else 0),
                    "deny": str(bits(*deny) if deny else 0)})
    return out


def channels(do_apply):
    guild, roles, existing, me = fetch_state()
    roles_by_name = {r["name"]: r for r in roles}
    # 私有頻道（@everyone deny VIEW_CHANNEL）會連 bot 自己一起關在外面，
    # 之後就 Missing Access 改不動。把 bot 的身分組加進豁免；
    # 收尾把 bot 踢掉時，這條 overwrite 會隨它的身分組一起消失。
    bot_role = next((r for r in roles if r.get("managed") and r["id"] in me.get("roles", [])), None)
    if bot_role and not any(o[0] == bot_role["name"] for o in STAFF_ONLY):
        STAFF_ONLY.append((bot_role["name"], ["VIEW_CHANNEL"], []))
    by_name = {c["name"]: c for c in existing}
    cats = {c["name"]: c for c in existing if c["type"] == CATEGORY}
    verb = "執行" if do_apply else "計畫（唯讀，加 --apply 才會動）"
    print(f"頻道結構 {verb}\n")

    planned = set()
    for entry in CHANNELS:
        cat_name, children = entry[0], entry[1]
        cat_opts = entry[2] if len(entry) > 2 else {}
        cat = cats.get(cat_name)
        if cat:
            print(f"[類別] {cat_name}  ✓ 已存在")
        else:
            print(f"[類別] {cat_name}  + 建立")
            if do_apply:
                body = {"name": cat_name, "type": CATEGORY}
                if cat_opts.get("ow"):
                    body["permission_overwrites"] = resolve_overwrites(cat_opts["ow"], roles_by_name)
                cat = request("POST", f"/guilds/{GUILD_ID}/channels", body)
                cats[cat_name] = cat
                time.sleep(0.4)
        if cat_opts.get("note"):
            print(f"         ({cat_opts['note']})")

        for ch in children:
            planned.add(ch["name"])
            src = by_name.get(ch.get("adopt", "")) or by_name.get(ch["name"])
            body = {"name": ch["name"], "type": ch["type"]}
            # 語音頻道沒有 topic 欄位（傳了會得到很誤導的 CHANNEL_TOPIC_INVALID）。
            if ch["type"] != VOICE:
                body["topic"] = ch.get("topic", "")
            if cat:
                body["parent_id"] = cat["id"]
            if ch.get("slowmode"):
                body["rate_limit_per_user"] = ch["slowmode"]
            if ch.get("ow"):
                body["permission_overwrites"] = resolve_overwrites(ch["ow"], roles_by_name)

            if src:
                moves = []
                if src["name"] != ch["name"]:
                    moves.append(f"改名 {src['name']} → {ch['name']}")
                if src.get("parent_id") != (cat or {}).get("id"):
                    moves.append(f"搬入 {cat_name}")
                if ch["type"] != VOICE and src.get("topic") != ch.get("topic", ""):
                    moves.append("設定主題")
                if ch.get("ow"):
                    moves.append("套用權限")
                if src["type"] != ch["type"]:
                    moves.append(f"⚠ 型別 {src['type']} ≠ {ch['type']}（需手動轉換，此處不改）")
                    body.pop("type", None)
                else:
                    body.pop("type", None)
                print(f"    ↻ {ch['name']:<26} {'；'.join(moves) if moves else '無需變更'}")
                if do_apply and moves:
                    r = request("PATCH", f"/channels/{src['id']}", body, soft=True)
                    if isinstance(r, dict) and r.get("__err"):
                        print(f"       ✗ 跳過：HTTP {r['__err']} {r['__msg']}")
                    time.sleep(0.4)
            else:
                print(f"    + {ch['name']:<26} 建立（type={ch['type']}）")
                if do_apply:
                    r = request("POST", f"/guilds/{GUILD_ID}/channels", body, soft=True)
                    if isinstance(r, dict) and r.get("__err"):
                        print(f"       ✗ 跳過：HTTP {r['__err']} {r['__msg']}")
                    time.sleep(0.4)

    # 顯式排序：類別依 CHANNELS 的順序，頻道依類別內的宣告順序。
    # 不做這步的話順序由建立時間決定（例如 rules 會跑到 announcements 前面）。
    if do_apply:
        fresh = request("GET", f"/guilds/{GUILD_ID}/channels")
        by_id_name = {c["name"]: c for c in fresh}
        cat_ids = {c["name"]: c["id"] for c in fresh if c["type"] == CATEGORY}
        payload = []
        for i, entry in enumerate(CHANNELS):
            cid = cat_ids.get(entry[0])
            if cid:
                payload.append({"id": cid, "position": i})
            for j, ch in enumerate(entry[1]):
                c = by_id_name.get(ch["name"])
                if c:
                    payload.append({"id": c["id"], "position": j})
        if payload:
            r = request("PATCH", f"/guilds/{GUILD_ID}/channels", payload, soft=True)
            if isinstance(r, dict) and r.get("__err"):
                print(f"\n    ✗ 排序失敗：HTTP {r['__err']} {r['__msg']}")
            else:
                print(f"\n    ↕ 已排序 {len(payload)} 個類別／頻道")

    orphans = [c for c in existing
               if c["type"] != CATEGORY
               and c["name"] not in planned
               and c["name"] not in {ch.get("adopt") for e in CHANNELS for ch in e[1]}]
    if orphans:
        print("\n未列入計畫的既有頻道（不動，你自己決定留或丟 Archive）：")
        for c in orphans:
            print(f"    · {c['name']}")

    empty_cats = [c for c in existing if c["type"] == CATEGORY
                  and c["name"] not in {e[0] for e in CHANNELS}]
    if empty_cats:
        print("\n舊的預設類別（搬空後可手動刪除）：")
        for c in empty_cats:
            print(f"    · {c['name']}")



# ─────────────────────────────────────────────────────────────────────────────
# 伺服器安全設定：驗證等級 + AutoMod 規則
#
# AutoMod 是 API 可管的（POST /guilds/{id}/auto-moderation/rules）。
# 三條規則都豁免 staff，避免主辦在公告時被自己的規則擋下。
# ─────────────────────────────────────────────────────────────────────────────
VERIFICATION_LEVEL = 2  # 中：需驗證 email 且註冊滿 5 分鐘

AUTOMOD_EXEMPT = ["核心團隊", "版主", "活動小組"]

AUTOMOD_RULES = [
    {
        "name": "垃圾訊息",
        "trigger_type": 3,          # SPAM
        "trigger_metadata": {},
        "timeout": 0,
        "note": "Discord 自己的垃圾訊息模型，擋掉罐頭推銷。",
    },
    {
        "name": "提及轟炸",
        "trigger_type": 5,          # MENTION_SPAM
        "trigger_metadata": {"mention_total_limit": 5},
        "timeout": 300,
        "note": "單則訊息提及超過 5 人即封鎖並禁言 5 分鐘。",
    },
    {
        "name": "可疑連結與外部邀請",
        "trigger_type": 1,          # KEYWORD
        "trigger_metadata": {"keyword_filter": [
            "discord.gg/*", "discordapp.com/invite/*", "discord.com/invite/*",
            "*free nitro*", "*免費 nitro*", "steamcommunity.com/gift*",
            "*airdrop*", "*空投*",
        ]},
        "timeout": 0,
        "note": "最常見的盜帳號手法。官網那條永久邀請不受影響（那是別人貼進來才會被擋）。",
    },
]


def safety(do_apply):
    guild, roles, chans, me = fetch_state()
    roles_by_name = {r["name"]: r for r in roles}
    exempt = [roles_by_name[n]["id"] for n in AUTOMOD_EXEMPT if n in roles_by_name]
    alert = next((c["id"] for c in chans if c["name"] == "staff-logs"), None)
    verb = "執行" if do_apply else "計畫（唯讀，加 --apply 才會動）"
    print(f"安全設定 {verb}\n")

    cur_v = guild.get("verification_level")
    if cur_v >= VERIFICATION_LEVEL:
        print(f"  ✓ 驗證等級已是 {cur_v}")
    else:
        print(f"  ↻ 驗證等級 {cur_v} → {VERIFICATION_LEVEL}（中：需驗證 email 且註冊滿 5 分鐘）")
        if do_apply:
            request("PATCH", f"/guilds/{GUILD_ID}", {"verification_level": VERIFICATION_LEVEL})

    # 社群伺服器必須指定「規則」與「社群更新」頻道，被指定的頻道無法刪除。
    # 預設常落在 moderator-only 這種舊頻道上，導致想刪卻刪不掉——這裡把它們導正。
    by_name = {c["name"]: c for c in chans}
    designated = {
        "rules_channel_id": "rules",
        "safety_alerts_channel_id": "staff-logs",
    }
    # public_updates_channel_id 不列入管理：社群伺服器的這個欄位 PATCH /guilds 會回 200
    # 但默默忽略（實測三個目標頻道皆然），只能從 伺服器設定 → 社群 → 社群更新頻道 改。
    # 決定沿用 Discord 的原始指派（#moderator-only），這裡只顯示現況、不試圖修改。
    PUBLIC_UPDATES_FIELD = "public_updates_channel_id"
    patch = {}
    print("\n── 社群指定頻道 ──")
    for field, want in designated.items():
        target = by_name.get(want)
        cur = guild.get(field)
        cur_name = next((c["name"] for c in chans if c["id"] == cur), None)
        if not target:
            print(f"  ⚠ {field}：找不到 #{want}，略過")
        elif cur == target["id"]:
            print(f"  ✓ {field} = #{want}")
        else:
            print(f"  ↻ {field}：{'#' + cur_name if cur_name else '（未設定）'} → #{want}")
            patch[field] = target["id"]
    cur = guild.get(PUBLIC_UPDATES_FIELD)
    cur_name = next((c["name"] for c in chans if c["id"] == cur), None)
    print(f"  · public_updates_channel_id = "
          f"{'#' + cur_name if cur_name else '（未設定）'}（Discord 原始配置，刻意保留）")
    if patch and do_apply:
        request("PATCH", f"/guilds/{GUILD_ID}", patch)

    print(f"\n  警示頻道：{'#staff-logs' if alert else '（找不到 staff-logs，將只封鎖不通報）'}")
    print(f"  豁免身分組：{', '.join(AUTOMOD_EXEMPT)}")

    existing = request("GET", f"/guilds/{GUILD_ID}/auto-moderation/rules") or []
    have = {r["name"] for r in existing}
    print("\n── AutoMod 規則 ──")
    for spec in AUTOMOD_RULES:
        if spec["name"] in have:
            print(f"  ✓ 已存在  {spec['name']}")
            continue
        print(f"  + 建立    {spec['name']}：{spec['note']}")
        if not do_apply:
            continue
        actions = [{"type": 1, "metadata": {
            "custom_message": "這則訊息被社群的自動審核規則擋下了。有疑問請找版主。"}}]
        if alert:
            actions.append({"type": 2, "metadata": {"channel_id": alert}})
        if spec["timeout"]:
            actions.append({"type": 3, "metadata": {"duration_seconds": spec["timeout"]}})
        body = {
            "name": spec["name"],
            "event_type": 1,                 # MESSAGE_SEND
            "trigger_type": spec["trigger_type"],
            "trigger_metadata": spec["trigger_metadata"],
            "actions": actions,
            "enabled": True,
            "exempt_roles": exempt,
        }
        request("POST", f"/guilds/{GUILD_ID}/auto-moderation/rules", body)
        time.sleep(0.4)



# ─────────────────────────────────────────────────────────────────────────────
# Onboarding（入門引導）
#
# 走 PUT /guilds/{id}/onboarding，不必在 UI 裡找——新版 Discord 的側欄
# 已經沒有「社群」分類，這頁在部分版本上找不到。API 需要 MANAGE_GUILD + MANAGE_ROLES。
#
# Discord 的啟用條件：預設頻道至少 7 個，其中至少 5 個允許 @everyone 發言。
# ─────────────────────────────────────────────────────────────────────────────
ONBOARDING_DEFAULT_CHANNELS = [
    "announcements", "rules", "general", "introductions", "events-chat",
    "book-club", "ask-anything", "domain-driven-design",
    "architecture-and-systems", "ddd-crew", "community-ideas", "resources",
]

ONBOARDING_PROMPTS = [
    {
        "title": "你想收到哪些通知？",
        "single_select": False,
        "required": False,
        "options": [
            ("活動通知", "新活動開放報名時提醒我", "📣", "活動通知"),
            ("讀書會", "一起讀、一起練", "📚", "讀書會"),
            ("年會志工", "想在年會幫忙", "🙋", "年會志工"),
        ],
    },
    {
        "title": "你在哪個城市？",
        "single_select": True,
        "required": False,
        "options": [
            ("台北", "北部聚會", "🏙", "台北"),
            ("台中", "中部聚會", "🌆", "台中"),
            ("台南", "南部聚會", "🌴", "台南"),
        ],
    },
]


def onboarding(do_apply):
    guild, roles, chans, me = fetch_state()
    roles_by_name = {r["name"]: r for r in roles}
    chans_by_name = {c["name"]: c for c in chans}
    verb = "執行" if do_apply else "計畫（唯讀，加 --apply 才會動）"
    print(f"Onboarding {verb}\n")

    default_ids, missing = [], []
    for n in ONBOARDING_DEFAULT_CHANNELS:
        (default_ids.append(chans_by_name[n]["id"]) if n in chans_by_name else missing.append(n))
    if missing:
        print(f"  ⚠ 找不到頻道，略過：{', '.join(missing)}")
    print(f"  預設頻道 {len(default_ids)} 個（Discord 要求 ≥7，其中 ≥5 可發言）")

    prompts, pid = [], 0
    for spec in ONBOARDING_PROMPTS:
        opts = []
        for title, desc, emoji, role_name in spec["options"]:
            r = roles_by_name.get(role_name)
            if not r:
                print(f"    ⚠ 找不到身分組「{role_name}」，略過該選項")
                continue
            pid += 1
            opts.append({
                "id": str(pid), "title": title, "description": desc,
                # emoji 必須用 emoji_name（扁平欄位）。傳 "emoji": {...} 這個
                # partial emoji 物件會被 Discord 靜默丟掉，回傳 emoji=null。
                "emoji_name": emoji, "emoji_animated": False,
                "role_ids": [r["id"]], "channel_ids": [],
            })
        pid += 1
        prompts.append({
            "id": str(pid), "type": 0, "title": spec["title"],
            "single_select": spec["single_select"], "required": spec["required"],
            "in_onboarding": True, "options": opts,
        })
        print(f"  · {spec['title']}（{'單選' if spec['single_select'] else '可多選'}）"
              f" → {', '.join(o['title'] for o in opts)}")

    if not do_apply:
        return
    body = {"prompts": prompts, "default_channel_ids": default_ids,
            "enabled": True, "mode": 0}
    r = request("PUT", f"/guilds/{GUILD_ID}/onboarding", body, soft=True)
    if isinstance(r, dict) and r.get("__err"):
        print(f"\n  ✗ 失敗：HTTP {r['__err']} {r['__msg']}")
    else:
        print(f"\n  ✓ 已啟用：{len(r.get('prompts', []))} 個問題、"
              f"{len(r.get('default_channel_ids', []))} 個預設頻道")


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "audit"
    if cmd not in ("audit", "apply", "channels", "safety", "onboarding"):
        raise SystemExit(__doc__)
    if not TOKEN:
        raise SystemExit("✗ 請先設定 DISCORD_BOT_TOKEN（見檔頭說明）")
    if cmd == "audit":
        audit()
    elif cmd == "channels":
        channels("--apply" in args)
    elif cmd == "safety":
        safety("--apply" in args)
    elif cmd == "onboarding":
        onboarding("--apply" in args)
    else:
        apply("--fix-everyone" in args)


if __name__ == "__main__":
    main()
