import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * 文章（知識庫 Papers / 社群心得 / 公告）。
 * 發表新文章 = 在 src/content/posts/ 新增一個 .md 檔，merge 到 main 即上線。
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    lang: z.enum(['zh', 'en']).default('zh'),
    author: z.string().default('DDD Taiwan'),
    tags: z.array(z.string()).default([]),
    /** Papers 上架流程：原作者授權紀錄（連結或說明），社群 Review 時檢查 */
    authorization: z.string().optional(),
    /** 原文出處連結（轉載/摘錄時填寫） */
    source: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

/**
 * 活動（Meetup / Conference / Book Club），含歷屆與即將舉行。
 */
const events = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!_*.md'], base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    /** 英文版頁面顯示的活動標題（選填，未填時顯示 title） */
    titleEn: z.string().optional(),
    date: z.coerce.date(),
    type: z.enum(['meetup', 'conference', 'bookclub', 'workshop', 'tour']),
    link: z.string().url().optional(),
    location: z.string().optional(),
    /** 活動結束後補充的錄影回放連結 */
    videoUrl: z.string().url().optional(),
    /** 主題標籤：知識庫四分類（strategy/collaboration/ddd-core/architecture）＋技術標籤
     *  （eventstorming/tdd/microservices/ai…）。餵成就系統技能樹與知識庫缺口分析。 */
    topics: z.array(z.string()).default([]),
    /** 報名方式：external = 外部平台（填 link）；onsite = 自營報名（Phase 3a，活動頁出現報名表單） */
    registration: z.enum(['external', 'onsite']).optional(),
    registrationDeadline: z.coerce.date().optional(),
    /** 名額上限（自營報名時由 Worker 控管） */
    capacity: z.number().optional(),
    /** YouTube 直播連結（活動前排程；活動後回放請填 videoUrl） */
    streamUrl: z.string().url().optional(),
    /** 講者（對應 contributors 的 name；餵講者徽章） */
    speakers: z.array(z.string()).default([]),
  }),
});

/**
 * 書單（知識庫 Books），資料檔維護於 src/data/books.json。
 */
const books = defineCollection({
  loader: file('./src/data/books.json'),
  schema: z.object({
    title: z.string(),
    /** 英文頁書名（選填，未填時沿用 title）。 */
    titleEn: z.string().optional(),
    author: z.string(),
    /** 英文頁作者（選填，未填時沿用 author）。 */
    authorEn: z.string().optional(),
    year: z.number(),
    /** 書單分類：策略與情境 / 協作建模 / DDD 核心 / 架構與韌性。組內排序即 JSON 陣列順序（入門 → 深入）。 */
    category: z.enum(['strategy', 'collaboration', 'ddd-core', 'architecture']),
    summary: z.string(),
    /** 英文頁摘要（選填，未填時沿用 summary）。 */
    summaryEn: z.string().optional(),
    /** 正式書封圖片路徑（public/covers/），未提供時以 coverColor 色塊代替 */
    cover: z.string().optional(),
    coverColor: z.string().default('#24417E'),
    /** 購買或免費閱讀的連結 */
    url: z.string().url().optional(),
  }),
});

/**
 * 精選影片（知識庫 Video），資料檔維護於 src/data/videos.json。
 */
const videos = defineCollection({
  loader: file('./src/data/videos.json'),
  schema: z.object({
    title: z.string(),
    titleEn: z.string().optional(),
    /** 分類依內容類型，不依活動場次：實戰案例／主題演講／人物專訪／座談討論／技術方法 */
    category: z.enum(['case-study', 'keynote', 'interview', 'panel', 'technique']),
    url: z.string().url(),
    channel: z.string().optional(),
    year: z.number().optional(),
    /** 一行說明「為什麼推薦這支」，讓分類不只是標籤 */
    highlight: z.string().optional(),
    highlightEn: z.string().optional(),
    /** 置頂精選（顯示大縮圖卡），通常留給國際／指標性講者 */
    featured: z.boolean().default(false),
  }),
});

/**
 * 貢獻者（首頁 Contributors 區塊），資料檔維護於 src/data/contributors.json，
 * 照片放 public/contributors/。
 */
const contributors = defineCollection({
  loader: file('./src/data/contributors.json'),
  schema: z.object({
    name: z.string(),
    nameEn: z.string().optional(),
    role: z.string(),
    roleEn: z.string(),
    /** 一行個人風格描述（仿 Virtual DDD 的 tagline，如 "Business software artist"） */
    tagline: z.string().optional(),
    taglineEn: z.string().optional(),
    bio: z.string().optional(),
    bioEn: z.string().optional(),
    /** 大頭照（選填）；未提供時首頁改以姓名縮寫的圓形頭像呈現。 */
    photo: z.string().optional(),
    links: z
      .object({
        github: z.string().url().optional(),
        linkedin: z.string().url().optional(),
        x: z.string().url().optional(),
        website: z.string().url().optional(),
      })
      .default({}),
  }),
});

export const collections = { posts, events, books, videos, contributors };
