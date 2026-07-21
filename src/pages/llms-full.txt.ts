import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

// Full-text companion to /llms.txt — inlines the complete article bodies so an
// LLM or agent can ingest the community's writing without following links.
export async function GET(context: APIContext) {
  const base = (context.site?.toString() ?? 'https://ddd-tw.com/').replace(/\/$/, '');

  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const out: string[] = [];
  out.push('# DDD Taiwan — full article text');
  out.push('');
  out.push(
    '> Complete text of DDD Taiwan community articles. See ' +
      base +
      '/llms.txt for the curated index of pages, talks, events, and reading.'
  );
  out.push('');

  for (const p of posts) {
    const path = `${p.data.lang === 'en' ? '/en' : ''}/posts/${p.id}/`;
    out.push('---');
    out.push('');
    out.push(`# ${p.data.title}`);
    out.push('');
    out.push(
      `- URL: ${base}${path}\n- Author: ${p.data.author}\n- Published: ${p.data.pubDate
        .toISOString()
        .slice(0, 10)}\n- Language: ${p.data.lang === 'en' ? 'en' : 'zh-TW'}`
    );
    out.push('');
    out.push(p.body?.trim() ?? p.data.description);
    out.push('');
  }

  return new Response(out.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
