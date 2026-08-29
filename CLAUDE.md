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
| Discord 伺服器設定（身分組/頻道/AutoMod/Onboarding） | `scripts/discord-setup.py` | ✅ 已套用到正式伺服器，指令皆冪等 |
| 活動公告自動化 | `.github/workflows/announce-event.yml`, `scripts/announce-event.py` | ✅ Secret `DISCORD_WEBHOOK_URL` 已設，端到端驗證過 |
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
4. **Discord bot token**——存在 `~/.dddtw-discord-token`（權限 600），不進 repo。
   `scripts/discord-setup.py` 靠它操作伺服器；bot 平時不必留在伺服器裡，要改設定時
   用 Administrator 邀請連結重新邀入、跑完踢掉即可（身分組與頻道都會保留）。

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
- 分享縮圖：`python3 scripts/build-og-image.py` 產生每頁一張（`public/og/`＋全站預設
  `og-image.png`/`og-image-en.png`）與對照表 `src/data/og-images.json`，Base.astro 依路徑取用。
  **尺寸固定 1200×630**，比例一改 FB 就會裁圖。新增文章後要重跑（沒跑只是那頁退回預設圖）；
  主要頁面的卡片文案寫在腳本的 `CORE_PAGES`。FB 有快取，上線後要去 Sharing Debugger 重抓。
- **Discord 伺服器**（`discord.gg/xgNmswC4u5`）：結構由 `scripts/discord-setup.py` 管，
  五個指令 `audit` / `apply` / `channels` / `safety` / `onboarding` 都有唯讀計畫模式，改設定
  一律改程式碼再重跑，不要只在 UI 點——UI 點過的東西下次跑腳本不會知道。踩過的坑：
  - 身分組分兩類：**權限角色**（核心團隊/版主/活動小組/講者）與**零權限的身分徽章**
    （位階 VO→DE、興趣角色）。刻意不發 `ADMINISTRATOR`：它繞過頻道 overwrite，也讓稽核
    記錄無法歸因。位階徽章目前**手動發**——`/me` 用 `SHA-256(email+SALT)`，與 Discord ID
    沒有連結，要自動同步得做 bot + 一次性 claim code。
  - `@everyone` 只做**減法**（`EVERYONE_DENY`），不要整片覆寫成 baseline——那會順手關掉貼圖、
    投票、音效板這些沒有安全意義的功能。實際只關了 `CREATE_PRIVATE_THREADS`。
  - **AutoMod 不因為你是擁有者就放過你**（Discord 少見的例外，`ADMINISTRATOR` 也繞不過），
    豁免是身分組制，所以主辦必須掛 `核心團隊`/`版主`/`活動小組` 之一，否則自己發公告會被
    自己的規則擋下。
  - 私有頻道（`@everyone` deny `VIEW_CHANNEL`）要順手把 bot 的身分組加進 overwrite，
    否則 bot 建完就 `Missing Access` 改不動自己的產物。
  - `public_updates_channel_id`（社群更新頻道）`PATCH /guilds` 會回 **200 但靜默忽略**，
    只能在 UI 改；被指定的頻道無法刪除。目前沿用 Discord 原生的 `#moderator-only`。
  - Onboarding 選項的 emoji 要用扁平的 `emoji_name`，傳 `{"name": ...}` 物件會被靜默丟掉。
  - 一次性活動**不開常設頻道**（用 `#events-chat` 的討論串），冷門議題用 `#ask-anything`
    這個 Forum 吸收，持續熱起來才升格 —— 避免 Virtual DDD 那種死頻道沉積。
  - **活動公告**：活動 md merge 進 `main` 即由 `announce-event.yml` 發到 `#announcements`，
    只在檔案**新增**時發（`--diff-filter=A`），所以事後補 `videoUrl`、修錯字都不會重發。
    提及 `活動通知` 身分組而非 `@everyone`，`allowed_mentions` 白名單只放那個角色 id。
    整支 workflow 是 best-effort（`continue-on-error`，Secret 不存在就跳過），失敗不擋上架。
    要手動補發：Actions → Announce event → Run workflow，填活動 md 路徑。
  - 用 Python 打 Discord API/webhook 一定要帶 `User-Agent`，否則被 Cloudflare 以
    `error code: 1010` 擋掉（urllib 的預設 UA 在封鎖名單上）。
- commit 訊息與現有 git log 風格一致（英文祈使句，一行講清楚）。
