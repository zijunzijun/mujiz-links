import React from 'react';
import * as Icons from 'lucide-react';
import { INITIAL_LINKS, INITIAL_PROFILE, THEMES } from './constants';

// Helper to resolve icon string to component
const IconResolver = ({ name, className }: { name: string; className?: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (Icons as any)[name] || Icons.Link;
  return <LucideIcon className={className} />;
};

const App: React.FC = () => {
  // Directly use the data from constants.ts
  // This makes the app purely static. To change content, edit constants.ts
  const profile = INITIAL_PROFILE;
  const links = INITIAL_LINKS;
  const theme = THEMES[profile.theme];

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 ${theme.background} ${theme.text} flex flex-col items-center relative overflow-x-hidden`}>
      
      <div className="w-full max-w-md px-6 py-12 pb-24 flex flex-col items-center">
        
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

        {/* Links List */}
        <div className="w-full space-y-4">
            {links.filter(l => l.isActive).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  block w-full py-4 px-6 rounded font-medium text-center transition-all duration-300
                  flex items-center justify-center gap-3 relative
                  border border-gray-900
                  hover:-translate-y-px
                  ${theme.buttonBg}
                  ${theme.buttonText}
                  ${theme.buttonHover}
                `}
              >
                <span className="absolute left-6 opacity-70">
                   <IconResolver name={link.icon || 'Link'} className="w-5 h-5" />
                </span>
                <span>{link.title}</span>
              </a>
            ))}

            {links.filter(l => l.isActive).length === 0 && (
                <div className="text-center opacity-60 py-10">
                    暫無公開連結
                </div>
            )}
            
            {/* Social Icons Footer */}
            <div className="mt-12 flex justify-center gap-6 opacity-70">
                <a href="https://www.instagram.com/mujiz.today" className="hover:scale-110 transition-transform"><Icons.Instagram className="w-6 h-6" /></a>
                <a href="https://www.facebook.com/mujiz.today" className="hover:scale-110 transition-transform"><Icons.Facebook className="w-6 h-6" /></a>
                <a href="mailto:mujiz.today@gmail.com.com" className="hover:scale-110 transition-transform"><Icons.Mail className="w-6 h-6" /></a>
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