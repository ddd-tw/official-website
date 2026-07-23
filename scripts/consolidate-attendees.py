#!/usr/bin/env python3
"""彙整 dddtw-attendees 目錄下的所有報名名單。

來源：
  - KKTIX  : event-*.zip 內的 CSV（一場活動一檔）
  - Accupass: 參加名單_*.xlsx（取「票券資訊(已完成)」sheet）

原始檔完全不動。輸出到 consolidated/：
  - all-attendances.csv : 每筆有效報名一列，保留所有原始欄位（欄位取聯集），
                          去除重複匯出的檔案與完全重複的資料列
  - unique-attendees.csv: 以 email（小寫）去重，每人一列，彙總參加紀錄
  - events-summary.csv  : 每場活動一列的總表

執行：uv run --with openpyxl python3 consolidate.py
"""

import csv
import glob
import hashlib
import io
import os
import re
import zipfile
from collections import OrderedDict

import openpyxl

# 資料目錄（不進版控）；本腳本在 scripts/，資料在 repo 根的 dddtw-attendees/
BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dddtw-attendees")
OUT_DIR = os.path.join(BASE, "consolidated")
os.makedirs(OUT_DIR, exist_ok=True)

META_COLS = ["來源平台", "來源檔案", "活動代碼", "活動日期", "彙整姓名", "彙整Email"]

NAME_CANDIDATES = ["姓名", "參加人姓名", "聯絡人 姓名", "訂購人姓名"]
EMAIL_CANDIDATES = ["Email", "參加人Email", "聯絡人 Email", "訂購人Email"]


def pick(row, candidates):
    for c in candidates:
        v = (row.get(c) or "").strip()
        if v:
            return v
    return ""


def norm_email(v):
    v = (v or "").strip().lower()
    return v if "@" in v else ""


# ---------------------------------------------------------------- KKTIX zips
def load_kktix():
    rows = []
    seen_md5 = {}
    for zpath in sorted(glob.glob(os.path.join(BASE, "event-*.zip"))):
        zname = os.path.basename(zpath)
        with zipfile.ZipFile(zpath) as zf:
            member = zf.namelist()[0]
            data = zf.read(member)
        digest = hashlib.md5(data).hexdigest()
        if digest in seen_md5:
            print(f"  [skip 重複匯出] {zname} == {seen_md5[digest]}")
            continue
        seen_md5[digest] = zname

        # 活動代碼：去掉 -attendees-<timestamp>-<hash> 尾巴
        event = re.sub(r"-attendees-\d{8}-\d{6}-[0-9a-f]+$", "",
                       os.path.splitext(zname)[0])

        reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
        n = 0
        for r in reader:
            r = {k: (v or "").strip() for k, v in r.items() if k}
            out = OrderedDict()
            out["來源平台"] = "KKTIX"
            out["來源檔案"] = zname
            out["活動代碼"] = event
            out["活動日期"] = ""  # KKTIX 匯出檔沒有活動日期欄位
            out["彙整姓名"] = pick(r, NAME_CANDIDATES)
            out["彙整Email"] = norm_email(pick(r, EMAIL_CANDIDATES))
            out.update(r)
            rows.append(out)
            n += 1
        if n == 0:
            print(f"  [空檔案] {zname}（只有表頭，未納入）")
    return rows


# ------------------------------------------------------------ Accupass xlsx
def load_accupass():
    rows = []
    for xpath in sorted(glob.glob(os.path.join(BASE, "參加名單_*.xlsx"))):
        xname = os.path.basename(xpath)
        wb = openpyxl.load_workbook(xpath, read_only=True)
        ws = wb["票券資訊(已完成)"]
        data = [[("" if c is None else str(c).strip()) for c in row]
                for row in ws.iter_rows(values_only=True)]
        wb.close()
        if len(data) < 2:
            print(f"  [空檔案] {xname}（未納入）")
            continue
        header = [h for h in data[0] if h]
        # 活動日期：取「有效時間(GTM+8)」的起始日
        valid_idx = header.index("有效時間(GTM+8)") if "有效時間(GTM+8)" in header else None
        event_date = ""
        if valid_idx is not None:
            for r in data[1:]:
                m = re.match(r"(\d{4}-\d{2}-\d{2})", r[valid_idx] or "")
                if m:
                    event_date = m.group(1)
                    break
        event = f"accupass-{event_date or os.path.splitext(xname)[0]}"

        for r in data[1:]:
            rec = dict(zip(header, r))
            out = OrderedDict()
            out["來源平台"] = "Accupass"
            out["來源檔案"] = xname
            out["活動代碼"] = event
            out["活動日期"] = event_date
            out["彙整姓名"] = pick(rec, NAME_CANDIDATES)
            out["彙整Email"] = norm_email(pick(rec, EMAIL_CANDIDATES))
            out.update(rec)
            rows.append(out)
    return rows


def main():
    print("讀取 KKTIX zip...")
    kk = load_kktix()
    print(f"  KKTIX 有效資料列：{len(kk)}")
    print("讀取 Accupass xlsx...")
    ap = load_accupass()
    print(f"  Accupass 有效資料列：{len(ap)}")

    all_rows = kk + ap

    # 資料列層級去重（同來源檔以外的完全重複列）
    seen = set()
    deduped = []
    for r in all_rows:
        key = tuple(sorted((k, v) for k, v in r.items() if k != "來源檔案"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    if len(deduped) != len(all_rows):
        print(f"  移除完全重複資料列：{len(all_rows) - len(deduped)} 列")
    all_rows = deduped

    # 欄位聯集：meta 欄位在前，其餘依出現順序
    cols = list(META_COLS)
    for r in all_rows:
        for k in r:
            if k not in cols:
                cols.append(k)

    with open(os.path.join(OUT_DIR, "all-attendances.csv"), "w",
              newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, restval="")
        w.writeheader()
        w.writerows(all_rows)
    print(f"all-attendances.csv：{len(all_rows)} 列 × {len(cols)} 欄")

    # ------------------------------------------------ unique attendees
    people = OrderedDict()
    no_email = 0
    for r in all_rows:
        email = r["彙整Email"]
        if not email:
            no_email += 1
            continue
        p = people.setdefault(email, {
            "Email": email, "姓名": OrderedDict(), "暱稱": OrderedDict(),
            "公司": OrderedDict(), "職稱": OrderedDict(),
            "手機": OrderedDict(), "活動": OrderedDict(),
        })
        if r["彙整姓名"]:
            p["姓名"][r["彙整姓名"]] = None
        for src, dst in [("聯絡人 暱稱", "暱稱"), ("暱稱", "暱稱"),
                         ("公司/組織名稱", "公司"), ("聯絡人 公司/組織名稱", "公司"),
                         ("聯絡人 公司名稱", "公司"), ("公司名稱", "公司"),
                         ("職稱", "職稱"), ("聯絡人 職位", "職稱"),
                         ("聯絡人 職稱", "職稱"),
                         ("手機", "手機"), ("聯絡人 手機", "手機"),
                         ("參加人電話", "手機")]:
            v = (r.get(src) or "").strip()
            if v:
                p[dst][v] = None
        label = r["活動代碼"] + (f"({r['活動日期']})" if r["活動日期"] else "")
        p["活動"][label] = None

    out_people = []
    for email, p in people.items():
        out_people.append({
            "Email": email,
            "姓名": " / ".join(p["姓名"]),
            "暱稱": " / ".join(p["暱稱"]),
            "公司": " / ".join(p["公司"]),
            "職稱": " / ".join(p["職稱"]),
            "手機": " / ".join(p["手機"]),
            "參加次數": len(p["活動"]),
            "參加活動": "; ".join(p["活動"]),
        })
    out_people.sort(key=lambda x: -x["參加次數"])

    with open(os.path.join(OUT_DIR, "unique-attendees.csv"), "w",
              newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["Email", "姓名", "暱稱", "公司", "職稱",
                                          "手機", "參加次數", "參加活動"])
        w.writeheader()
        w.writerows(out_people)
    print(f"unique-attendees.csv：{len(out_people)} 人"
          + (f"（{no_email} 列無 email 未計入）" if no_email else ""))

    # ------------------------------------------------ events summary
    events = OrderedDict()
    for r in all_rows:
        e = events.setdefault(r["活動代碼"], {
            "活動代碼": r["活動代碼"], "來源平台": r["來源平台"],
            "活動日期": r["活動日期"], "來源檔案": r["來源檔案"], "報名數": 0,
        })
        e["報名數"] += 1
    ev = sorted(events.values(), key=lambda x: (x["來源平台"], x["活動日期"], x["活動代碼"]))
    with open(os.path.join(OUT_DIR, "events-summary.csv"), "w",
              newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["活動代碼", "來源平台", "活動日期", "來源檔案", "報名數"])
        w.writeheader()
        w.writerows(ev)
    print(f"events-summary.csv：{len(ev)} 場活動")


if __name__ == "__main__":
    main()
