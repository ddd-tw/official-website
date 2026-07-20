# DDD Taiwan 官方網站

DDD Taiwan（Domain-Driven Design Taiwan）社群官網，使用 [Astro](https://astro.build) 建構的靜態網站，部署於 GitHub Pages（ddd-tw.com）。

設計稿與規格見 [`design_handoff_ddd_taiwan_website/`](./design_handoff_ddd_taiwan_website/README.md)。

## 開發

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 輸出到 dist/
npm run preview  # 預覽 build 結果
```

## 如何發布內容

所有內容都是 repo 裡的 Markdown / JSON 檔，**merge 到 `main` 即自動部署上線**。

| 內容 | 位置 | 做法 |
|------|------|------|
| 文章（Papers / 心得 / 公告） | `src/content/posts/*.md` | 新增 `.md` 檔，frontmatter 填 `title` / `description` / `pubDate`；轉載文章請加 `source` 與 `authorization` |
| 活動（Meetup / 年會 / 讀書會） | `src/content/events/*.md` | 新增 `.md` 檔，填 `title` / `date` / `type` / `link`；活動後補 `videoUrl` |
| 書單 | `src/data/books.json` | 直接編輯 JSON |

發布流程：開 branch → 新增檔案 → 開 Pull Request → 社群 Review → merge。
frontmatter 欄位有 schema 驗證（`src/content.config.ts`），欄位錯誤時 build 會直接失敗，CI 會在 PR 上擋下來。

## 部署

- **CI**（`.github/workflows/ci.yml`）：每個 PR 跑 build 檢查。
- **部署**（`.github/workflows/deploy.yml`）：push 到 `main` 自動 build 並部署到 GitHub Pages。

### 首次啟用（repo 設定）

1. GitHub repo → Settings → Pages → Source 選 **GitHub Actions**。
2. Settings → Pages → Custom domain 填 `ddd-tw.com`，勾選 **Enforce HTTPS**。

### DNS（Route 53）

在 `ddd-tw.com` 的 hosted zone 加入：

| 名稱 | 類型 | 值 |
|------|------|----|
| `ddd-tw.com` | A | `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153` |
| `ddd-tw.com` | AAAA | `2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153` |
| `www` | CNAME | `<org>.github.io` |

既有的 `conference.ddd-tw.com` 子網域不受影響。

## 專案結構

```
src/
├── content.config.ts    # content collections schema（posts / events / books）
├── content/
│   ├── posts/           # 文章（Markdown）
│   └── events/          # 活動（Markdown）
├── data/books.json      # 書單
├── i18n/ui.ts           # 中英字典（預設 zh，/en/ 為英文版）
├── layouts/Base.astro   # 共用外框（nav / footer / 主題切換）
├── styles/global.css    # design tokens（深淺色）與基礎樣式
└── pages/               # 首頁、活動、知識庫、社群、治理 + posts/[id]
```
