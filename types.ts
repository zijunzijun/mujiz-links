export interface LinkItem {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
  icon?: string; // We will map string names to Lucide icons
}

export interface UserProfile {
  name: string;
  bio: string;
  avatarUrl: string;
  theme: 'light' | 'dark' | 'gradient';
}

export interface ThemeConfig {
  background: string;
  text: string;
  cardBg: string;
  buttonBg: string;
  buttonText: string;
  buttonHover: string;
}