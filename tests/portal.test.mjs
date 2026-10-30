import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore, validateContent } from '../scripts/content-store.mjs';
const fixture = {
  profile: { name: '測試', bio: '保留換行\n第二行', avatarUrl: 'https://example.com/avatar.png', theme: 'light' },
  links: [{ id: 'link-1', title: '測試連結', url: 'https://example.com/', icon: 'Coffee', isActive: true }],
  banners: [{ id: 'banner-1', imageUrl: '/uploads/banner.png', imageAlt: '測試圖片', url: 'https://example.com/', isActive: false }],
  socials: { instagram: '', facebook: '', email: '' },
};
async function temporary(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mujiz-portal-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'content.json'), JSON.stringify(fixture));
  return { directory, store: createStore(directory) };
}
test('保留內容、換行、排序及隱藏狀態', () => {
  assert.deepEqual(validateContent(fixture), fixture);
});
test('拒絕危險網址、重複 ID、非法路徑及錯誤資料', () => {
  for (const change of [
    data => data.links[0].url = 'javascript:alert(1)',
    data => data.banners[0].imageUrl = '/uploads/../../secret',
    data => data.banners[0].imageUrl = 'data:image/svg+xml,unsafe',
    data => data.links.push({ ...data.links[0] }),
    data => data.profile.theme = 'unknown',
    data => data.socials.email = 'invalid',
    data => data.links[0].isActive = 'yes',
  ]) {
    const data = structuredClone(fixture); change(data);
    assert.throws(() => validateContent(data));
  }
});
test('儲存可重新讀取，備份保留原始內容', async t => {
  const { directory, store } = await temporary(t);
  const original = await store.read();
  const changed = structuredClone(fixture); changed.profile.name = '已更新'; changed.links = [];
  const result = await store.save(changed, original.revision);
  assert.notEqual(result.revision, original.revision);
  assert.deepEqual((await store.read()).content, changed);
  const backups = await readdir(path.join(directory, '.portal-backups'));
  assert.equal(backups.length, 1);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, '.portal-backups', backups[0]), 'utf8')), fixture);
});
test('拒絕舊版本覆蓋及同時儲存衝突', async t => {
  const { store } = await temporary(t);
  const { revision } = await store.read();
  const data = structuredClone(fixture); data.profile.name = '新版本';
  const results = await Promise.allSettled([store.save(data, revision), store.save(fixture, revision)]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[1].reason.status, 409);
  assert.equal((await store.read()).content.profile.name, '新版本');
});
test('外部修改後拒絕儲存，不破壞檔案', async t => {
  const { directory, store } = await temporary(t);
  const { revision } = await store.read();
  const external = structuredClone(fixture); external.profile.bio = '外部修改';
  await writeFile(path.join(directory, 'content.json'), JSON.stringify(external));
  await assert.rejects(store.save(fixture, revision), { status: 409 });
  assert.deepEqual((await store.read()).content, external);
});
test('備份最多保留 20 版', async t => {
  const { directory, store } = await temporary(t);
  for (let index = 0; index < 22; index++) {
    const { content, revision } = await store.read();
    content.profile.name = `第 ${index} 版`;
    await store.save(content, revision);
  }
  assert.equal((await readdir(path.join(directory, '.portal-backups'))).length, 20);
});
test('上傳使用隨機檔名，拒絕 SVG、偽造 MIME 與超大圖片', async t => {
  const { directory, store } = await temporary(t);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64');
  const first = await store.upload(png, 'image/png');
  const second = await store.upload(png, 'image/png');
  assert.match(first.url, /^\/uploads\/[a-f0-9-]+\.png$/);
  assert.notEqual(first.url, second.url);
  assert.deepEqual(await readFile(path.join(directory, 'public', first.url)), png);
  await assert.rejects(store.upload(Buffer.from('<svg/>'), 'image/svg+xml'));
  await assert.rejects(store.upload(Buffer.from('<svg/>'), 'image/png'));
  await assert.rejects(store.upload(Buffer.alloc(8 * 1024 * 1024 + 1), 'image/png'));
});

test('英文內容與英文 Banner 圖片可儲存並重新讀取', async t => {
  const { store } = await temporary(t);
  const { content, revision } = await store.read();
  content.profile.nameEn = 'English name';
  content.profile.bioEn = 'English bio\nSecond line';
  content.links[0].titleEn = 'English link';
  content.banners[0].imageUrlEn = '/uploads/english.png';
  content.banners[0].imageAltEn = 'English image';
  await store.save(content, revision);
  assert.deepEqual((await store.read()).content, content);
});
test('英文翻譯欄位仍驗證長度、型別與圖片安全性', () => {
  for (const mutate of [
    data => data.profile.nameEn = 'a'.repeat(101),
    data => data.profile.bioEn = {},
    data => data.links[0].titleEn = 'a'.repeat(201),
    data => data.banners[0].imageUrlEn = 'javascript:alert(1)',
    data => data.banners[0].imageAltEn = null,
  ]) {
    const data = structuredClone(fixture); mutate(data);
    assert.throws(() => validateContent(data));
  }
  const optional = structuredClone(fixture);
  optional.banners[0].imageUrlEn = '';
  assert.equal(validateContent(optional).banners[0].imageUrlEn, '');
});
test('英文選擇使用翻譯、空白欄位回退中文，不修改原始資料', async () => {
  const { transpileModule, ModuleKind, ScriptTarget } = await import('typescript');
  const source = await readFile(new URL('../i18n.ts', import.meta.url), 'utf8');
  const js = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2020 } }).outputText;
  const { localizeContent } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const content = structuredClone(fixture);
  content.profile.nameEn = 'English';
  content.profile.bioEn = '  ';
  content.links[0].titleEn = 'English link';
  content.banners[0].imageUrlEn = '/uploads/en.png';
  const original = structuredClone(content);
  assert.equal(localizeContent(content, 'zh'), content);
  const english = localizeContent(content, 'en');
  assert.equal(english.profile.name, 'English');
  assert.equal(english.profile.bio, content.profile.bio);
  assert.equal(english.links[0].title, 'English link');
  assert.equal(english.banners[0].imageUrl, '/uploads/en.png');
  assert.equal(english.banners[0].imageAlt, content.banners[0].imageAlt);
  assert.equal(english.links[0].url, content.links[0].url);
  assert.deepEqual(content, original);
  assert.deepEqual(localizeContent(fixture, 'en').profile, fixture.profile);
});

test('分區標題不需要網址，可與連結混排並保留中英文及隱藏狀態', async t => {
  const { store } = await temporary(t);
  const { content, revision } = await store.read();
  content.links.unshift({ id: 'section-tools', type: 'heading', title: '我的工具', titleEn: 'My Tools', isActive: true });
  content.links.push({ id: 'section-social', type: 'heading', title: '社群平台', titleEn: 'Social', isActive: false });
  await store.save(content, revision);
  const saved = (await store.read()).content;
  assert.deepEqual(saved, content);
  assert.equal(saved.links[0].type, 'heading');
  assert.equal(saved.links[1].url, fixture.links[0].url);
  assert.equal(saved.links[2].isActive, false);
  assert.ok(!('url' in saved.links[0]));
});
test('拒絕空標題、未知項目類型；一般連結仍須有網址', () => {
  for (const item of [
    { id: 'empty', type: 'heading', title: ' ', isActive: true },
    { id: 'unknown', type: 'unknown', title: 'Test', url: 'https://example.com', isActive: true },
    { id: 'missing-url', type: 'link', title: 'Test', isActive: true },
  ]) {
    const data = structuredClone(fixture); data.links = [item];
    assert.throws(() => validateContent(data));
  }
  const data = structuredClone(fixture); data.links[0].type = 'link';
  assert.equal(validateContent(data).links[0].type, 'link');
});


test('連結圖片可儲存、清空及沿用既有未填圖片的資料', async t => {
  const { store } = await temporary(t);
  let state = await store.read();
  assert.ok(!('imageUrl' in state.content.links[0]));
  state.content.links[0].imageUrl = '/uploads/link-image.png';
  await store.save(state.content, state.revision);
  state = await store.read();
  assert.equal(state.content.links[0].imageUrl, '/uploads/link-image.png');
  state.content.links[0].imageUrl = '   ';
  await store.save(state.content, state.revision);
  assert.equal((await store.read()).content.links[0].imageUrl, '');
  for (const value of ['javascript:alert(1)', '/uploads/../secret', null]) {
    const data = structuredClone(fixture); data.links[0].imageUrl = value;
    assert.throws(() => validateContent(data));
  }
});


test('中英文連結圖片可分開儲存及清空，英文網址仍須通過驗證', async t => {
  const { store } = await temporary(t);
  let state = await store.read();
  state.content.links[0].imageUrl = '/uploads/zh.png';
  state.content.links[0].imageUrlEn = '/uploads/en.png';
  await store.save(state.content, state.revision);
  state = await store.read();
  assert.equal(state.content.links[0].imageUrl, '/uploads/zh.png');
  assert.equal(state.content.links[0].imageUrlEn, '/uploads/en.png');
  state.content.links[0].imageUrlEn = '   ';
  await store.save(state.content, state.revision);
  state = await store.read();
  assert.equal(state.content.links[0].imageUrlEn, '');
  assert.equal(state.content.links[0].imageUrl, '/uploads/zh.png');
  for (const value of ['javascript:alert(1)', '/uploads/../secret', null]) {
    state.content.links[0].imageUrlEn = value;
    assert.throws(() => validateContent(state.content));
  }
});
test('英文連結圖片優先使用英文；留空沿用中文，兩者都空則沒有圖片', async () => {
  const { transpileModule, ModuleKind, ScriptTarget } = await import('typescript');
  const source = await readFile(new URL('../i18n.ts', import.meta.url), 'utf8');
  const js = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2020 } }).outputText;
  const { localizeContent } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const content = structuredClone(fixture);
  content.links[0].imageUrl = '/uploads/zh.png';
  content.links[0].imageUrlEn = '/uploads/en.png';
  assert.equal(localizeContent(content, 'zh').links[0].imageUrl, '/uploads/zh.png');
  assert.equal(localizeContent(content, 'en').links[0].imageUrl, '/uploads/en.png');
  content.links[0].imageUrlEn = '  ';
  assert.equal(localizeContent(content, 'en').links[0].imageUrl, '/uploads/zh.png');
  delete content.links[0].imageUrlEn;
  assert.equal(localizeContent(content, 'en').links[0].imageUrl, '/uploads/zh.png');
  content.links[0].imageUrl = '';
  assert.equal(localizeContent(content, 'en').links[0].imageUrl, '');
  content.links[0].imageUrlEn = '/uploads/en-only.png';
  assert.equal(localizeContent(content, 'en').links[0].imageUrl, '/uploads/en-only.png');
  assert.equal(localizeContent(content, 'zh').links[0].imageUrl, '');
});
