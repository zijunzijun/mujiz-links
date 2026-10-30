import { SiteContent } from './types';

export type Language = 'zh' | 'en';
const translated = (english: string | undefined, original: string) => english?.trim() ? english : original;

export function localizeContent(content: SiteContent, language: Language): SiteContent {
  if (language === 'zh') return content;
  return {
    ...content,
    profile: { ...content.profile, name: translated(content.profile.nameEn, content.profile.name), bio: translated(content.profile.bioEn, content.profile.bio) },
    links: content.links.map(link => link.type === 'heading'
      ? { ...link, title: translated(link.titleEn, link.title) }
      : { ...link, title: translated(link.titleEn, link.title), imageUrl: translated(link.imageUrlEn, link.imageUrl || '') }),
    banners: content.banners.map(banner => ({ ...banner, imageUrl: translated(banner.imageUrlEn, banner.imageUrl), imageAlt: translated(banner.imageAltEn, banner.imageAlt) })),
  };
}

export function initialLanguage(): Language {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'en' || requested === 'zh') return requested;
  try { if (localStorage.getItem('mujiz-language') === 'en') return 'en'; } catch {}
  return 'zh';
}
