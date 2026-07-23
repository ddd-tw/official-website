# CLAUDE.md — 專案交接與工作脈絡

> 最後更新：2026-07-23。這份文件讓新 session（任何電腦）能接續工作。
> ⚠️ 本 repo 是 **PUBLIC**——任何含個資、談判底牌的內容都不可進版控（見「不在 repo 裡的東西」）。

## 專案是什麼

DDD Taiwan 社群官網（ddd-tw.com）：Astro 5 靜態站，GitHub Pages 部署，zh 預設 + `/en/`。
內容全部是 repo 內的 md/json，merge 到 `main` 即自動上線。開發：`npm install && npm run dev`。

在官網之上，2026-07 起建置**會員成就系統與自營活動平台**，完整設計見
`docs/member-system-design.md`（v0.2，含路線圖與勾選進度）——看這份就懂全貌，本文件只補「文件裡沒有的操作脈絡」。

## 系統元件速覽

| 元件 | 位置 | 狀態 |
|---|---|---|
| 成就頁 `/me`（查詢/位階/徽章/成就卡） | `src/components/MemberPage.astro`, `RankBadge.astro` | ✅ 完成，待發佈驗收 |
| 成就資料（255 個雜湊分片） | `public/api/achievements/*.json` | ✅ 已產出（1,582 人） |
| 活動對照表（成就計算基準） | `src/data/event-registry.json` | ⚠️ 25 筆 `"todo": true` 待 Kim 核對名稱 |
| 補登/合併 | `src/data/manual-participations.json`（已有 Kim 的創辦人補登）、`email-aliases.json`（尚未建） | ✅ build 已支援 |
| 成就 build + 測試 | `scripts/build-achievements.py`, `test-achievements.py`, `update-achievements.sh`, `consolidate-attendees.py` | ✅ 測試 11/11 綠 |
| 活動模板 + schema | `src/content/events/_template.md`, `src/content.config.ts` | ✅ 30 個舊活動已補 topics |
| 活動公告自動化 | `.github/workflows/announce-event.yml` | ✅ 需設 Secret `DISCORD_WEBHOOK_URL` 才生效 |
| 自營報名系統（Phase 3a） | `infra/registration/`（Lambda+DynamoDB+SES，CDK）＋ `src/pages/register/[id].astro`, `src/pages/staff/checkin.astro` | ⚙️ scaffold 完成，**尚未部署到 AWS** |

## 關鍵機制（改東西前必讀）

- **成就查詢**：前端 `SHA-256(email + SALT)` → 抓 `public/api/achievements/{前2碼}.json`。
  **SALT = `dddtw-achievements-v1`**，寫死在 `MemberPage.astro` 與 `build-achievements.py`，兩邊必須一致。
- **成就更新 SOP**：名單（zip/xlsx）丟 `dddtw-attendees/` → `./scripts/update-achievements.sh` → commit push。
  新活動要先登記進 `event-registry.json`，否則腳本會擋下（防呆）。
- **位階門檻**（build 腳本內）：VO 0 / Entity 3 / AR 8 / BC 15 / DE 25 加權分（meetup 1、workshop 1.5、年會 2）。
  目前分佈：1263/244/62/11/2。已知議題：BC 11 人偏少（考慮 15→12）；AR/BC/DE 的附加條件
  （含年會、跨類型、跨年度）**前端有顯示但 build 判定只看分數**，待補嚴。
- **報名頁生成**：活動 md 標 `registration: onsite` → build 自動生成 `/register/{id}/`。
  API base 由 `PUBLIC_REGISTRATION_API` 環境變數控制，預設 `https://register.ddd-tw.com`（尚未存在）。

## ⚠️ 不在 repo 裡的東西（換電腦注意）

1. **`dddtw-attendees/`（原始名單，含明文個資）**——只存在 Kim 的原電腦，`.gitignore` 擋住。
   **沒有這個目錄就無法重跑成就 build**（已產出的分片 JSON 在 repo 裡，查詢功能不受影響）。
   待辦：把它備份到社群私有儲存（私有 repo 或雲端硬碟），這也是設計文件 R6 單點風險的解法。
   其中 `consolidated/community-analysis-report.md`（社群資料分析報告）也在此目錄，需一併轉移。
2. **`docs-internal/oen-negotiation-brief.md`（OEN 金流談判文件，含內部底牌）**——因 repo 是 public
   而移出版控。要在新電腦使用需另行傳輸。
3. **STAFF_KEY**（報名系統驗票金鑰）——部署時生成，不進 repo。

## 下一步（依優先序）

1. **發佈成就系統**：本地驗收 `/me`（深淺色、en、手機、成就卡下載）→ commit 已完成，push 即上線。
2. **Kim 核對 `event-registry.json`** 的 25 筆 todo 名稱 → 重跑 `update-achievements.sh`。
3. **AWS 部署報名系統**：照 `infra/registration/README.md`（cdk bootstrap → `-c skipDns=true` 測通 →
   SES production access → 綁 register.ddd-tw.com）。需 AWS 權限，遵守最小權限原則。
4. **挑一場免費活動當 Phase 3a 試點**（報名→QR→出席→成就全鏈路）。
5. Phase 3a 收尾清單見 `infra/registration/README.md` 底部（export loader、防機器人、magic link…）。

## 慣例

- 位階/徽章規則變更走 PR；**ratchet 原則：規則升級不追溯降級任何人**。
- 個資紅線：公開部署物只能有 emailHash，明文 email/姓名/手機永不出現在 repo 與 build 產物。
- 新增內容照 README「如何發布內容」；活動用 `_template.md`。
- commit 訊息與現有 git log 風格一致（英文祈使句，一行講清楚）。
