import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { SITE_CONTENT, THEMES } from './constants';
import { SiteContent } from './types';

import PromoBanners from './components/PromoBanners';
import { initialLanguage, Language, localizeContent } from './i18n';
import './language.css';

// Helper to resolve icon string to component or image URL
const IconResolver = ({ name, className }: { name: string; className?: string }) => {
  if (name && (name.startsWith('http://') || name.startsWith('https://') || name.startsWith('/'))) {
    // Make image icons slightly larger (w-8 h-8 / 32px) for better visibility
    const imgClassName = className ? className.replace('w-5 h-5', 'w-8 h-8') : 'w-8 h-8';
    return <img src={name} alt="" className={`${imgClassName} object-contain rounded-sm`} />;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (Icons as any)[name] || Icons.Link;
  return <LucideIcon className={className} />;
};

const App: React.FC<{ content?: SiteContent; previewLanguage?: Language }> = ({ content = SITE_CONTENT, previewLanguage }) => {
  const [language, setLanguage] = useState<Language>(() => previewLanguage || initialLanguage());
  useEffect(() => { if (previewLanguage) setLanguage(previewLanguage); }, [previewLanguage]);
  useEffect(() => { document.documentElement.lang = language === 'en' ? 'en' : 'zh-Hant'; }, [language]);
  const changeLanguage = (next: Language) => {
    setLanguage(next);
    if (previewLanguage) return;
    try { localStorage.setItem('mujiz-language', next); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(null, '', url);
  };
  const { profile, links, banners, socials } = localizeContent(content, language);
  const theme = THEMES[profile.theme] || THEMES.light;
  useEffect(() => {
    document.title = language === 'en' ? `${profile.name} | Links & Tools` : `${profile.name}｜Mujiz今天買什麼`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', profile.bio.replace(/\n/g, ' '));
  }, [language, profile.name, profile.bio]);

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 ${theme.background} ${theme.text} flex flex-col items-center relative overflow-x-hidden`}>
      
      <div className="w-full max-w-md px-6 py-12 pb-24 flex flex-col items-center">
        
        <div className="site-language" role="group" aria-label="Language / 語言">
          <button type="button" lang="zh-Hant" aria-pressed={language === 'zh'} onClick={() => changeLanguage('zh')}>中文</button>
          <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => changeLanguage('en')}>EN</button>
        </div>

        {/* Profile Section */}
        <div className="flex flex-col items-center text-center mb-8 w-full">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/30 shadow-xl mb-4 relative group">
             <img 
               src={profile.avatarUrl} 
               alt={profile.name} 
               className="w-full h-full object-cover"
             />
          </div>
          <h1 className="text-2xl font-bold mb-2 tracking-tight">{profile.name}</h1>
          <p className={`text-sm opacity-90 leading-relaxed max-w-xs whitespace-pre-line`}>
            {profile.bio}
          </p>
        </div>

        <PromoBanners banners={banners} language={language} />

        {/* Links List */}
        <div className="w-full space-y-4">
            {links.filter(l => l.isActive).map((link) => (
              link.type === 'heading' ? <h2 key={link.id} className="site-link-heading"><span>{link.title}</span></h2> : <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  block w-full rounded overflow-hidden font-medium text-center transition-all duration-300
                  border border-gray-900
                  hover:-translate-y-px
                  ${theme.buttonBg}
                  ${theme.buttonText}
                  ${theme.buttonHover}
                `}
              >
                {link.imageUrl?.trim() && <img key={link.imageUrl} src={link.imageUrl} alt="" loading="lazy" className="site-link-image" onError={event => { event.currentTarget.style.display = 'none'; }} />}
                <span className="site-link-label">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 opacity-70">
                   <IconResolver name={link.icon || 'Link'} className="w-5 h-5" />
                </span>
                <span>{link.title}</span>
                </span>
              </a>
            ))}

            {links.filter(l => l.isActive).length === 0 && (
                <div className="text-center opacity-60 py-10">
                    {language === 'en' ? 'No public links yet' : '暫無公開連結'}
                </div>
            )}
            
            {/* Social Icons Footer */}
            <div className="mt-12 flex justify-center gap-6 opacity-70">
                {socials.instagram && <a href={socials.instagram} aria-label="Instagram" className="hover:scale-110 transition-transform"><Icons.Instagram className="w-6 h-6" /></a>}
                {socials.facebook && <a href={socials.facebook} aria-label="Facebook" className="hover:scale-110 transition-transform"><Icons.Facebook className="w-6 h-6" /></a>}
                {socials.email && <a href={`mailto:${socials.email}`} aria-label="Email" className="hover:scale-110 transition-transform"><Icons.Mail className="w-6 h-6" /></a>}
            </div>
            
            <footer className="mt-12 text-xs text-center opacity-50 font-light">
                © Mujiz.Today
            </footer>
        </div>
      </div>
    </div>
  );
};

export default App;