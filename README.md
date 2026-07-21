# DDD Taiwan 官方網站

[DDD Taiwan](https://ddd-tw.com)（Domain-Driven Design Taiwan）社群官網。使用 [Astro](https://astro.build) 建構的靜態網站，內容以 Markdown / JSON 管理，push 到 `main` 後由 CI 自動建構與部署。

設計稿與規格見 [`design_handoff_ddd_taiwan_website/`](./design_handoff_ddd_taiwan_website/README.md)。

## 開發

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 輸出到 dist/
npm run preview  # 預覽 build 結果
```

## 如何發布內容

所有內容都是 repo 裡的檔案，**merge 到 `main` 即自動上線**。

| 內容 | 位置 | 做法 |
|------|------|------|
| 文章（Papers / 心得 / 公告） | `src/content/posts/*.md` | 新增 `.md` 檔，frontmatter 填 `title` / `description` / `pubDate` / `lang`；轉載文章請加 `source`（原文連結）與 `authorization`（作者授權紀錄） |
| 活動（Meetup / 年會 / 讀書會） | `src/content/events/*.md` | 填 `title` / `titleEn` / `date` / `type` / `link`；活動後補 `videoUrl` |
| 書單 | `src/data/books.json` | 填分類（`strategy` / `collaboration` / `ddd-core` / `architecture`）、封面放 `public/covers/` |
| 精選影片 | `src/data/videos.json` | 填 `title` / `category` / `url` |
| 貢獻者 | `src/data/contributors.json` | 照片放 `public/contributors/`，附中英 bio 與連結 |

發布流程：開 branch → 新增或修改檔案 → 開 Pull Request → 社群 Review → merge。
所有資料欄位都有 schema 驗證（`src/content.config.ts`），欄位寫錯時 CI 會在 PR 上直接擋下來。

## 雙語

中文為預設（根路徑），英文在 `/en/` 底下。頁面文案放在 `src/components/` 的共用元件內成對維護；內容資料以 `lang` 或 `titleEn` 等欄位區分。新增內容時請盡量讓中英文保持對等。

## 部署

- 每個 PR 會跑 build 檢查（`.github/workflows/ci.yml`）
- Merge 到 `main` 後自動建構並部署（`.github/workflows/deploy.yml`）

基礎設施細節（網域、DNS 等）不在此文件說明，如有需要請聯繫社群管理者。

## 專案結構

```
src/
├── content.config.ts    # 所有內容集的 schema
├── content/
│   ├── posts/           # 文章（Markdown）
│   └── events/          # 活動（Markdown）
├── data/                # books / videos / contributors（JSON）
├── i18n/ui.ts           # 導覽與 footer 的中英字典
├── layouts/Base.astro   # 共用外框（nav / footer / 主題切換 / SEO meta）
├── components/          # 各頁面的共用元件（zh/en 文案成對）
├── styles/global.css    # design tokens（深淺色）與基礎樣式
└── pages/               # 路由薄殼（/ 與 /en/）
```

## 聯繫

- 一般聯繫：dddtw2018@gmail.com
- 年會贊助：conference@ddd-tw.com
