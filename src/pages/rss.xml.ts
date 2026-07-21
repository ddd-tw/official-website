import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'DDD Taiwan',
    description:
      'DDD Taiwan — a community-driven platform for domain-driven design, systems and software design. Articles, talks, and community writing.',
    site: context.site ?? 'https://ddd-tw.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      author: post.data.author,
      categories: post.data.tags,
      link: `${post.data.lang === 'en' ? '/en' : ''}/posts/${post.id}/`,
    })),
    customData: `<language>zh-TW</language>`,
  });
}
