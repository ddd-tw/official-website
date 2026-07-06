# 部署到 Zeabur

三個服務:`postgres`(prebuilt)、`api`(Dockerfile.api)、`web`(Dockerfile.web)。
Zeabur 依「服務名稱」挑選對應的 `Dockerfile.<service-name>`,所以**服務命名必須是 `api` 與 `web`**。

## 步驟

1. **推上 GitHub**(repo 需先 `git init` 並 push;活動內容走 RC → Release 的流程也以此 repo 為準)

2. **建立 Zeabur 專案**,依序加入服務:

   ### PostgreSQL(Prebuilt)
   - Add Service → Prebuilt → PostgreSQL

   ### api(從 GitHub repo)
   - Add Service → GitHub → 選這個 repo,服務命名為 **`api`**(會使用根目錄的 `Dockerfile.api`)
   - 環境變數:

     | 變數 | 值 |
     |------|-----|
     | `DATABASE_URL` | `${POSTGRES_CONNECTION_STRING}`(引用 postgres 服務) |
     | `ADMIN_TOKEN` | 產一組強隨機字串(後台/驗票用) |
     | `TICKET_SECRET` | 產一組強隨機字串(QR 簽章;**改了會使已發出的票全部失效**) |
     | `CORS_ORIGIN` | `https://<web 的網域>`(同源代理下其實用不到,保險用) |

   - 容器啟動時會自動跑 migrations + 從 `content/events/*.json` 同步票種(冪等),
     所以「發新活動」= 改 content → merge → Zeabur 自動重新部署,符合 GitHub Release 流程

   ### web(從 GitHub repo)
   - Add Service → GitHub → 同一個 repo,服務命名為 **`web`**(使用 `Dockerfile.web`)
   - 前端由 Caddy 供應,`/api/*` 透過 Zeabur 私有網路反向代理到 `api.zeabur.internal:3000`
     (同源,瀏覽器端無 CORS 問題);如服務名不是 `api`,設 `API_ORIGIN` 環境變數覆蓋
   - 綁定網域(Domains → 產生 `xxx.zeabur.app` 或掛自己的網域)

3. **驗收**:開 `https://<web 網域>/` 應看到活動列表;`/admin` 用 `ADMIN_TOKEN` 登入

## RC 預覽環境(對應板上「產生 RC 預覽」)

Zeabur 支援從不同 branch 部署:另開一個環境(或第二組 api/web 服務)指向 `rc` branch,
搭配獨立的 Postgres,即為 RC 預覽站;merge 到 `main` 後正式站自動更新。

## 注意事項

- `PORT` 由 Zeabur 自動注入,api(Bun.serve)與 web(Caddyfile `{$PORT}`)都已支援
- 報名資料只存在 Postgres——備份請開 Zeabur 的 backup,或定期 `pg_dump`
- 本機驗證 Docker 打包:
  ```bash
  docker build -f Dockerfile.api -t dddtw-api .
  docker build -f Dockerfile.web -t dddtw-web .
  ```
