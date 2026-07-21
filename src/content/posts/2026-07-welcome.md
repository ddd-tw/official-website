---
title: 新官網上線 — 內容發布流程說明
description: 新官網以 Markdown 管理內容，發文即開 PR，merge 即上線。
pubDate: 2026-07-20
lang: zh
author: DDD Taiwan
tags: [公告]
---

DDD Taiwan 新官網正式上線。新的內容發布流程：

1. 在 `src/content/posts/` 新增一個 Markdown 檔（frontmatter 填 `title`、`description`、`pubDate`）。
2. 開 Pull Request，由社群成員 Review。
3. Merge 到 `main` 後，GitHub Actions 會自動建構並部署到 ddd-tw.com。

Papers 轉載類文章請在 frontmatter 補上 `source`（原文連結）與 `authorization`（作者授權紀錄），Review 時一併確認。
