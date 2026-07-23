# DDD Taiwan 報名系統（Phase 3a — AWS）

自營活動報名 API：**Lambda + API Gateway HTTP API + DynamoDB 單表 + SES**。
基礎設施即程式碼（CDK），與官網「一切都是檔案、PR 審核」的哲學一致。
設計脈絡見 `docs/member-system-design.md` §7 / §10 Phase 3a。

選 AWS 的理由（2026-07-23 決策）：網域已在 Route53、WorkMail 已驗證 ddd-tw.com 寄信身分、
社群核心成員多為 AWS 熟手（維運不依賴單一人）。

## 架構

```
官網活動頁（registration: onsite）
  → /register/{eventId}/ 報名頁（靜態，Astro 生成）
  → https://register.ddd-tw.com（API GW → Lambda）
      POST /api/register    → DynamoDB → SES 寄 QR 票券信
      GET  /api/events/{id}/stats
      POST /api/checkin     （/staff/checkin 頁掃 QR，X-Staff-Key 授權）
      GET  /api/export/{id} （CSV → 餵 scripts/build-achievements.py）
```

DynamoDB 單表：`EVENT#{id}/META`（活動設定）、`EVENT#{id}/REG#{email}`（報名＋出席）、
`QR#{token}/QR`（驗票反查）。PK/SK 天生防同活動重複報名。

## 部署（一次性，約 20 分鐘）

> ⚠️ 全程使用**最小權限** IAM（CDK 部署需要 CloudFormation/IAM/Lambda/DynamoDB/APIGW/Route53/ACM）。
> 不要用 Admin credentials 日常操作；資源表已設 `RemovalPolicy.RETAIN`，stack 誤刪也不會掉資料。

```bash
cd infra/registration
npm install
npx cdk bootstrap                     # 若此帳號/region 第一次用 CDK
STAFF_KEY=$(openssl rand -hex 16) npx cdk deploy
# 輸出 ApiUrl = https://register.ddd-tw.com；STAFF_KEY 記下來給驗票工作人員
```

不動 DNS 的快速驗證（用 API GW 預設網址，適合第一次部署先測通）：
```bash
STAFF_KEY=... npx cdk deploy -c skipDns=true
# 輸出 ApiUrl = https://xxxx.execute-api.{region}.amazonaws.com
# 前端暫時用 PUBLIC_REGISTRATION_API 指向它；確認可用後再去掉 skipDns 重新 deploy 綁正式網域
```

SES 前置（一次性）：
1. SES console → verified identities 確認 `ddd-tw.com` 已驗證（WorkMail 用戶通常已完成）。
2. 帳號若在 SES sandbox，申請 production access（收件人不限驗證信箱）。
3. 建議設定 `tickets@ddd-tw.com` 的 DKIM/自訂 MAIL FROM（Route53 一鍵加記錄）。

## 開一場自營報名活動

1. 活動 md frontmatter 設 `registration: onsite`（可加 `capacity`）。
2. 在 DynamoDB 登記活動（開放報名）：
   ```bash
   aws dynamodb put-item --table-name dddtw-registration --item '{
     "PK": {"S": "EVENT#2026-09-xxx"}, "SK": {"S": "META"},
     "capacity": {"N": "40"}, "open": {"BOOL": true}
   }'
   ```
3. merge 後官網自動生成 `/register/2026-09-xxx/` 報名頁。
4. 活動日：工作人員開 `/staff/checkin`（輸入 STAFF_KEY）掃票。
5. 活動後匯出並餵成就：
   ```bash
   curl -H "X-Staff-Key: $KEY" https://register.ddd-tw.com/api/export/2026-09-xxx > export.csv
   # TODO（接手點）：build-achievements.py 的 AWS 匯出 loader（Phase 3a 收尾時加上）
   ```

## 本機開發

Lambda handler 是純函式，可用 `node --test` 加測試；端對端測試建議直接 deploy 到
個人測試 stack：`npx cdk deploy -c domainName=register-dev.ddd-tw.com`。
前端指向測試環境：`PUBLIC_REGISTRATION_API=https://register-dev.ddd-tw.com npm run dev`。

## 尚未涵蓋（Phase 3a 收尾清單）

- [ ] build-achievements.py 的匯出 CSV loader（出席事實 → 成就）
- [ ] 報名表單防機器人（API GW throttling 已內建基本保護；可加 WAF 或蜜罐欄位）
- [ ] Magic link 驗證（/me 從查詢升級為登入；共用 SES）
- [ ] 取消報名連結（票券信內）
- [ ] events_meta 與 event md 的同步自動化（目前手動 put-item）
- [ ] STAFF_KEY 改存 SSM Parameter Store（目前為 Lambda 環境變數）
