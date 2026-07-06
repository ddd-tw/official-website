# DDD TW 官網 — 架構規範

依 Miro board「DDD TW 官網 — User Story Map & Event Storming」的決議:

- 活動內容(介紹/講者/票種定義)= **GitHub 管理的內容檔**(`content/events/*.json`),經 RC → Release 發布
- 報名/訂單/驗票 = **獨立 Postgres DB**(動態資料,不進 Git)
- MVP 付款 = **現場繳費**(線上金流為未來擴充)
- 離線驗票 = 簽章 QR(HMAC)+ 名單 manifest 預下載

## Monorepo

```
apps/api        Bun + Hono 後端(clean architecture)
apps/web        React + Vite 前端(只依賴 @dddtw/contracts)
packages/contracts  API DTO / route 常數(前後端唯一交會點)
content/events  活動內容檔(GitHub 管理的「靜態」內容)
db/migrations   SQL migrations
```

## 後端分層(clean architecture,依賴只能往內)

```
interface(http)→ application(use cases)→ domain
                          ↓ ports(interfaces)
infrastructure(postgres/email/clock)實作 ports,於 composition root 注入
```

每個 bounded context 一個資料夾:`apps/api/src/contexts/{catalog,registration,checkin}`,
各自含 `domain/ application/ infrastructure/ http/` 四層。跨 context 只透過 ID 與
application 層的 port 溝通,不得 import 其他 context 的 domain。

## CQS

- application 層分 `commands/`(改變狀態,回傳最小結果)與 `queries/`(唯讀,可繞過
  domain 直接查 read model / SQL view)
- Command handler 一次交易;domain event 於交易內 dispatch 給
  in-process policy(如 TicketIssuancePolicy)

## SOLID 落地要求

- 依賴反轉:repository / email / clock / token-signer 皆為 domain|application 層定義的
  interface,infrastructure 實作
- 單一職責:一個 use case 一個 class/function;http handler 只做解析與轉譯
- 開閉:PaymentStatus 新增 paid_online 時不得修改既有 command 的分支邏輯
  (以 policy/strategy 擴充)

## 不變量(見板上 Domain Model 說明)

- TicketType:`reserved ≤ quota`,以 DB 條件式 UPDATE 保證(樂觀且原子)
- Registration:requiresApproval 必經 pending_review;confirmed 前不得核發票券
- Ticket:HMAC 簽章 QR;checked_in 為終態
- CheckInRecord:append-only;同票第二次成功掃描 → duplicate
