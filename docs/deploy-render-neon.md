# 部署到 Render + Neon(免費方案)

架構:**Neon**(免費 Postgres,不過期)+ **Render**(API 容器 free + 靜態前端 free)。
前端是 Render Static Site(有 CDN、不休眠),`/api/*` 由 Render 的 rewrite 代理到 API 服務(同源,無 CORS 問題)。

## 1. Neon — 建立資料庫(一次)

1. https://neon.tech 註冊 → Create project(區域選 AWS ap-southeast-1 新加坡,離台灣最近)
2. 進 Dashboard → **Connection string** → 選 **Pooled connection**,複製(長這樣):
   `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
3. 不用手動建 schema——API 開機會自動跑 migrations + 從 `content/events/` 同步票種

## 2. Render — Blueprint 一鍵建立兩個服務

1. https://render.com 註冊(可用 GitHub 登入,免信用卡)
2. **New → Blueprint** → 連接 `ddd-tw/official-web-site` repo → Render 會讀取根目錄的 `render.yaml`
3. 部署前只需填一個值:**`DATABASE_URL`** ← 貼上步驟 1 的 Neon pooled connection string
   (`ADMIN_TOKEN`、`TICKET_SECRET` 由 Render 自動產生;到 dddtw-api → Environment 可查看 `ADMIN_TOKEN`,後台登入用)
4. 按 Apply,等兩個服務轉綠:
   - `dddtw-api` → https://dddtw-api.onrender.com(開機自動 migrate + seed)
   - `dddtw-web` → https://dddtw-web.onrender.com ← **這是官網網址**

⚠️ 如果 `dddtw-api` 子網域已被別人占用,Render 會給實際網址加後綴——此時要把 `render.yaml` 裡 web 服務的 rewrite `destination` 改成實際網址再重新部署。

## 3. 驗收

- 打開 https://dddtw-web.onrender.com → 首頁近期活動 + 歷年活動回顧(56 個活動、banner、講者照片、議程)
- `/admin` 用 Render 產生的 `ADMIN_TOKEN` 登入 → 志工審核/名單/驗票站

## 免費層要知道的事

| 事項 | 說明 |
|------|------|
| **API 休眠** | 閒置 15 分鐘後休眠,下個請求冷啟動 30–60 秒。前端(靜態)不受影響 |
| **活動當天驗票** | 開場前先開驗票站頁面喚醒 API,並下載「離線名單」備援;別賭冷啟動 |
| **Neon scale-to-zero** | 閒置 5 分鐘後暫停,喚醒 <1 秒,幾乎無感 |
| **內容更新** | merge 到 main → Render 自動重新部署(API 開機 seed 會同步新活動的票種)|
| **保持喚醒(選用)** | 用 cron-job.org 每 10 分鐘 ping `/api/events`(免費 750 小時/月夠 24/7 一個服務)|

## 發布流程對應(RC → 正式)

Render 支援 **Preview Environments**(PR 自動起預覽服務,free 層可用手動 preview)或直接:
開 PR 改 `content/events/` → 在 PR 裡人工 review → merge = 發布正式站。
