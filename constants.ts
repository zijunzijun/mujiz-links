import { UserProfile, LinkItem, ThemeConfig } from './types';

export const INITIAL_PROFILE: UserProfile = {
  name: 'Mujiz.Today',
  bio: '做有營養的內容 ✨\n如果喜歡我創作的內容，\n歡迎請我喝杯咖啡。🧋',
  avatarUrl: 'https://scontent.fpen1-1.fna.fbcdn.net/v/t39.30808-6/398663292_122134989938018904_6206254094588325684_n.jpg?_nc_cat=109&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=iAnxA3SnpLsQ7kNvwHs8fS9&_nc_oc=AdnaL_JAex7nKCdLERn2KVyB_YR9Nr6OWQ-6X4XxVa4qRnarRutLqJDTHpD44mzbmcBAk0uOYEmp58u8kM5oXsYY&_nc_zt=23&_nc_ht=scontent.fpen1-1.fna&_nc_gid=9V2bnHQkS8asvHAPNAUEzg&oh=00_AfphLX70N4SsfaXqKL7VoaNxh0n2Q_ztu6_kkMgaz86KCg&oe=696AB5B0',
  theme: 'light',
};

export const INITIAL_LINKS: LinkItem[] = [
  {
    id: '1',
    title: '請我喝杯咖啡',
    url: 'https://buymeacoffee.com/mujiz.today',
    isActive: true,
    icon: 'Coffee'
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