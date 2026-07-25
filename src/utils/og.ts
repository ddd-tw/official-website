import ogImages from '../data/og-images.json';

/**
 * 取得某個路徑的分享縮圖路徑。
 *
 * 對照表由 `scripts/build-og-image.py` 產生（每頁一張 1200×630）。查不到就退回
 * 全站預設圖 —— 新頁面或新文章還沒重跑腳本時不會變成破圖。
 */
export function ogImageFor(pathname: string, locale: string = 'zh'): string {
  const path = pathname.replace(/\/?$/, '/');
  const table = ogImages as Record<string, string>;
  return table[path] ?? (locale === 'zh' ? '/og-image.png' : '/og-image-en.png');
}
