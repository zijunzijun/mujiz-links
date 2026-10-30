import { SiteContent, ThemeConfig } from './types';
import content from './content.json';

export const SITE_CONTENT = content as SiteContent;
export const INITIAL_PROFILE = SITE_CONTENT.profile;
export const INITIAL_LINKS = SITE_CONTENT.links;
export const PROMO_BANNERS = SITE_CONTENT.banners;

export const THEMES: Record<string, ThemeConfig> = {
  light: {
    background: 'bg-gray-50',
    text: 'text-gray-900',
    cardBg: 'bg-white',
    buttonBg: 'bg-white border border-gray-200',
    buttonText: 'text-gray-900',
    buttonHover: 'hover:bg-gray-50 hover:scale-[1.02] transition-transform',
  },
  dark: {
    background: 'bg-gray-900',
    text: 'text-white',
    cardBg: 'bg-gray-800',
    buttonBg: 'bg-gray-800 border border-gray-700',
    buttonText: 'text-white',
    buttonHover: 'hover:bg-gray-700 hover:scale-[1.02] transition-transform',
  },
  gradient: {
    background: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500',
    text: 'text-white',
    cardBg: 'bg-white/10 backdrop-blur-md border border-white/20',
    buttonBg: 'bg-white/20 backdrop-blur-sm border border-white/30',
    buttonText: 'text-white',
    buttonHover: 'hover:bg-white/30 hover:scale-[1.02] transition-transform',
  }
};