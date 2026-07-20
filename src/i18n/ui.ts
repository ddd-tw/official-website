export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

export const ui = {
  zh: {
    'nav.home': '首頁',
    'nav.events': '參與活動',
    'nav.knowledge': '知識庫',
    'nav.community': '社群',
    'nav.governance': '治理',
    'footer.privacy': '隱私權政策',
    'footer.coc': '行為準則',
    'site.description':
      'DDD Taiwan 致力於在台灣推廣領域驅動設計，透過 Meetup、讀書會與年會，一起探索從問題領域催生出解決方案。',
  },
  en: {
    'nav.home': 'Home',
    'nav.events': 'Events',
    'nav.knowledge': 'Knowledge',
    'nav.community': 'Community',
    'nav.governance': 'Governance',
    'footer.privacy': 'Privacy Policy',
    'footer.coc': 'Code of Conduct',
    'site.description':
      'DDD Taiwan promotes Domain-Driven Design in Taiwan through meetups, book clubs, and an annual conference.',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function useTranslations(locale: Locale) {
  return function t(key: keyof (typeof ui)['zh']): string {
    return ui[locale][key] ?? ui[defaultLocale][key];
  };
}
