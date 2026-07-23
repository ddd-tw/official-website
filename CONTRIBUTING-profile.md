# 更新你的籌辦團隊個人介紹

官網首頁「社群籌辦團隊」是**橫向介紹卡**:只要你有填,卡片就會顯示你的
**頭像、一句話標語、簡介、社群連結**;只填名字的人則以精簡單行呈現。
這份指南教你用一個 PR 把自己的介紹補豐富。

## 怎麼做(改一個檔 + 放一張照片)

1. 編輯 `src/data/contributors.json`,用你的 `id` 找到自己的那一段,填入想公開的欄位。
2. 把大頭照放到 `public/contributors/`,檔名用你的 `id`(例:`michael-chen.jpg`)。
3. 開 PR → 社群 review → merge 後自動上線。

> 欄位寫錯時 CI(`src/content.config.ts` 的 schema)會在 PR 上直接擋下來,不用怕改壞。

## 可以填的欄位(都選填,填越多卡片越豐富)

| 欄位 | 說明 | 範例 |
|---|---|---|
| `name` | 中文+英文 | `"陳勉修 Michael Chen"` |
| `nameEn` | 英文站用的名字 | `"Michael Chen"` |
| `tagline` / `taglineEn` | 一句話個人風格 | `"把複雜系統拆成能演進的模型"` |
| `bio` / `bioEn` | 2–3 句自我介紹(職稱、專長、社群貢獻) | 見下方範例 |
| `photo` | 頭像路徑 | `"/contributors/michael-chen.jpg"` |
| `links` | 社群連結(完整網址) | 見下方範例 |

⚠️ **`id`、`role`、`roleEn` 請不要改**——`id` 一改會與照片、其他資料斷連。

## 📷 照片規格

- 正方形、約 **400×400**、**JPEG**、檔案盡量 **< 150KB**。
- 別直接丟手機原圖(動輒數 MB,會拖慢首頁載入)。
- 快速壓縮(macOS,置中裁方 + 縮圖 + 轉 JPEG):
  ```bash
  sips -c 800 800 你的原圖.jpg --out sq.jpg
  sips -z 400 400 -s format jpeg -s formatOptions 82 sq.jpg --out michael-chen.jpg
  ```

## 完整範例(照這格式填你自己的)

```jsonc
{
  "id": "michael-chen",              // ← 勿改
  "name": "陳勉修 Michael Chen",
  "nameEn": "Michael Chen",
  "role": "社群籌辦",                 // ← 勿改
  "roleEn": "Organizer",             // ← 勿改
  "tagline": "一句話介紹你自己",
  "taglineEn": "Your one-line intro",
  "bio": "兩三句話:你的職稱、專長、在社群做的事。",
  "bioEn": "A sentence or two in English.",
  "photo": "/contributors/michael-chen.jpg",
  "links": {
    "github": "https://github.com/你的帳號",
    "linkedin": "https://www.linkedin.com/in/你的帳號/",
    "x": "https://x.com/你的帳號",
    "website": "https://你的網站.com"
  }
}
```

`links` 裡四個(`github` / `linkedin` / `x` / `website`)都是選填,有哪個放哪個、
沒有就整個拿掉。`website` 會自動以網域顯示(如 `kimkao.dev`)。

不確定或需要幫忙 review PR,都歡迎在社群敲一聲 🙌
