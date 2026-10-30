import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import { SITE_CONTENT } from '../constants';
import { SiteContent } from '../types';
import { Language } from '../i18n';
function Preview() {
  const [content, setContent] = useState<SiteContent>(SITE_CONTENT);
  const [language, setLanguage] = useState<Language>('zh');
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === location.origin && event.source === parent && event.data?.type === 'mujiz-preview') {
        setContent(event.data.content);
        setLanguage(event.data.language === 'en' ? 'en' : 'zh');
      }
    };
    window.addEventListener('message', receive);
    parent.postMessage({ type: 'mujiz-preview-ready' }, location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <div onClickCapture={event => { if ((event.target as Element).closest('a')) event.preventDefault(); }}><App content={content} previewLanguage={language} /></div>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Preview />);
