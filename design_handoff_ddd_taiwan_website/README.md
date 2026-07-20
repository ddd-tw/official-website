# Handoff: DDD Taiwan 官方網站

## Overview
DDD Taiwan（Domain-Driven Design Taiwan）社群官方網站。單頁應用（hash 路由）含五個頁面：首頁、參與活動、知識庫、社群、治理。支援中英雙語切換、RWD（漢堡選單）、深淺色主題（依當地時間自動日夜切換 + 手動覆寫）。品牌 Logo 為全新設計（「交集即是 D」— 兩個 Bounded Context 交疊，D 誕生於交集）。

## About the Design Files
本包內的檔案是 **HTML 設計參考稿（prototype）**，展示預期的外觀與行為，**不是可直接上線的production code**。任務是在目標 codebase 的既有環境（React / Vue / Next.js / Astro 等）中**重新實作**這些設計，沿用該環境的既有慣例與套件；若尚無環境，建議選 Next.js（社群已用它做 2025 年會官網，部署於 GitHub Pages，見 github.com/ddd-tw/2025Summit）。

`DDD Taiwan 官網 v2.dc.html` 使用了設計工具專有的模板語法（`{{ }}` holes、`sc-if`、`<helmet>`），閱讀時把它當作「帶狀態註記的 HTML」即可；所有樣式為 inline style + 少量 helmet CSS（RWD media query、主題變數、語言切換規則）。

## Fidelity
**High-fidelity（hifi）**：色彩、字體、間距、互動皆為定稿，請按值實作。文案中標示「待公告 / TBA」的欄位是刻意的資料佔位（結構已定、內容待社群提供）。

## Screens / Views

### 共用外框
- **Nav（sticky top）**：高約 64px，`--nav-bg`（半透明 + backdrop-blur 10px），底線 1px `--line`。左：Logo（34px）+「DDD TAIWAN」（Space Grotesk 600, 15px, letter-spacing 0.2em）。右：五個頁面連結（Space Grotesk 500, 12px, uppercase, letter-spacing 0.13em；current 頁 `--ink`、其餘 `--nav-off`）、語言切換鈕（外框 `--brand-40`、字 `--brand-strong`）、主題切換鈕（◐/☾/☀ 循環 auto→dark→light）。
- **RWD ≤760px**：nav 連結列隱藏，右側顯示 40×40 漢堡鈕（☰/✕），開啟時在 nav 下方顯示全寬下拉選單（每項 padding 14px 24px，底線 `--line-soft`，內含語言/主題切換）。選單於路由變更時自動關閉。
- **Footer**：`--footer-bg`，上緣 1px `--line`；左 Logo 24px + 名稱，右側連結（隱私、CoC、GitHub、YouTube、© 2026 DDD Taiwan，13px `--ink-faint`，hover `--accent`）。

### 1. 首頁（#home）
- **Hero**（置中，max-width 1080，padding 92/40/72）：Logo 104px → eyebrow「DOMAIN-DRIVEN DESIGN · TAIWAN」（12px, letter-spacing 0.24em, `--ink-faint`）→ H1 48px/1.28 Space Grotesk 700（重點詞「問題領域」底線 4px `--accent`）→ 導言 17px/1.75 `--ink-mid`（max-width 620）→ 兩顆 CTA：實心（`--brand-solid` 底、#FBF8F1 字、hover `--brand-solid-hi` + translateY(-1px)）與 ghost（外框 `--brand-45`，hover 底 `--chip-bg`）。
- **三入口卡**（grid 3 欄 gap 20；≤760 1 欄）：白/`--panel` 卡、1px `--line`、radius 10、hover 邊框轉 `--brand-strong` + 上浮 2px + shadow `--card-glow`。結構：eyebrow（11px uppercase `--accent`）→ 標題 23px 700 → 說明 14.5px `--ink-mid` → 導引列（13px `--brand-strong`）。
- **Conference 橫幅**：深底 `--banner-bg` radius 10；eyebrow #E06A4F、標題 24px #FBF8F1、說明 #B9C2D4；右側 ghost 白框按鈕連 conference.ddd-tw.com。≤760 直排。

### 2. 參與活動（#events）
- 頁首 eyebrow + H1 40px（重點詞加 `--accent` 底線）。
- **Meetup 面板**：標題 + 狀態 chip（`--chip-bg` 底、`--brand-30` 框、`--accent` 圓點、「下一場籌備中」）；說明文；「日期/場地/議程預告」三格 TBA tile（`--tile` 底、`--line-soft` 框）；KKTIX 與 Meetup.com ghost 鈕；**歷屆場次列表**（每列 mono 日期 72px + 標題 15px，上邊線 `--line-soft`，hover `--row-hover`，皆外連 KKTIX）：
  - 2023.11 Pragmatic TDD 導讀會
  - 2021.08 他/她們的足跡 — 認識年會海外講者
  - 2021.05 初探 Domain Storytelling
  - 2020.06 6月線上聚會 — DDD 即將起飛，一起來打群架吧！（kktix …/aeec5df0）
  - 2019.08 6th Meetup — 業餘學生團隊實踐 DDD 的過程分享（…/dddtaiwan6thmeetup）
  - 2019.05 4th Meetup — 領域驅動設計 · LinkedIn 微服務開發遊歷（…/dddtaiwan4thmeetup）
  - 2019.04 3rd Meetup — AWS 專業服務團隊的 DDD 與微服務實踐（天瓏書局）（…/dddtaiwan3rdmeetup）
- **Conference 卡**：說明（含 Event Storming / Domain Storytelling 工作坊）＋歷屆列表（2025 第五屆 AI 時代軟體開發方法 11/8；2021 足跡 Footprints — Kenny Baas-Schwegler、Carola Lilienthal、Adam Dymitruk）＋贊助信箱 conference@ddd-tw.com。
- **Book Club 卡**：說明＋「目前書目：待公告／進度：—／上一本：Pragmatic TDD」資訊格＋「加入方式」鈕連社群頁。

### 3. 知識庫（#knowledge）
- **Books**：2×2 書卡（44×62 書封色塊 + 書名 16px 700 + 作者年份 13px `--ink-faint` + 一句摘要）：Evans《DDD》2003、Vernon《IDDD》2013、Khononov《Learning DDD》2021、Wlaschin《Domain Modeling Made Functional》2018。含心得投稿徵集句。
- **Papers**：上架流程 4 步卡（mono 編號 `--accent`）：Agent 蒐集 → 作者授權 → 社群 Review → 正式發布。
- **Video**：分類 chips（Meetup 回放／年會演講／推薦影片）＋ YouTube 鈕。
- **GitHub**：repo 列（mono 13px）：ddd-tw/2025Summit（社群專案）、ddd-crew/ddd-starter-modelling-process、ddd-crew/context-mapping（外部推薦）＋範例程式碼徵集句＋ github.com/ddd-tw 鈕。

### 4. 社群（#community）
導言（成立於 2018、與 Agile Taipei / Agile Hsinchu 合辦活動）＋六張平台卡（grid 3 欄）：FB 社團（facebook.com/groups/dddtaiwan）、FB 粉專（facebook.com/DDDCommunity.tw）、Line 社群（入群連結於活動頁公告）、YouTube、KKTIX（dddtaiwan.kktix.cc）、Email（dddtw2018@gmail.com）。

### 5. 治理（#governance，max-width 880）
- **隱私權政策**：蒐集與使用／保護與法遵（個資法 + GDPR 精神、KKTIX 代處理）／你的權利（來信查詢更正刪除）。
- **行為準則**：期望行為／不容忍行為（含「講者不得於分享中攻擊他人或其他社群」）／違規處理／申訴管道（現場志工或 email，保密）。
- **網站自動化**（可用 flag 隱藏）：01 Meetup 同步公開行事曆、02 分散式活動上架、03 錄影通知信自動寄送、04 錄影自動上傳 YouTube。

## Interactions & Behavior
- **路由**：`location.hash`（#home/#events/#knowledge/#community/#governance），變更時捲回頂部並關閉行動選單。未知 hash fallback #home。
- **雙語**：所有文案成對存在（zh/en）。原型用 `.lang-en` class + `[data-l]` display 切換；正式實作建議 i18n 方案（next-intl / vue-i18n），預設 zh-TW。
- **主題**：三態 auto/dark/light。auto = 當地時間 18:00–06:00 深色；每 5 分鐘重新判斷。手動循環切換鈕 ◐→☾→☀。深淺色只換 CSS 變數（見 Design Tokens）。建議把使用者選擇存 localStorage（原型未做）。
- **動效**：頁面進場 `swell-in`（opacity+translateY(12px)→0, 700ms ease-out）；卡片 hover 上浮 1–2px + 邊框變亮，180ms cubic-bezier(0.4,0,0.2,1)；全部包在 `prefers-reduced-motion: reduce` 時停用。
- **行動選單**：sticky 於 nav 下，展開動畫 220ms swell-in。

## State Management
- `page`（hash 路由）、`lang`（'zh'|'en'）、`themeMode`（'auto'|'dark'|'light'）、`menuOpen`（bool）。
- 無後端；未來活動/書目/影片資料建議由 JSON/CMS 供給（欄位見各列表結構）。

## Design Tokens
字體：**Space Grotesk**（標題/標籤/英文，400–700）＋ **Noto Sans TC**（中文內文，300–700）＋ **JetBrains Mono**（日期、代碼、信箱）。皆 Google Fonts。

淺色（.theme-light）：
- --bg-grad: linear-gradient(180deg,#FBF8F1 0%,#F6F2E9 55%,#EFE9DB 100%)
- --nav-bg: rgba(251,248,241,0.85)；--panel:#FFFFFF；--tile:#FBF8F1；--row-hover:#F6F2E9
- --ink:#1B2233；--ink-mid:#444B58；--ink-faint:#8A8272；--nav-off:#6E7688
- --line:#E0DACB；--line-soft:#EDE9DE
- --brand-strong:#24417E；--brand-solid:#24417E；--brand-solid-hi:#2B52A0
- --brand-45/40/30: rgba(36,65,126,.45/.4/.3)；--card-glow:rgba(36,65,126,.12)；--cta-shadow:rgba(36,65,126,.25)
- --chip-bg:#DCE4F0；--accent:#C34A33；--banner-bg:#1B2233；--footer-bg:#F1ECDF；--logo-d:#F6F2E9

深色（.theme-dark）：
- --bg-grad: linear-gradient(180deg,#0C111A 0%,#10151F 55%,#141B28 100%)
- --nav-bg: rgba(12,17,26,0.85)；--panel:#1A2230；--tile:#141B28；--row-hover:rgba(255,255,255,0.05)
- --ink:#E8E4D8；--ink-mid:#B7B3A6；--ink-faint:#8B8778；--nav-off:#8B8FA0
- --line:#2A3346；--line-soft:#232B3C
- --brand-strong:#8FAEE4；--brand-solid:#2B52A0；--brand-solid-hi:#3E6AC0
- --brand-45/40/30: rgba(143,174,228,.45/.4/.3)；--card-glow:rgba(0,0,0,.4)；--cta-shadow:rgba(0,0,0,.35)
- --chip-bg:#223050；--accent:#E06A4F；--banner-bg:#223050；--footer-bg:#0C111A；--logo-d:#10151F

間距節奏：頁面容器 max-width 1080（治理 880）、水平 padding 40（行動 22）；面板 padding 32/36（行動 22/18）；卡 radius 10、小元件 radius 4–8。
陰影：卡片 0 1px 3px rgba(27,34,51,0.06)；hover 0 8px 24px var(--card-glow)。

## Assets（logo-assets/）
- `ddd-taiwan-logo.svg` / `-on-dark.svg` — 標誌向量原始檔（Logo 顏色實作時請改用 currentColor + --logo-d 以支援主題）
- `ddd-taiwan-logo-1024.png`、`-on-dark-1024.png`、`-256.png`（透明底）、`-white-1024.jpg`、`-dark-1024.jpg`
- `ddd-taiwan-lockup-*.png/.jpg/.svg` — 標誌＋字標橫式組合（深淺版）
- `sg600-subset.woff2` — Space Grotesk 600 子集（僅供 lockup SVG/export 用；正式站直接載 Google Fonts）
- Logo 語意：兩圓 = 兩個 Bounded Context（業務×技術），交集中的 D = Ubiquitous Language 誕生之處。

## Files
- `DDD Taiwan 官網 v2.dc.html` — 主設計稿（五頁、雙語、RWD、雙主題）
- `ddd-taiwan-offline.html` — 單一離線版設計稿（雙擊即可在瀏覽器開啟預覽，免任何伺服器）
- `Logo 提案.dc.html` — Logo 三輪提案與配色系統脈絡（決策紀錄）
- `sitemap.md` — 原始資訊架構（來源需求文件）
- `DATA.md` — 所有已查證的真實資料彙整（連結、歷屆活動、年會、講者）
- `logo-assets/` — 品牌資產（SVG/PNG/JPG，含深淺色與字標 lockup 全部版本）
- `screenshots/` — 各頁截圖（01 首頁、02 活動、03 知識庫、04 社群、05 治理、06 首頁另一主題）

## 已知資料缺口（待業主補充）
下一場 Meetup 的日期/場地/議程、Line 入群連結、YouTube 頻道確切網址（原型暫用 @dddtaiwan）、讀書會目前書目與進度、Papers 實際文章清單、公開行事曆連結、IG/Twitter 是否啟用。
