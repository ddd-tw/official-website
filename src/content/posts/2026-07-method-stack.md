---
title: 先懂問題，再談解法 — 我如何把 Impact Mapping、Event Storming 與持續演進架構串成一套組合拳
description: 單一方法解決不了複雜問題。從一個「客戶被說服全上 Kubernetes」的真實故事出發，談 Cynefin、Impact Mapping、Wardley Mapping、Event Storming、Specification by Example 與 Rozanski & Woods 視角如何各司其職、互相接力。
pubDate: 2026-07-21
lang: zh
author: Kim Kao
tags: [方法論, Event Storming, Impact Mapping, 持續演進架構]
---

幾年前我遇到一個零售業的客戶，前一家廠商已經給了他們答案：「全部搬上 Kubernetes，問題就解決了。」但真正的問題，是底層那套二十年、沒有人完整搞得懂的老系統。**他們在理解問題之前，就已經知道答案了。**

我沒有跟任何人爭論 Kubernetes 的優劣。我反過來做了兩件事：先用 **Impact Mapping** 對決策者與各功能主管提問 —「誰會支持營收月月成長這個目標？他們的行為需要發生什麼改變？」再辦一場**兩天、四五十人的 Event Storming**，把整條業務流攤在牆上。答案自己浮現了：真正該切入的地方是商家管理（merchant management），跟 Kubernetes 一點關係也沒有。

這篇文章想講的不是哪個方法最好，而是**它們如何各司其職**。這套組合拳裡的每一個方法，回答的是不同層次的問題：

## 每個方法回答一個問題

**Cynefin — 我們現在身處什麼情境？**
清晰的問題套最佳實踐就好；繁雜的問題請專家分析；複雜的問題只能先探測、再感知、再回應。分不清情境就選工具，是多數專案災難的起點。二十年老系統的現代化，幾乎永遠落在「複雜」象限 — 這代表你需要的是探索的方法，不是現成的答案。

**Impact Mapping — 為什麼做？誰能幫我們達成？**
目標 → 角色 → 影響 → 交付物，四層提問。它最大的價值是把「我們要做 X 功能」翻轉成「誰的行為改變了，目標才會達成」。上面故事裡那個問題，就是從這裡來的。

**Wardley Mapping — 這些元件在演化的哪個階段？**
把價值鏈畫在演化軸上，你才知道哪些該自己建、哪些該用現成的、哪些正在商品化。它讓「技術選型」從信仰之爭變成有地形可循的策略討論。

**Event Storming — 領域裡實際發生了什麼事？**
把所有知道業務片段的人放進同一個房間，用橘色便利貼把領域事件攤開。它的產出不只是流程圖 — 是共同語言、是 Bounded Context 的雛形、是「原來你們部門是這樣理解這件事的」的集體頓悟。

**Domain Storytelling — 這個具體案例真的是這樣走的嗎？**
Event Storming 給你全景，Domain Storytelling 用一個個具體故事驗證細節。兩者互補。

**Specification by Example — 規則說清楚了嗎？**
把需求對話落成關鍵實例（Example Mapping 是它輕量的工作坊形式），實例直接變成驗收測試。業務規則從此不再躲在某個人的腦袋裡。

**Rozanski & Woods Viewpoints & Perspectives — 架構對誰負責？**
7 個視點、8 個視角，強迫你面對「利害關係人不只有開發者」這個事實。安全、效能、演進性 — 每個視角都是一次對架構的拷問。這是「持續演進架構」的基石：架構不是一次性的技術決策，而是持續演進的社會技術活動。

**DDD 戰略與戰術 — 最後才是程式碼。**
Bounded Context、Context Mapping、Aggregate。注意順序：它在組合拳的最後，因為建模的品質取決於前面每一步餵給它的理解。

## 它們不是流水線，是循環

實務上這些方法不會排成一條直線跑完。Event Storming 挖出的疑問會把你送回 Impact Mapping 重新對焦；架構視角的檢視會逼你重開一場建模工作坊。**方法之間的接力與回頭，才是真正的功夫。**

最近一年我把這套組合拳帶進了 AI 驅動的大型現代化專案：讓 AI agents 沿著同樣的方法論工作 — 先全域分析、再架構映射、最後領域建模，每個階段的產出都是下一個階段的輸入。方法論沒有因為 AI 而過時，反而成了 agent 編排的骨架：**AI 加速的是執行，但「先懂問題」這件事，仍然是人的責任。**

## 想動手練？

這些方法在社群都有實際的練習場：[年會](/events/)固定有 Event Storming 與 Domain Storytelling 工作坊，[知識庫](/knowledge/)裡有上面每一本書的入口，[GitHub](https://github.com/ddd-tw) 上有兩個 320+ 星的 Event Storming workshop repo 可以直接跟著做。

先懂問題，再談解法。我們在社群見。
