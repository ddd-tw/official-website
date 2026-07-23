---
# ============================================================
# 活動模板 — 複製本檔改名為 YYYY-MM-slug.md（底線開頭的檔案不會出現在網站上）
# 上架流程：開 branch → 填寫 → 開 PR → 社群 Review → merge 即上線
# ============================================================

# 活動標題（必填）
title: 活動標題
# 英文標題（選填，未填時英文頁顯示 title）
titleEn: "Event Title"

# 活動日期（必填，YYYY-MM-DD）
date: 2026-01-01

# 類型（必填）：meetup / conference / bookclub / workshop / tour
type: meetup

# 主題標籤（建議填）：strategy / collaboration / ddd-core / architecture
# 技術標籤：eventstorming / tdd / microservices / ai ...
# → 餵成就系統技能樹；也用於知識庫缺口分析
topics: [ddd-core]

# 報名方式（擇一）：
# external = 外部平台售票，把報名連結填在 link
# onsite   = 自營報名（活動頁出現報名表單；需 capacity）
registration: external
link: https://www.accupass.com/event/xxxx
# capacity: 60
# registrationDeadline: 2026-01-01

# 地點（實體活動填；線上活動可填「線上」）
location: 台北

# 講者（選填；對應 src/data/contributors.json 的 name，餵講者徽章）
# speakers: [Kim Kao]

# YouTube 直播（活動前排程後填入；活動頁會顯示「即將直播」）
# streamUrl: https://youtube.com/live/xxxx

# 回放（活動後補；活動頁會顯示回放連結）
# videoUrl: https://youtu.be/xxxx
---

一段活動介紹：這場活動要解決什麼問題、適合誰參加、會學到什麼。
