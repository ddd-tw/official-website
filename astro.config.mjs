// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, readdirSync } from 'node:fs';

const SITE = 'https://ddd-tw.com';

// Build a URL → last-modified map from post frontmatter, so the sitemap carries
// real publish dates (accurate lastmod) rather than a uniform build timestamp.
const postsDir = new URL('./src/content/posts/', import.meta.url);
const lastmodByUrl = {};
for (const file of readdirSync(postsDir)) {
  if (!file.endsWith('.md')) continue;
  const raw = readFileSync(new URL(file, postsDir), 'utf-8');
  const fm = raw.split('---')[1] ?? '';
  const pubDate = fm.match(/pubDate:\s*([0-9-]+)/)?.[1];
  const lang = fm.match(/lang:\s*(\w+)/)?.[1] ?? 'zh';
  if (!pubDate) continue;
  const base = file.replace(/\.md$/, '');
  const path = `${lang === 'en' ? '/en' : ''}/posts/${base}/`;
  lastmodByUrl[`${SITE}${path}`] = new Date(pubDate).toISOString();
}

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh-TW',
          en: 'en',
        },
      },
      serialize(item) {
        const lastmod = lastmodByUrl[item.url];
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
