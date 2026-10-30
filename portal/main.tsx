import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { SiteContent } from '../types';
import { Language } from '../i18n';
import './portal.css';
import GitPublishDialog from './GitPublishDialog';

type Tab = 'profile' | 'links' | 'banners';
type Snapshot = { content: SiteContent; revision: string; savedAt?: string };
const headers = { 'Content-Type': 'application/json', 'X-Mujiz-Portal': '1' };
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '操作失敗，請重試');
  return data;
}
const uid = () => crypto.randomUUID();
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Portal() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [tab, setTab] = useState<Tab>('links');
  const [contentLanguage, setContentLanguage] = useState<Language>('zh');
  const editingEnglish = contentLanguage === 'en';
  const languageRef = useRef(contentLanguage); languageRef.current = contentLanguage;
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [gitBusy, setGitBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [wide, setWide] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const sortStart = useRef<{ x: number; y: number } | null>(null);
  const [deleted, setDeleted] = useState<{ kind: 'links' | 'banners'; item: SiteContent['links'][number] | SiteContent['banners'][number]; index: number } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const draftRef = useRef(draft); draftRef.current = draft;
  const dirty = !!draft && !!snapshot && JSON.stringify(draft) !== JSON.stringify(snapshot.content);
  const busy = saving || uploads > 0 || gitBusy;

  const load = async () => {
    setError(''); setSaving(true);
    try {
      const result = await request<Snapshot>('/api/portal/content');
      setSnapshot(result); setDraft(result.content); setDeleted(null); setMessage('已載入本地內容');
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (dirty || uploads || gitBusy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty, uploads, gitBusy]);
  const sendPreview = () => {
    if (draftRef.current) frame.current?.contentWindow?.postMessage({ type: 'mujiz-preview', content: draftRef.current, language: languageRef.current }, location.origin);
  };
  useEffect(() => { sendPreview(); }, [draft, contentLanguage]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin === location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'mujiz-preview-ready') sendPreview();
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draft || !snapshot || busy) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await request<Snapshot>('/api/portal/content', { method: 'PUT', headers, body: JSON.stringify({ content: draft, revision: snapshot.revision }) });
      setSnapshot(result); setDraft(result.content); setDeleted(null);
      setMessage(`已儲存至本地 · ${new Date(result.savedAt!).toLocaleTimeString('zh-TW')}。公開網站尚未更新。`);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };
  const upload = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('請選擇 8 MB 以內的 PNG、JPG、WebP 或 GIF 圖片'); return; }
    setUploads(value => value + 1);
    try {
      const result = await request<{ url: string }>('/api/portal/upload', { method: 'POST', headers: { 'Content-Type': file.type, 'X-Mujiz-Portal': '1' }, body: file });
      apply(result.url); setMessage('圖片已上傳至本地，請儲存內容以套用。');
    } catch (err) { setError((err as Error).message); }
    finally { setUploads(value => value - 1); }
  };
  const updateProfile = (key: string, value: string) => setDraft(old => old && ({ ...old, profile: { ...old.profile, [key]: value } }));
  const updateItem = (kind: 'links' | 'banners', id: string, key: string, value: string | boolean) => setDraft(old => old && ({ ...old, [kind]: old[kind].map(item => item.id === id ? { ...item, [key]: value } : item) }));
  const reorder = (kind: 'links' | 'banners', id: string, target: number) => setDraft(old => {
    if (!old) return old;
    const items = [...old[kind]]; const from = items.findIndex(item => item.id === id);
    if (from < 0 || target < 0 || target >= items.length) return old;
    items.splice(target, 0, items.splice(from, 1)[0]);
    return { ...old, [kind]: items };
  });
  const remove = (kind: 'links' | 'banners', id: string) => {
    if (!draft) return;
    const index = draft[kind].findIndex(item => item.id === id);
    setDeleted({ kind, index, item: draft[kind][index] });
    setDraft({ ...draft, [kind]: draft[kind].filter(item => item.id !== id) });
  };
  const undo = () => {
    if (!deleted) return;
    setDraft(old => {
      if (!old) return old;
      const list = [...old[deleted.kind]];
      list.splice(deleted.index, 0, deleted.item);
      return { ...old, [deleted.kind]: list };
    }); setDeleted(null);
  };
  const add = (kind: 'links' | 'banners', itemType: 'link' | 'heading' = 'link') => {
    setDraft(old => old && ({ ...old, [kind]: [...old[kind], kind === 'links'
      ? itemType === 'heading' ? { id: uid(), type: 'heading' as const, title: '', isActive: true } : { id: uid(), title: '', url: '', icon: 'Link', isActive: true }
      : { id: uid(), imageUrl: '', imageAlt: '', url: '', isActive: true }] }));
    setMessage('已新增，請填寫內容後儲存。');
  };
  const uploadInput = (label: string, apply: (url: string) => void) => (
    <label className="upload-button">上傳圖片<input type="file" aria-label={label} accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy}
      onChange={event => { void upload(event.target.files?.[0], apply); event.target.value = ''; }} /></label>
  );

  return <div className="portal-shell">
    {publishOpen && <GitPublishDialog onClose={() => setPublishOpen(false)} onBusy={setGitBusy} />}
    <aside className="sidebar"><a className="brand" href="/" target="_blank" rel="noreferrer"><span className="brand-mark">m.</span><span>Mujiz.Today<small>內容管理</small></span></a>
      <span className="local-tag"><i /> 本機工作空間</span>
      <nav aria-label="內容分類">{([['profile', '個人資料', '01'], ['links', '連結管理', '02'], ['banners', 'Banner 輪播', '03']] as const).map(([key, label, number]) => <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><span>{number}</span>{label}{key !== 'profile' && draft && <b>{draft[key].length}</b>}</button>)}</nav>
      <div className="sidebar-note"><strong>你的內容，自己掌握。</strong><p>資料儲存在專案裡。<br />編輯完成後，再部署到網站。</p><span>LOCAL PORTAL / 01</span></div>
    </aside>
    <main className="editor"><header className="toolbar"><div><span className={`save-state ${dirty ? 'dirty' : ''}`}><i />{dirty ? '有未儲存的變更' : '本地內容'}</span><p>編輯 → 預覽 → 儲存 → 部署</p></div><div className="toolbar-actions"><button type="button" className="secondary mobile-preview" onClick={() => document.querySelector('.preview-panel')?.scrollIntoView({ behavior: 'smooth' })}>看預覽</button><button type="button" className="secondary" disabled={busy} onClick={() => { if (!dirty || window.confirm('重新載入會捨棄未儲存的修改，確定繼續？')) void load(); }}>重新載入</button><button className="primary" form="content-form" disabled={busy || !dirty || !draft}>{saving ? '處理中…' : uploads ? '上傳中…' : '儲存變更'}<span>↗</span></button><button type="button" className="secondary git-open" disabled={busy || dirty || !draft} title={dirty ? '請先儲存內容' : '檢視變更與 commit 訊息'} onClick={() => setPublishOpen(true)}>提交並推送</button></div></header>
      {error && <div className="notice error" role="alert">{error}</div>}
      {message && <div className="notice" role="status">{message}</div>}
      {deleted && <div className="notice">已從草稿移除。<button type="button" onClick={undo}>復原刪除</button></div>}
      {!draft ? <div className="empty">{saving ? '正在載入內容…' : '無法載入。請確認透過 npm run portal 開啟，再按重新載入。'}</div> : <form id="content-form" onSubmit={save}><fieldset disabled={saving || publishOpen}>
        <div className="content-language" role="group" aria-label="編輯內容語言">
          <button type="button" aria-pressed={!editingEnglish} onClick={() => setContentLanguage('zh')}>中文內容</button>
          <button type="button" lang="en" aria-pressed={editingEnglish} onClick={() => setContentLanguage('en')}>English content</button>
        </div>
        <p className="translation-note">{editingEnglish ? '正在編輯英文版。英文欄位留空會沿用中文；網址、排序和顯示狀態由兩種語言共用。' : '中文是預設內容。切換 English content 可編輯英文翻譯，右側預覽會一起切換。'}</p>
        <div className="section-heading"><div><span className="eyebrow">YOUR CONTENT</span><h1>{tab === 'profile' ? '讓大家認識你。' : tab === 'links' ? '把好東西，連起來。' : '讓推薦，被看見。'}</h1><p>{tab === 'profile' ? '更新你的頭像、介紹與社群入口。' : tab === 'links' ? '新增標題來分隔區塊，拖動把手安排標題和連結的順序。' : '上傳 1200 × 630 圖片，設定點擊連結，依序輪播。'}</p></div>{tab !== 'profile' && <div className="add-actions"><button type="button" className="add-button" onClick={() => add(tab)}>＋ 新增{tab === 'links' ? '連結' : ' Banner'}</button>{tab === 'links' && <button type="button" className="add-button add-heading" onClick={() => add('links', 'heading')}>＋ 新增標題</button>}</div>}</div>
        {tab === 'profile' ? <div className="profile-fields">
          <div className="avatar-editor"><img src={draft.profile.avatarUrl} alt="目前頭像" /><div><strong>個人頭像</strong><p>建議使用正方形圖片</p>{uploadInput('上傳頭像', url => updateProfile('avatarUrl', url))}</div></div>
          <Field label="頭像網址"><input value={draft.profile.avatarUrl} required onChange={event => updateProfile('avatarUrl', event.target.value)} /></Field>
          <Field label={editingEnglish ? '顯示名稱（英文）' : '顯示名稱'}><input value={editingEnglish ? draft.profile.nameEn || '' : draft.profile.name} maxLength={100} required={!editingEnglish} placeholder={editingEnglish ? draft.profile.name : ''} onChange={event => updateProfile(editingEnglish ? 'nameEn' : 'name', event.target.value)} /></Field>
          <Field label={editingEnglish ? '個人簡介（英文）' : '個人簡介'}><textarea value={editingEnglish ? draft.profile.bioEn || '' : draft.profile.bio} placeholder={editingEnglish ? '留空沿用中文簡介' : ''} rows={5} maxLength={2000} onChange={event => updateProfile(editingEnglish ? 'bioEn' : 'bio', event.target.value)} /></Field>
          <Field label="頁面主題"><select value={draft.profile.theme} onChange={event => updateProfile('theme', event.target.value)}><option value="light">淺色</option><option value="dark">深色</option><option value="gradient">漸層</option></select></Field>
          <h2 className="subheading">頁尾社群入口</h2>
          {(['instagram', 'facebook', 'email'] as const).map(key => <Field key={key} label={key === 'email' ? 'Email' : key === 'instagram' ? 'Instagram' : 'Facebook'}><input type={key === 'email' ? 'email' : 'url'} value={draft.socials[key]} onChange={event => setDraft(old => old && ({ ...old, socials: { ...old.socials, [key]: event.target.value } }))} /></Field>)}
        </div> : <div className="item-list">
          {draft[tab].length === 0 && <div className="empty">還沒有{tab === 'links' ? '連結' : ' Banner'}。點擊右上角新增。</div>}
          {draft[tab].map((item, index) => <article key={item.id} data-sort-id={item.id} className={`item-card ${!item.isActive ? 'is-hidden' : ''} ${'title' in item && item.type === 'heading' ? 'heading-card' : ''} ${dragId === item.id ? 'is-sorting' : ''} ${dropId === item.id && dragId !== item.id ? 'is-drop-target' : ''}`}>
            <div className="item-toolbar"><button type="button" className="drag-handle" aria-label={`拖曳第 ${index + 1} 筆排序`}
              onPointerDown={event => {
                if (!event.isPrimary || event.button !== 0) return;
                event.preventDefault();
                sortStart.current = { x: event.clientX, y: event.clientY };
                setDragId(item.id); event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={event => {
                if (!sortStart.current) return;
                const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sort-id]');
                setDropId(target?.dataset.sortId || null);
                if (event.clientY > window.innerHeight - 50) window.scrollBy(0, 12);
                if (event.clientY < 50) window.scrollBy(0, -12);
              }}
              onPointerUp={event => {
                const start = sortStart.current;
                const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sort-id]');
                if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8 && target) {
                  const destination = draft[tab].findIndex(entry => entry.id === target.dataset.sortId);
                  reorder(tab, item.id, destination);
                }
                sortStart.current = null; setDragId(null); setDropId(null);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => { sortStart.current = null; setDragId(null); setDropId(null); }}
              onLostPointerCapture={() => { sortStart.current = null; setDragId(null); setDropId(null); }}>⠿</button><span className="item-number">{String(index + 1).padStart(2, '0')}</span>{'title' in item && item.type === 'heading' && <span className="item-kind">標題</span>}<label className="toggle"><input type="checkbox" checked={item.isActive} onChange={event => updateItem(tab, item.id, 'isActive', event.target.checked)} /><span>{item.isActive ? '顯示中' : '已隱藏'}</span></label><div className="item-actions"><button type="button" aria-label={`上移第 ${index + 1} 筆`} disabled={index === 0} onClick={() => reorder(tab, item.id, index - 1)}>↑</button><button type="button" aria-label={`下移第 ${index + 1} 筆`} disabled={index === draft[tab].length - 1} onClick={() => reorder(tab, item.id, index + 1)}>↓</button><button type="button" className="delete" onClick={() => remove(tab, item.id)}>刪除</button></div></div>
            {'title' in item ? <div className="item-fields"><Field label={item.type === 'heading' ? (editingEnglish ? '標題（英文）' : '標題') : (editingEnglish ? '連結名稱（英文）' : '連結名稱')}><input required={!editingEnglish} value={editingEnglish ? item.titleEn || '' : item.title} maxLength={200} placeholder={editingEnglish ? item.title || '留空沿用中文名稱' : item.type === 'heading' ? '例如：我的工具、社群平台、推薦優惠' : '例如：我的信用卡比較工具'} onChange={event => updateItem('links', item.id, editingEnglish ? 'titleEn' : 'title', event.target.value)} /></Field>{item.type !== 'heading' && <><Field label="點擊網址"><input required value={item.url} placeholder="https://…" onChange={event => updateItem('links', item.id, 'url', event.target.value)} /></Field><Field label="圖示" hint="Lucide 圖示名稱（如 Instagram、Coffee、Link），或圖片網址。"><input value={item.icon || ''} onChange={event => updateItem('links', item.id, 'icon', event.target.value)} /></Field>
              <Field label={editingEnglish ? '連結圖片網址（英文，選填）' : '連結圖片網址（選填）'} hint={editingEnglish ? '留空沿用中文圖片；中英文圖片都留空時不顯示圖片。' : '留空不顯示圖片；英文版可另外設定圖片，未設定時沿用這張圖片。'}><input value={editingEnglish ? item.imageUrlEn || '' : item.imageUrl || ''} placeholder={editingEnglish ? item.imageUrl || 'https://… 或 /uploads/…' : 'https://… 或 /uploads/…'} onChange={event => updateItem('links', item.id, editingEnglish ? 'imageUrlEn' : 'imageUrl', event.target.value)} /></Field>
              {uploadInput(`上傳第 ${index + 1} 筆${editingEnglish ? '英文' : ''}連結圖片`, url => updateItem('links', item.id, editingEnglish ? 'imageUrlEn' : 'imageUrl', url))}
              {(editingEnglish ? item.imageUrlEn?.trim() || item.imageUrl?.trim() : item.imageUrl?.trim()) && <div className="link-image-editor"><img key={editingEnglish && item.imageUrlEn?.trim() || item.imageUrl} src={editingEnglish && item.imageUrlEn?.trim() || item.imageUrl} alt="連結圖片預覽" onError={event => { event.currentTarget.style.display = 'none'; }} />{(editingEnglish ? item.imageUrlEn?.trim() : item.imageUrl?.trim()) && <button type="button" className="secondary" onClick={() => updateItem('links', item.id, editingEnglish ? 'imageUrlEn' : 'imageUrl', '')}>{editingEnglish ? '移除英文圖片' : '移除圖片'}</button>}</div>}

            </>}{item.type === 'heading' && <small className="heading-help">標題會以分隔文字顯示，不包含點擊連結。</small>}</div>
            : <div className="item-fields"><div className="banner-image">{(editingEnglish && item.imageUrlEn || item.imageUrl) ? <img src={editingEnglish && item.imageUrlEn || item.imageUrl} alt={item.imageAlt || 'Banner 預覽'} /> : <span>在這裡放上你的推廣圖<small>1200 × 630 · PNG / JPG / WebP / GIF</small></span>}</div>{uploadInput(`上傳第 ${index + 1} 張${editingEnglish ? '英文' : ''} Banner`, url => updateItem('banners', item.id, editingEnglish ? 'imageUrlEn' : 'imageUrl', url))}<Field label={editingEnglish ? '英文圖片網址（選填）' : '圖片網址'} hint={editingEnglish ? '留空沿用中文圖片；若圖片內有文字，可另外上傳英文版。' : undefined}><input required={!editingEnglish} value={editingEnglish ? item.imageUrlEn || '' : item.imageUrl} placeholder={editingEnglish ? item.imageUrl : '上傳圖片，或貼上圖片網址'} onChange={event => updateItem('banners', item.id, editingEnglish ? 'imageUrlEn' : 'imageUrl', event.target.value)} /></Field><Field label={editingEnglish ? '圖片說明（英文）' : '圖片說明'} hint="供螢幕閱讀器辨識，不會顯示在圖片上。"><input required={!editingEnglish} value={editingEnglish ? item.imageAltEn || '' : item.imageAlt} maxLength={200} placeholder={editingEnglish ? item.imageAlt : ''} onChange={event => updateItem('banners', item.id, editingEnglish ? 'imageAltEn' : 'imageAlt', event.target.value)} /></Field><Field label="點擊網址"><input required value={item.url} placeholder="https://…" onChange={event => updateItem('banners', item.id, 'url', event.target.value)} /></Field></div>}
          </article>)}
        </div>}
        <div className="editor-footnote">儲存時自動備份前一版，保留最近 20 次。公開網站需另外部署。</div>
      </fieldset></form>}
    </main>
    <aside className={`preview-panel ${wide ? 'wide' : ''}`}><div className="preview-heading"><div><span className="eyebrow">LIVE PREVIEW</span><h2>看起來如何？</h2></div><button type="button" className="secondary" onClick={() => setWide(value => !value)}>{wide ? '手機' : '寬版'}</button></div><p className="preview-note">即時呈現草稿 · 預覽內不會開啟外部連結</p><div className="device-frame"><div className="device-bar"><span />mujiz.today</div><iframe ref={frame} src="/portal/preview.html" title="網站即時預覽" onLoad={sendPreview} /></div><div className="preview-caption"><i /> 只更新預覽，尚未發布</div></aside>
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Portal />);
