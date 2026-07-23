# DDD Taiwan 會員成就系統與活動平台 — 設計文件

> 版本：v0.2（2026-07-23）草稿，供社群核心團隊 Review
> 作者：Kim Kao ＋ Claude
> 狀態：Proposal — 尚未定案，開放討論
> v0.2 變更：自營報名確定為方向（Kim 拍板），Phase 3 拆為 3a（報名，不含金流）與 3b（金流）；
> Phase 0/1 多數項目已實作完成並更新勾選狀態。

---

## 1. 背景與動機

DDD Taiwan 自 2019 年起累積了 76 場以上活動、3,003 筆報名、1,582 位不重複參加者
（資料整理見 `dddtw-attendees/consolidated/`）。既有資料分析
（`dddtw-attendees/consolidated/community-analysis-report.md`）顯示：

- **73% 參加者只來過 1 場**，「第 2 場轉換」是最大流失點。
- **≥5 場的鐵粉有 110 人**，但社群從未正式認可過他們的長期投入。
- 年會是新面孔的主要入口（2022 停辦年會，全年新面孔僅 39 人 vs. 2023 年 269 人）。
- 名單散落在 KKTIX / Accupass 兩個外部平台，社群不擁有自己的會員資料。

本設計要解的問題，依優先序：

1. **認可長期參與者**：成就 / 位階系統，讓參與者看得到自己的累積。
2. **拿回資料主權**：報名與出席資料落在社群自己的儲存，不再受制於售票平台匯出。
3. **降低活動籌辦摩擦**：讓貢獻者用「開 PR」就能上架活動，宣傳與回放盡量自動化。
4. **自營報名與活動平台**（2026-07-23 確定為方向）：未來活動的上架與報名都在本平台完成，
   報名/出席資料天生落在自家儲存；金流在付費場需求明確後接上（§9）。

## 2. Goals / Non-Goals

### Goals

- G1. 參加者輸入 email（並驗證所有權）後，能看到：目前位階、參與過的活動時間軸、主題技能樹、徽章牆。
- G2. 每場活動結束後，核心團隊以低成本（上傳一個名單檔）更新所有人的成就。
- G3. 活動上架維持現有「markdown + PR」模式，擴充欄位支援報名資訊、主題標籤、直播/回放連結。
- G4. 活動 merge 後自動產生宣傳素材與社群媒體露出。
- G5. 架構每一步皆可回退，無固定成本賭注（詳見 §9 金流決策）。

### Non-Goals（本期不做）

- 不自建帳號密碼系統（無 password，走 email 驗證）。
- 不第一天就自建金流（§9：交易量不足以攤平固定月費；報名先行、金流後接）。
- 不做排行榜公開頁（避免比較文化與個資疑慮；成就只給本人看，公開與否由本人決定）。

## 3. 名詞定義（Ubiquitous Language）

| 術語 | 定義 |
|---|---|
| **Attendee（參加者）** | 以 email 識別的自然人。同一 email = 同一人（已知限制：一人多 email 會被視為多人）。 |
| **Participation（參與紀錄）** | 一位 Attendee 在一場 Event 的報名（未來為出席）事實。成就計算的最小事實單位。 |
| **Event（活動）** | 一場社群活動，以 `eventId` 識別，對應 `src/content/events/*.md`。 |
| **Topic（主題）** | 活動的知識主題標籤（如 `eventstorming`、`tdd`），對應知識庫分類。 |
| **Rank（位階）** | 由 Participation 累積推導出的資歷等級，全社群統一規則。 |
| **Badge（徽章）** | 特定成就的認可，分主題 / 資歷 / 里程碑三類。 |
| **Registration vs. Attendance** | 報名 ≠ 出席。歷史資料只有報名；未來以 QR 驗票取得出席。第一版以報名計，並誠實標示。 |

## 4. 現況盤點

### 4.1 網站

- Astro 5 靜態站，GitHub Pages（`ddd-tw.com`），zh 預設 + `/en/`。
- 內容集合：`events`（30 場 md）、`posts`、`books`（15）、`videos`（21）、`contributors`。
- Schema 驗證在 `src/content.config.ts`（zod），CI 擋壞資料。
- 無任何後端、無登入、無資料庫。

### 4.2 資料資產

- `dddtw-attendees/`：KKTIX 53 zip + Accupass 31 xlsx（raw，不可變動）。
- `dddtw-attendees/consolidate.py`：彙整腳本（可重跑）。
- `consolidated/all-attendances.csv`：3,003 筆報名 × 85 欄。
- `consolidated/unique-attendees.csv`：1,582 人（email 去重、參加次數、活動清單）。
- `consolidated/events-summary.csv`：76 場活動總表。

### 4.3 已知資料缺口

| 缺口 | 影響 | 對策 |
|---|---|---|
| 2019 年 12 場活動無名單 | 早期元老吃虧 | 人工補登機制（§7.4） |
| KKTIX 匯出無活動日期 | 時間軸不準 | event mapping 檔補日期（§5.1） |
| Accupass 檔名無活動名稱 | 對不回活動 | 同上，以日期對回官網 events |
| Attendance Book 全空 | 只有報名、無出席 | 第一版以報名計，UI 標示「報名紀錄」 |
| 一人多 email | 成就分裂 | 提供「合併申請」管道（§7.4） |

## 5. 資料模型設計

### 5.1 Event Mapping（單一事實來源：repo 內檔案）

新增 `src/data/event-registry.json`——把 76 個歷史活動代碼對回正式活動，並為每場標注主題。
這是**人工維護的對照表**，也是成就計算的基準：

```jsonc
[
  {
    "eventId": "2020-11-conference",           // 對應 src/content/events/ 檔名
    "sources": ["event-dddtw-conf-2020", "event-dddtw-conf-2020-tech-track-additional"],
    "date": "2020-11-27",
    "type": "conference",
    "topics": ["ddd-core", "strategy"],
    "weight": 2                                  // 年會權重較高（§6.1）
  },
  {
    "eventId": "2020-iddd-studygroup",
    "sources": ["event-iddd-studygroup-3rd", "event-iddd-studygroup-4th", "..."],
    "seriesOf": 9,                               // 系列場次數（全勤徽章用）
    "type": "bookclub",
    "topics": ["ddd-core"]
  }
  // ... 76 個來源代碼 → 約 45 個正式活動
]
```

設計決策：

- **mapping 放 repo、進版控**：修正歷史對照 = 開 PR，有審核紀錄，任何人可勘誤。
- `topics` 詞彙表沿用知識庫四分類（`strategy` / `collaboration` / `ddd-core` / `architecture`）
  再加技術標籤（`eventstorming`、`tdd`、`microservices`、`ai`…），首版先粗後細。
- 多個 source（如年會+加開場）合併為一場，避免灌次數。

### 5.2 Participation 資料（生成產物，不進版控）

由 `consolidate.py` 延伸的 build 腳本產生：

```
participation = { emailHash, eventId, date, ticketType, source }
```

- **emailHash = SHA-256(email 小寫 + 全站固定 salt)**。公開部署物中不出現明文
  email、姓名、手機——只有 hash 與活動紀錄。
- raw CSV（含個資）**永不進 git**（`dddtw-attendees/` 加入 `.gitignore`，
  現況已在 repo 的要先移出歷史——見 §11 風險 R1）。

### 5.3 成就檔（部署產物）

build 時計算每人成就，輸出靜態 JSON 分片：

```
dist/api/achievements/{emailHash 前 2 碼}.json
  → { "<emailHash>": { rank, totalEvents, firstYear, events: [eventId...],
                        topics: {...}, badges: [...] } }
```

分片（256 檔）讓單檔夠小，且無法用一個檔案枚舉全部會員。

## 6. 成就規則（Achievement Rules）

### 6.1 位階（Rank）— 以 DDD 建構塊命名

以「加權參與次數」計算：meetup/讀書會 1 分、工作坊 1.5 分、年會 2 分。

| 位階 | 條件 | 依現有資料的人數分佈（試算前預估） |
|---|---|---|
| **Value Object** | ≥1 分 | ~1,160 人 |
| **Entity** | ≥3 分 | ~300 人 |
| **Aggregate Root** | ≥8 分，含至少 1 次年會 | ~110 人 |
| **Bounded Context** | ≥15 分，跨 ≥2 種活動類型 | ~40 人 |
| **Domain Expert** | ≥25 分，參與跨度 ≥3 個年度 | ~10 人 |

> 門檻為草案。實作第一步就是用真實資料試跑分佈，調整到「每一階都有值得努力的距離、
> 最高階稀有但可達」。試跑腳本輸出分佈直方圖供核心團隊拍板。

### 6.2 徽章（Badges）

**主題徽章**（學了什麼）：
- 每個 topic 累積 1 / 3 / 5 場 → 銅/銀/金（如「EventStorming 金章」）。
- 系列全勤章：`seriesOf` 場次全參加（如「IDDD 精讀者」＝ IDDD 讀書會 9 場全到）。

**資歷徽章**（何時在場）：
- 創始見證者：參加過 2020 首屆年會。
- 元老：首次參與在 2021 以前。
- 年會常客：連續 ≥3 屆年會。

**里程碑徽章**：首次參加、5 / 10 / 20 場、「全域旅人」（meetup + conference + bookclub 三棲）、
「巡迴者」（參加過 Tour 外縣市場）。

**貢獻徽章（人工授予）**：講者、志工、工作人員——來自 `event-registry.json` 的
`speakers` / `staff` 欄位（人工填寫），權重與榮譽高於參加。

### 6.3 規則引擎原則

- 規則 = 純函式 `(participations, registry) → achievements`，放 `scripts/achievements/`，
  單元測試覆蓋，規則變更 = PR。
- 規則版本化：升級規則不追溯降級任何人（ratchet 原則——只往上，不往下）。

## 7. 系統架構

### 7.1 總覽

```
                    ┌─ 現在（Phase 1-2）────────────────────────────┐
KKTIX/Accupass 匯出 → dddtw-attendees/（本機、不進 git）
                        │ consolidate.py + build-achievements.py
                        ▼
src/data/event-registry.json ──→ Astro build ──→ 靜態站 + /api/achievements/*.json
                                                    ▲
會員頁 /me：輸入 email → 前端 SHA-256 → fetch 分片 → 渲染成就
                    └───────────────────────────────────────────────┘

                    ┌─ 之後（Phase 3，確定方向）─────────────────────┐
Phase 3a 自營報名：活動頁報名表單 → Lambda + DynamoDB（報名/名額）+ SES（QR 票券信）
                   → 活動日掃 QR = 出席事實 → build 改由匯出 CSV 餵成就
                   （AWS 而非 Cloudflare：網域在 Route53、WorkMail 已驗證寄信網域、
                     社群多 AWS 熟手。IaC 見 infra/registration/，CDK）
Phase 3b 金流：    報名流程中插入「建訂單 → 金流商託管付款頁 → 確認入帳」
                   （見 §9.3；OEN 或綠界，依談判結果，可互換）
                    └───────────────────────────────────────────────┘
```

Phase 3a/3b 拆開的理由：報名不需要金流就能先上線（免費場先行實戰），
資料主權與真實出席紀錄先到手；金流談判（`docs/oen-negotiation-brief.md`）不阻塞報名系統。

### 7.2 Phase 1-2 的「登入」：email 查詢 + 雜湊索引

- `/me` 頁：使用者輸入 email → 前端計算 `SHA-256(email+salt)` → 抓對應分片 JSON → 顯示成就。
- **不是認證**，是查詢。可接受的原因：(a) 內容僅活動參與紀錄，不含聯絡資料；
  (b) 猜中他人 email 只能看到「他參加過哪些公開活動」，風險低且可公開評估。
- 頁面明確標示資料截止日與「報名紀錄，非出席證明」。

### 7.3 Phase 3 的登入升級：Magic Link（需要時才做）

- Lambda + SES 寄一次性連結，驗證 email 所有權（與票券信共用寄信基礎設施）。
- 觸發時機：當成就要衍生**權益**（早鳥資格、折扣、投票權）時，查詢式的安全等級就不夠。

### 7.4 例外流程（人工通道）

- **補登**：Google Form → 核心團隊審核 → 寫入 `manual-participations.json`（進 repo，
  只含 emailHash，不含明文）→ 下次 build 生效。
- **Email 合併**：本人提出 → 核心團隊確認兩個 email 都屬本人 → `email-aliases.json`
  記錄 hash 映射。
- **除名/刪除（GDPR-like）**：本人要求即從產物中移除；raw data 由資料管理者另行處理。

## 8. 活動生命週期（Event Lifecycle）

### 8.1 Schema 擴充（`src/content.config.ts` 的 events）

```ts
// 新增欄位（皆 optional，不破壞既有 30 個檔案）
topics: z.array(z.string()).default([]),        // 餵成就系統 + 知識庫缺口追蹤
registrationUrl: z.string().url().optional(),   // KKTIX/Accupass 報名連結（現階段）
registrationDeadline: z.coerce.date().optional(),
streamUrl: z.string().url().optional(),         // YouTube 直播（活動前）
// videoUrl 已存在（回放）
speakers: z.array(z.string()).default([]),      // 對應 contributors，餵講者徽章
capacity: z.number().optional(),
```

### 8.2 貢獻者上架流程（維持「一個 md 檔」哲學）

1. 複製 `src/content/events/_template.md`（新增此模板，含所有欄位註解）。
2. 開 PR → CI schema 驗證 → 核心團隊 review → merge 即上架。
3. 未來可加一個靜態「活動建立小幫手」頁，表單填完生成 md 內容供複製貼上，
   零後端、降低非工程貢獻者門檻。

### 8.3 發布自動化（GitHub Actions，merge 觸發）

| 步驟 | 工具 | 說明 |
|---|---|---|
| OG 宣傳圖 | satori / @vercel/og 於 CI 產圖 | 活動名/日期/講者套品牌模板，輸出到 `public/og/` |
| RSS | 既有 `rss.xml.ts` | 已完成 |
| 社群媒體排程 | Buffer（首選，免費檔期夠）或各平台 API | FB 粉專/社團、IG、LinkedIn、Threads；文案由 md 的 description 生成 |
| Discord/LINE 通知 | webhook | 一次 POST，最便宜的高觸及通道 |

原則：**貢獻者只寫 markdown，其餘全自動**。任何一步自動化失敗都不 block 上架（宣傳是 best-effort）。

### 8.4 直播與回放（YouTube）

1. 活動前：核心團隊在 YouTube 排程直播 → 連結填入 `streamUrl` → 活動頁自動顯示「即將直播」。
2. 活動後：回放整理 → 填 `videoUrl` → 活動頁出現回放；同場演講可再挑選進
   `videos.json` 知識庫（沿用現有人工策展流程，維持品質）。
3. 錄影 SOP（設備、OBS 設定、上字幕）另立 runbook，不在本文件範圍。

### 8.5 活動後閉環

現況（外部售票平台過渡期）：
```
活動結束 → 平台匯出名單 → 丟進 dddtw-attendees/ → 跑 consolidate + build
        → 成就更新上線 → （Phase 3）寄「你解鎖了新徽章」通知信 → 引導報名下一場
```

Phase 3a 之後（自營報名）：
```
官網報名 → DynamoDB（報名事實）→ 活動日掃 QR（出席事實）
        → nightly/手動 job：export API 匯出 CSV → build-achievements → 部署
        → 「匯名單」步驟消失；成就依真實出席計算
```

「第 2 場轉換」的關鍵鉤子就在最後一步：成就通知信附上「距離 Entity 只差 2 場」＋
下一場活動連結。

## 9. 金流決策（結論：現在不自建）

### 9.1 決策依據（真實資料）

- 歷年票券金額：平均 **NT$ 356k/年**（2022 低點 31k，2023 高點 789k）。
- 有付費交易的月份：每年僅 5–10 個月，且高度集中在年會前。
- 固定月費損益兩平點：以 OEN NPO 方案月費 $12k/年、與無月費方案手續費差 0.45% 計，
  需年交易額 **NT$ 267 萬** 才打平——為現況的 7.5 倍。

### 9.2 決策

| 時期 | 方案 | 理由 |
|---|---|---|
| **現在（Phase 1-2）** | 維持 KKTIX/Accupass，官網只放 `registrationUrl` | 零固定成本；名單匯入流程已自動化 |
| **Phase 3a** | 自營報名（免費場先行），不含金流 | 資料主權與出席紀錄先到手，不被金流談判阻塞 |
| **Phase 3b 評估點** | 付費場要自營時啟動；或年交易 >NT$ 1M / 需定期贊助 → 重新評估方案 | 觸發條件明確，不憑感覺 |
| **屆時候選** | ①綠界/藍新（無月費，~2.75%，年成本 ~$10k）②OEN 客製專案（若談到無月費；優點：發票代開、CRM、MCP、社群調性）③OEN NPO（需協會立案，適合交易量長大後） | architecture 都一樣：託管付款頁 + 自家訂單 DB，可互換 |

### 9.3 屆時的整合架構（預留設計，不實作）

```
官網活動頁 → Lambda POST /orders（建訂單，DynamoDB）→ 金流商 checkout API → 託管付款頁
→ successUrl 返回 → Worker 查交易確認 → 寄 QR 票券信 → 掃碼出席 → 餵成就系統
```

發票：OEN 可代開；綠界/藍新用其電子發票加值服務。卡號永不經過自有系統（無 PCI 負擔）。

## 10. 實作路線圖

### Phase 0 — 資料地基
- [x] `dddtw-attendees/` 確認未被 git 追蹤，已加入 `.gitignore`（2026-07-22）。
- [x] 建 `src/data/event-registry.json`：76 個代碼 → 55 場活動 mapping（2026-07-23；
      約 25 筆標 `todo: true` 待人工核對名稱）。
- [ ] 為 30 個既有 event md 補 `topics`。
- [x] 成就規則引擎（build 腳本內建）；真實資料位階分佈已試跑（2026-07-23）：
      VO 1263 / Entity 244 / AR 62 / BC 11 / DE 2。單元測試待補。
- **驗收（待辦）**：核心團隊確認級距（BC 11 人偏少，考慮門檻 15→12）與 registry 名稱核對。

### Phase 1 — 成就系統上線
- [x] `build-achievements.py`：consolidated → 雜湊分片 JSON（255 分片、1,582 人）。
- [x] `/me` 頁（zh/en）：email 查詢 → 位階/時間軸/技能樹/徽章牆＋區塊導航（2026-07-23）。
- [x] 成就卡：canvas 頁內預覽＋PNG 下載，深淺色自適應。
- [x] 補登機制：`manual-participations.json` ＋ build 合併邏輯（首例：創辦人 Kim 補登全場次）。
- [ ] 補登/合併/刪除的對外申請管道文案（`/governance/#member-data` 已上，Google Form 未建）。
- [ ] email-aliases（多 email 合併）的 build 支援。
- **驗收（待辦）**：核心團隊 10 人試用 → 社群公告上線。

### Phase 2 — 活動生命週期（可與 Phase 1 收尾並行）
- [ ] events schema 擴充 + `_template.md` + README 更新。
- [ ] CI：OG 圖自動產生、Discord/LINE webhook、Buffer 排程。
- [ ] 過渡期名單匯入 runbook＋`update.sh` 一鍵腳本；raw data 移入私有 repo（解 R6 單點）。
- **驗收**：下一場真實活動全程走新流程。

### Phase 3a — 自營報名與出席（確定方向，Phase 2 後啟動）
- [x] Lambda + DynamoDB + SES 報名 API scaffold（infra/registration/，CDK；2026-07-23）。防濫用（WAF/蜜罐）待補。
- [ ] 活動頁報名表單（event md 加 `registration: onsite` 即啟用）。
- [ ] QR 票券信（email 服務：Resend/SES）＋ 活動日掃碼頁（手機瀏覽器即可驗票）。
- [ ] 成就 build 改吃 export CSV；Participation 從「報名」升級為「出席」事實。
- [ ] Magic link 驗證（同一套 email 基礎設施順手做，`/me` 從查詢升級為登入）。
- **驗收**：一場免費活動全程自營（報名→QR→出席→成就更新），零外部售票平台。

### Phase 3b — 金流（付費場需求明確後）
- [ ] 依 `docs/oen-negotiation-brief.md` 談判結果選定金流商（OEN / 綠界，架構可互換）。
- [ ] 報名流程插入付款：建訂單 → 託管付款頁 → 確認入帳 → 發 QR 票券。
- [ ] 電子發票（金流商代開）。
- **驗收**：一場付費活動在官網完成報名+付款，對帳正確。

## 11. 風險與對策

| # | 風險 | 等級 | 對策 |
|---|---|---|---|
| R1 | raw 名單（明文個資）誤入版控 | 中→已緩解 | 已確認從未被 git 追蹤（2026-07-22 檢查），並加入 `.gitignore`；raw data 建議另存私有儲存備份 |
| R2 | email 查詢式可被枚舉他人成就 | 中 | 內容僅公開活動參與；加 salt 防彩虹表；Phase 3 升級 magic link |
| R3 | 報名≠出席，成就灌水疑慮 | 低 | UI 誠實標示；未來以 QR 出席逐步取代 |
| R4 | mapping/規則爭議（「我那場明明有去」） | 中 | 人工補登通道 + PR 勘誤 + ratchet 原則 |
| R5 | 自動宣傳發文出錯（錯字/錯日期公開露出） | 低 | 發布前 PR review 即是把關；Buffer 可設審核佇列 |
| R6 | 依賴單一維護者 | 中 | 全部流程文件化（runbook）；腳本可重跑、無隱藏狀態 |

## 12. 開放問題（需核心團隊拍板）

1. 位階名稱用 DDD 建構塊（Value Object → Domain Expert）大家買單嗎？有更好的隱喻（武俠/修煉）嗎？
2. 位階門檻數字——等 Phase 0 試跑分佈後定案。
3. 成就頁要不要有公開分享（opt-in）以外的任何公開性？（本設計預設：完全私人）
4. DDD Taiwan 是否要立案為協會？（影響金流方案、發票、贊助收據）
5. 講者/志工名單誰來補？（歷史 76 場的 speakers 欄位是人工工程）
6. 社群媒體自動發文的帳號權限與 Buffer 訂閱由誰管理？

---

*附錄 A：資料分析詳情見 `dddtw-attendees/consolidated/community-analysis-report.md`*
*附錄 B：OEN API 調查（2026-07）：託管頁模式、有測試環境、發票代開；公開文件未見 webhook，僅轉址+查詢 API*
