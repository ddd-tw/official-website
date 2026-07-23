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
    'nav.me': '我的旅程',
    'footer.privacy': '隱私權政策',
    'footer.coc': '行為準則',
    'site.description':
      'DDD Taiwan 是社群驅動的學習平台 — 從領域驅動設計出發，深入系統與軟體設計，解決複雜商業問題，以去中心化的方式分享知識。',
  },
  en: {
    'nav.home': 'Home',
    'nav.events': 'Events',
    'nav.knowledge': 'Knowledge',
    'nav.community': 'Community',
    'nav.governance': 'Governance',
    'nav.me': 'My Journey',
    'footer.privacy': 'Privacy Policy',
    'footer.coc': 'Code of Conduct',
    'site.description':
      'DDD Taiwan is a community-driven platform for going deeper into systems and software design — solving complex business problems and sharing knowledge in a decentralised way.',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function useTranslations(locale: Locale) {
  return function t(key: keyof (typeof ui)['zh']): string {
    return ui[locale][key] ?? ui[defaultLocale][key];
  };
}
