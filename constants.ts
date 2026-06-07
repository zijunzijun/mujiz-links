import { UserProfile, LinkItem, ThemeConfig } from './types';

export const INITIAL_PROFILE: UserProfile = {
  name: 'Mujiz.Today',
  bio: '做有營養的內容 ✨\n如果喜歡我創作的內容，\n歡迎請我喝杯咖啡。🧋',
  avatarUrl: 'https://zalcgxyjwlfkrgwydngc.supabase.co/storage/v1/object/public/assets/branding/avatar-mujiz-today.jpg',
  theme: 'light',
};

export const INITIAL_LINKS: LinkItem[] = [
  {
    id: '7',
    title: 'AorB | 信用卡對比工具',
    url: 'https://aorb.today/',
    isActive: true,
    icon: 'https://aorb.today/apple-icon.png'
  },
  {
    id: '2',
    title: 'Instagram（日常story轟炸）',
    url: 'https://www.instagram.com/mujiz.today',
    isActive: true,
    icon: 'Instagram'
  },
  {
    id: '3',
    title: 'Facebook（長篇內容發布）',
    url: 'https://www.facebook.com/mujiz.today/',
    isActive: true,
    icon: 'Facebook'
  },
  {
    id: '4',
    title: '小紅書（長篇內容發布）',
    url: 'https://xhslink.com/m/7YHroR60gFS',
    isActive: true,
    icon: 'BookMarked'
  },
  {
    id: '5',
    title: '小紅書（生活好物日常分享）',
    url: 'https://xhslink.com/m/7YHroR60gFS',
    isActive: true,
    icon: 'BookMarked'
  },
  {
    id: '6',
    title: '馬來西亞機場停車費計算器小工具',
    url: 'https://parking.mujiz.today/',
    isActive: true,
    icon: 'SquareParking'
  },
  {
    id: '1',
    title: '請我喝杯咖啡',
    url: 'https://buymeacoffee.com/mujiz.today',
    isActive: true,
    icon: 'Coffee'
  }
];

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