#!/usr/bin/env python3
"""
scripts/build-achievements.py

輸入：
  - dddtw-attendees/consolidated/all-attendances.csv   (報名事實，含明文 email，永不進 git)
  - src/data/event-registry.json                        (76 代碼 → 正式活動 + topics/weight/type)
輸出：
  - public/api/achievements/{hash 前2碼}.json           (部署產物；只含 emailHash，不含明文)

規則見 docs/member-system-design.md §5–§6。
執行：DDDTW_ACHIEVEMENT_SALT=... python3 scripts/build-achievements.py
"""

import csv
import hashlib
import json
import os
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 必須與 MemberPage.astro 內的 SALT 完全一致
SALT = os.environ.get("DDDTW_ACHIEVEMENT_SALT", "dddtw-achievements-v1")

WEIGHTS = {"meetup": 1.0, "bookclub": 1.0, "workshop": 1.5, "conference": 2.0, "tour": 1.0}
RANK_THRESHOLDS = [  # (key, 最低加權分)；門檻依 Phase 0 試跑分佈校準
    ("domain-expert", 25),
    ("bounded-context", 15),
    ("aggregate-root", 8),
    ("entity", 3),
    ("value-object", 0),
]
TYPE_LABELS = {"meetup": "Meetup", "bookclub": "讀書會", "workshop": "工作坊",
               "conference": "年會", "tour": "Tour"}


def email_hash(email: str) -> str:
    return hashlib.sha256((email.strip().lower() + SALT).encode()).hexdigest()


def rank_of(score: float) -> str:
    for key, th in RANK_THRESHOLDS:
        if score >= th:
            return key
    return "value-object"


def next_threshold(score: float):
    for _, th in sorted(RANK_THRESHOLDS, key=lambda x: x[1]):
        if score < th:
            return th
    return None


def compute_badges(rec, registry_by_id):
    """徽章規則（純函式）。rec: 單人彙整紀錄。回傳 badge id list。"""
    badges = []
    n = len(rec["eventIds"])
    if n >= 1:
        badges.append("first")
    if n >= 5:
        badges.append("m5")
    if n >= 10:
        badges.append("m10")
    if n >= 20:
        badges.append("m20")

    years = {d[:4] for d in rec["dates"]}
    if years and min(years) <= "2021":
        badges.append("old-guard")

    ev_ids = rec["eventIds"]
    conf_years = sorted({registry_by_id[e]["date"][:4] for e in ev_ids
                         if registry_by_id[e]["type"] == "conference"})
    if "2020" in conf_years:  # 創始見證者：參加過 2020 首屆年會
        badges.append("founding")
    # 連續 >=3 屆年會（年會年份：2020/2021/2023/2024/2025，2022 停辦視為連續豁免）
    conf_seq = ["2020", "2021", "2023", "2024", "2025"]
    idx = [conf_seq.index(y) for y in conf_years if y in conf_seq]
    if idx:
        longest, cur = 1, 1
        for a, b in zip(idx, idx[1:]):
            cur = cur + 1 if b == a + 1 else 1
            longest = max(longest, cur)
        if longest >= 3:
            badges.append("conf-regular")

    types = {registry_by_id[e]["type"] for e in ev_ids}
    if {"meetup", "conference", "bookclub"} <= types:
        badges.append("globetrotter")
    if "tour" in types:
        badges.append("tourer")

    if rec["topics"].get("eventstorming", 0) >= 5:
        badges.append("es-gold")
    return badges


def load_aliases():
    """email-aliases.json（§7.4 多 email 合併）：{ "aliases": [{ "primary": <hash>, "merged": [<hash>...] }] }
    回傳 merged hash → primary hash 的映射。alias 檔存 hash 而非明文。"""
    path = os.path.join(BASE, "src/data/email-aliases.json")
    if not os.path.exists(path):
        return {}
    mapping = {}
    for entry in json.load(open(path, encoding="utf-8")).get("aliases", []):
        for m in entry.get("merged", []):
            mapping[m] = entry["primary"]
    return mapping


def main():
    registry = json.load(open(os.path.join(BASE, "src/data/event-registry.json"), encoding="utf-8"))
    registry_by_id = {e["eventId"]: e for e in registry}
    source_to_event = {s: e for e in registry for s in e.get("sources", [])}
    aliases = load_aliases()

    # 每人彙整；series 場次（seriesCounts）每場計分，其餘同一 eventId 只計一次
    by_hash = defaultdict(lambda: {
        "score": 0.0, "eventIds": set(), "seriesAttend": defaultdict(int),
        "events": {}, "topics": defaultdict(int), "dates": set(),
    })
    skipped_sources = set()
    csv_path = os.path.join(BASE, "dddtw-attendees/consolidated/all-attendances.csv")
    with open(csv_path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            email = row.get("彙整Email", "")
            src = row.get("活動代碼", "")
            if not email or "@" not in email:
                continue
            if src not in source_to_event:
                skipped_sources.add(src)
                continue
            ev = source_to_event[src]
            eid = ev["eventId"]
            h = email_hash(email)
            h = aliases.get(h, h)  # 多 email 合併：導向 primary
            rec = by_hash[h]

            is_series = ev.get("seriesCounts")
            if is_series:
                # 系列讀書會：每個 source 場次各計 1 次（但同場重複報名只算一次）
                key = (eid, src)
                if key in rec["events"]:
                    continue
                rec["events"][key] = True
                rec["seriesAttend"][eid] += 1
            else:
                if eid in rec["eventIds"] and eid in {k[0] for k in rec["events"]}:
                    continue
                rec["events"][(eid, src)] = True
                if eid in rec["eventIds"]:
                    continue  # 同活動多 source（如年會+加開）只計分一次

            rec["eventIds"].add(eid)
            weight = ev.get("weight", WEIGHTS.get(ev.get("type"), 1.0))
            rec["score"] += weight
            rec["dates"].add(ev["date"])
            for tp in ev.get("topics", []):
                rec["topics"][tp] += 1

    if skipped_sources:
        print(f"[warn] {len(skipped_sources)} 個活動代碼不在 registry，未計入：{sorted(skipped_sources)[:5]}...")

    # 人工補登（src/data/manual-participations.json，見設計文件 §7.4）。
    # 只含 emailHash（不含明文），進版控 = 補登有審核紀錄。
    # 格式：{ emailHash, grant: "all-events" | [eventId, ...], note }
    manual_path = os.path.join(BASE, "src/data/manual-participations.json")
    if os.path.exists(manual_path):
        for entry in json.load(open(manual_path, encoding="utf-8")):
            h = entry["emailHash"]
            rec = by_hash[h]
            grant = entry.get("grant", [])
            event_ids = list(registry_by_id) if grant == "all-events" else grant
            granted = 0
            for eid in event_ids:
                if eid not in registry_by_id or eid in rec["eventIds"]:
                    continue
                ev = registry_by_id[eid]
                rec["events"][(eid, f"manual:{eid}")] = True
                if ev.get("seriesCounts"):
                    rec["seriesAttend"][eid] = ev.get("seriesOf", 1)
                rec["eventIds"].add(eid)
                rec["score"] += ev.get("weight", WEIGHTS.get(ev.get("type"), 1.0))
                rec["dates"].add(ev["date"])
                for tp in ev.get("topics", []):
                    rec["topics"][tp] += 1
                granted += 1
            print(f"[manual] {h[:12]}… +{granted} 場（{entry.get('note', '')[:30]}…）")

    # 系列全勤補分與徽章可在此擴充（seriesOf vs seriesAttend）

    shards = defaultdict(dict)
    for h, rec in by_hash.items():
        dates = sorted(rec["dates"])
        events_out = []
        for eid in rec["eventIds"]:
            ev = registry_by_id[eid]
            extra = ""
            if ev.get("seriesCounts") and rec["seriesAttend"].get(eid, 0) > 1:
                extra = f"（{rec['seriesAttend'][eid]} 場）"
            events_out.append({
                "date": ev["date"][:7].replace("-", "."),
                "title": ev.get("title", eid) + extra,
                "type": TYPE_LABELS.get(ev.get("type"), ev.get("type", "")),
            })
        events_out.sort(key=lambda e: e["date"], reverse=True)
        score = round(rec["score"], 1)
        shards[h[:2]][h] = {
            "rank": rank_of(score),
            "score": score,
            "nextThreshold": next_threshold(score),
            "totalEvents": len(rec["events"]),
            "firstYear": int(dates[0][:4]) if dates else None,
            "lastYear": int(dates[-1][:4]) if dates else None,
            "topics": dict(rec["topics"]),
            "events": events_out,
            "badges": compute_badges(rec, registry_by_id),
        }

    # 被合併的 email 也要查得到：以 merged hash 寫入同一份紀錄
    for merged, primary in aliases.items():
        rec = shards.get(primary[:2], {}).get(primary)
        if rec:
            shards[merged[:2]][merged] = rec

    out_dir = os.path.join(BASE, "public/api/achievements")
    os.makedirs(out_dir, exist_ok=True)
    for old in os.listdir(out_dir):
        if old.endswith(".json"):
            os.remove(os.path.join(out_dir, old))
    for prefix, data in shards.items():
        with open(f"{out_dir}/{prefix}.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    # 位階分佈報告（Phase 0 校準用）
    dist = defaultdict(int)
    for data in shards.values():
        for rec in data.values():
            dist[rec["rank"]] += 1
    total = sum(dist.values())
    print(f"wrote {len(shards)} shards, {total} attendees")
    for key, _ in RANK_THRESHOLDS[::-1]:
        print(f"  {key:18} {dist.get(key, 0):5}")


if __name__ == "__main__":
    main()
