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
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    /** 英文版頁面顯示的活動標題（選填，未填時顯示 title） */
    titleEn: z.string().optional(),
    date: z.coerce.date(),
    type: z.enum(['meetup', 'conference', 'bookclub']),
    link: z.string().url().optional(),
    location: z.string().optional(),
    /** 活動結束後補充的錄影回放連結 */
    videoUrl: z.string().url().optional(),
  }),
});

/**
 * 書單（知識庫 Books），資料檔維護於 src/data/books.json。
 */
const books = defineCollection({
  loader: file('./src/data/books.json'),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    year: z.number(),
    summary: z.string(),
    coverColor: z.string().default('#24417E'),
  }),
});

export const collections = { posts, events, books };
