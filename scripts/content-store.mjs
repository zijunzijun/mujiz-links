import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

export class ContentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = message => { throw new ContentError(message); };
const object = (value, name) => { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} 格式不正確`); return value; };
const string = (value, name, max = 2000, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${name} 不完整或過長`);
  return value;
};
const url = (value, name, image = false, optional = false) => {
  string(value, name, 3000, !optional);
  if (!value && optional) return value;
  if (image && /^\/(?:uploads|banners)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) fail(`${name} 不能包含登入資料`);
    if (['https:', 'http:'].includes(parsed.protocol) || (!image && parsed.protocol === 'mailto:')) return value;
  } catch {}
  fail(`${name} 請使用完整的 HTTP(S) 網址${image ? '，或 /uploads/、/banners/ 圖片路徑' : ''}`);
};
const optionalText = (value, key, name, max) => value === undefined ? {} : { [key]: string(value, name, max) };
const optionalImage = (value, key, name) => value === undefined ? {} : { [key]: url(value, name, true, true) };
export function validateContent(input) {
  const data = object(input, '內容');
  const p = object(data.profile, '個人資料');
  if (!['light', 'dark', 'gradient'].includes(p.theme)) fail('主題不正確');
  const profile = { name: string(p.name, '名稱', 100, true), bio: string(p.bio, '簡介', 2000), avatarUrl: url(p.avatarUrl, '頭像圖片', true), theme: p.theme, ...optionalText(p.nameEn, 'nameEn', '英文名稱', 100), ...optionalText(p.bioEn, 'bioEn', '英文簡介', 2000) };
  const list = (items, name, mapper) => {
    if (!Array.isArray(items) || items.length > 100) fail(`${name} 最多 100 筆`);
    const ids = new Set();
    return items.map(item => {
      object(item, name);
      const id = string(item.id, `${name} ID`, 100, true);
      if (ids.has(id)) fail(`${name} ID 重複`);
      ids.add(id);
      if (typeof item.isActive !== 'boolean') fail(`${name} 顯示狀態不正確`);
      return { id, ...mapper(item), isActive: item.isActive };
    });
  };
  const links = list(data.links, '連結', item => {
    if (item.type !== undefined && !['link', 'heading'].includes(item.type)) fail('連結項目類型不正確');
    const text = { title: string(item.title, item.type === 'heading' ? '標題' : '連結名稱', 200, true), ...optionalText(item.titleEn, 'titleEn', '英文標題或連結名稱', 200) };
    if (item.type === 'heading') return { type: 'heading', ...text };
    const icon = string(item.icon ?? '', '圖示', 3000);
    if (icon && !/^[A-Za-z][A-Za-z0-9]*$/.test(icon)) url(icon, '圖示圖片', true);
    return { ...text, url: url(item.url, '連結網址'), icon, ...optionalImage(typeof item.imageUrl === 'string' ? item.imageUrl.trim() : item.imageUrl, 'imageUrl', '連結圖片'), ...optionalImage(typeof item.imageUrlEn === 'string' ? item.imageUrlEn.trim() : item.imageUrlEn, 'imageUrlEn', '英文連結圖片'), ...(item.type === 'link' ? { type: 'link' } : {}) };
  });
  const banners = list(data.banners, 'Banner', item => ({ imageUrl: url(item.imageUrl, 'Banner 圖片', true), imageAlt: string(item.imageAlt, '圖片說明', 200, true), url: url(item.url, 'Banner 連結'), ...optionalImage(item.imageUrlEn, 'imageUrlEn', '英文 Banner 圖片'), ...optionalText(item.imageAltEn, 'imageAltEn', '英文圖片說明', 200) }));
  const s = object(data.socials, '社群資料');
  const email = string(s.email, 'Email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Email 格式不正確');
  return { profile, links, banners, socials: { instagram: url(s.instagram, 'Instagram 網址', false, true), facebook: url(s.facebook, 'Facebook 網址', false, true), email } };
}
const revisionOf = text => createHash('sha256').update(text).digest('hex');
export function createStore(root) {
  const file = path.join(root, 'content.json');
  const backups = path.join(root, '.portal-backups');
  let queue = Promise.resolve();
  const read = async () => {
    const raw = await readFile(file, 'utf8');
    return { content: validateContent(JSON.parse(raw)), revision: revisionOf(raw) };
  };
  const save = (input, revision) => {
    const task = queue.then(async () => {
      const content = validateContent(input);
      const previous = await readFile(file, 'utf8');
      if (revision !== revisionOf(previous)) throw new ContentError('內容已被其他視窗或編輯器修改，請重新載入後再儲存。', 409);
      await mkdir(backups, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await writeFile(path.join(backups, `${stamp}-${randomUUID()}.json`), previous, { flag: 'wx' });
      const raw = JSON.stringify(content, null, 2) + '\n';
      const temp = path.join(root, `.portal-${randomUUID()}.tmp`);
      try { await writeFile(temp, raw, { flag: 'wx' }); await rename(temp, file); }
      finally { await unlink(temp).catch(() => {}); }
      const names = (await readdir(backups)).filter(name => name.endsWith('.json')).sort();
      await Promise.all(names.slice(0, -20).map(name => unlink(path.join(backups, name)).catch(() => {})));
      return { content, revision: revisionOf(raw), savedAt: new Date().toISOString() };
    });
    queue = task.catch(() => {});
    return task;
  };
  const upload = async (buffer, mime) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 8 * 1024 * 1024) fail('圖片需小於 8 MB');
    let ext;
    if (mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext = 'png';
    if (mime === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ext = 'jpg';
    if (mime === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') ext = 'webp';
    if (mime === 'image/gif' && /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) ext = 'gif';
    if (!ext) fail('請上傳有效的 PNG、JPG、WebP 或 GIF 圖片');
    const directory = path.join(root, 'public/uploads');
    await mkdir(directory, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(directory, name), buffer, { flag: 'wx' });
    return { url: `/uploads/${name}` };
  };
  return { read, save, upload };
}
