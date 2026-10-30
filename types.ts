interface LinkItemBase {
  id: string;
  title: string;
  titleEn?: string;
  isActive: boolean;
}

export type LinkItem = LinkItemBase & (
  | { type?: 'link'; url: string; icon?: string; imageUrl?: string; imageUrlEn?: string }
  | { type: 'heading'; url?: never; icon?: never; imageUrl?: never; imageUrlEn?: never }
);

export interface UserProfile {
  name: string;
  nameEn?: string;
  bio: string;
  bioEn?: string;
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

export interface PromoBanner {
  id: string;
  url: string;
  isActive: boolean;
  imageUrl: string;
  imageAlt: string;
  imageUrlEn?: string;
  imageAltEn?: string;
}

export interface SiteContent {
  profile: UserProfile;
  links: LinkItem[];
  banners: PromoBanner[];
  socials: { instagram: string; facebook: string; email: string };
}
