# DDD Taiwan 官網

Domain Driven Design Taiwan 社群官網:活動介紹、報名(志工票審核/現場繳費)、現場 QR 驗票。

規劃與領域模型見 Miro board「DDD TW 官網 — User Story Map & Event Storming」。
架構規範見 [docs/architecture.md](docs/architecture.md)。

## 技術

- **Bun** + **TypeScript** monorepo(workspaces)
- 後端 `apps/api`:Hono + Bun.sql(Postgres),DDD / clean architecture / CQS
- 前端 `apps/web`:React + Vite,只依賴 `@dddtw/contracts`
- 活動內容 = `content/events/*.json`(GitHub 管理,RC → Release 發布)
- 報名/驗票資料 = Postgres(獨立 DB,不進 Git)

## 開發

```bash
bun install
bun run db:up        # 啟動 Postgres(docker, port 5433)
bun run db:migrate
bun run db:seed      # 同步 content/events 的票種到 DB
bun run dev:api      # http://localhost:3000
bun run dev:web      # http://localhost:5173(/api 代理到 3000)
```

測試與型別檢查:

```bash
bun test             # use case 測試(in-memory fakes,不需 DB)
bun run typecheck
bun run e2e          # Bruno e2e(需 API + DB 運行中)
```

部署見 [docs/deploy-zeabur.md](docs/deploy-zeabur.md)(Zeabur:postgres + api + web 三服務)。

## 環境變數(開發皆有預設值)

| 變數 | 預設 | 說明 |
|------|------|------|
| `DATABASE_URL` | `postgres://dddtw:dddtw@localhost:5433/dddtw` | 報名 DB |
| `PORT` | `3000` | API port |
| `ADMIN_TOKEN` | `dev-admin-token` | 後台/驗票 API token(header `x-admin-token`) |
| `TICKET_SECRET` | `dev-ticket-secret` | 票券 QR HMAC 簽章金鑰 |
| `CORS_ORIGIN` | `http://localhost:5173` | 前端來源 |
