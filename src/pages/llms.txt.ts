import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

// https://llmstxt.org/ — a curated, machine-friendly index of the site for
// LLMs and agents. Kept in sync with the content collections at build time.
export async function GET(context: APIContext) {
  const base = (context.site?.toString() ?? 'https://ddd-tw.com/').replace(/\/$/, '');

  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  const events = (await getCollection('events')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );
  const videos = await getCollection('videos');
  const books = await getCollection('books');

  const lines: string[] = [];
  lines.push('# DDD Taiwan');
  lines.push('');
  lines.push(
    '> DDD Taiwan (Domain-Driven Design Taiwan) is a community-driven platform for ' +
      'domain-driven design, systems and software design. It runs meetups, an annual ' +
      'conference, and a book club, and curates a knowledge base of books, articles, ' +
      'and recorded talks — sharing knowledge in a decentralised way.'
  );
  lines.push('');
  lines.push('- Site: ' + base + '/');
  lines.push('- Languages: Traditional Chinese (zh-TW), English (/en/)');
  lines.push('- Contact: dddtw2018@gmail.com · Conference: conference@ddd-tw.com');
  lines.push('');

  lines.push('## Key pages');
  lines.push(`- [Home](${base}/): what DDD Taiwan is and how to get involved`);
  lines.push(`- [Events](${base}/events/): meetups, annual conference, and book club`);
  lines.push(`- [Knowledge base](${base}/knowledge/): recommended books, articles, and talks`);
  lines.push(`- [Community](${base}/community/): how the community is organised and how to join`);
  lines.push(`- [Governance](${base}/governance/): principles, privacy policy, and code of conduct`);
  lines.push('');

  if (posts.length) {
    lines.push('## Articles');
    for (const p of posts) {
      const path = `${p.data.lang === 'en' ? '/en' : ''}/posts/${p.id}/`;
      lines.push(`- [${p.data.title}](${base}${path}): ${p.data.description}`);
    }
    lines.push('');
  }

  lines.push('## Talks & interviews');
  for (const v of videos) {
    const note = v.data.highlight ? `: ${v.data.highlight}` : '';
    lines.push(`- [${v.data.title}](${v.data.url})${note}`);
  }
  lines.push('');

  lines.push('## Events');
  for (const e of events) {
    const d = e.data.date.toISOString().slice(0, 10);
    const link = e.data.link ?? `${base}/events/`;
    lines.push(`- ${d} — [${e.data.title}](${link}) (${e.data.type})`);
  }
  lines.push('');

  lines.push('## Recommended reading');
  for (const b of books) {
    const link = b.data.url ?? `${base}/knowledge/`;
    lines.push(`- [${b.data.title}](${link}) — ${b.data.author} (${b.data.year})`);
  }
  lines.push('');

  lines.push('## Community & links');
  lines.push('- [GitHub](https://github.com/ddd-tw)');
  lines.push('- [YouTube](https://www.youtube.com/channel/UCydw7dbEksG3axEMjHy4BxQ)');
  lines.push('- [Facebook page](https://www.facebook.com/DDDCommunity.tw/)');
  lines.push('- [Facebook group](https://www.facebook.com/groups/dddesigntw)');
  lines.push('- [Instagram](https://www.instagram.com/ddd_twig/)');
  lines.push('- [Meetup](https://www.meetup.com/domain-driven-design-taiwan-meetup-group/)');
  lines.push('- [X / Twitter](https://x.com/DddTaiwan)');
  lines.push('- [Full content for LLMs](' + base + '/llms-full.txt)');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
