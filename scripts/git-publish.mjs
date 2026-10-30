import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { ContentError, validateContent } from './content-store.mjs';
const exec = promisify(execFile);
const SOURCE_FILES = new Set(['.gitignore','App.tsx','README.md','constants.ts','package.json','package-lock.json','types.ts','i18n.ts','language.css','index.tsx','index.html','vite.config.ts','tsconfig.json','tsconfig.node.json','public/banners/sample.svg']);
const SOURCE_DIRS = ['components/','portal/','scripts/','tests/'];
const sourceAllowed = file => SOURCE_FILES.has(file) || (SOURCE_DIRS.some(dir => file.startsWith(dir)) && /\.(?:tsx?|mjs|css|html)$/.test(file));
const digest = value => createHash('sha256').update(value).digest('hex');
const cleanError = error => String(error.stderr || error.message || '').replace(/https?:\/\/[^\s]+/g, '[remote]').slice(0, 700);
export function suggestMessage(before, after, hasSource, imageCount) {
  if (hasSource) return 'feat: 更新連結頁與本機管理功能';
  if (!before) return 'content: 建立網站內容';
  const changes = [];
  if (JSON.stringify(before.profile) !== JSON.stringify(after.profile)) changes.push('個人資料');
  if (JSON.stringify(before.links) !== JSON.stringify(after.links)) changes.push('連結與標題');
  if (JSON.stringify(before.banners) !== JSON.stringify(after.banners)) changes.push('Banner');
  if (JSON.stringify(before.socials) !== JSON.stringify(after.socials)) changes.push('社群入口');
  if (imageCount) changes.push('圖片');
  return `content: 更新${changes.length ? changes.join('、') : '網站內容'}`;
}
export function createPublisher(root, options = {}) {
  let running = false;
  const git = (args, extra = {}) => exec('git', args, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, timeout: 45000, maxBuffer: 4 * 1024 * 1024, ...extra });
  const value = async args => (await git(args)).stdout.trim();
  const maybe = async args => { try { return await value(args); } catch { return ''; } };
  const executeChecks = options.checks || (async () => {
    await exec(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
    await exec(process.execPath, ['--test', 'tests/portal.test.mjs', 'tests/git-publish.test.mjs'], { cwd: root, timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
  });
  const context = async () => {
    const branch = await maybe(['symbolic-ref','--quiet','--short','HEAD']);
    if (!branch) throw new ContentError('目前不是一般分支，請先在 Git 切換到要推送的分支。', 409);
    const head = await value(['rev-parse','HEAD']);
    const remoteUrl = await maybe(['remote','get-url','--push','origin']);
    const pushUrls = (await maybe(['remote','get-url','--all','--push','origin'])).split('\n').filter(Boolean);
    const fetchUrl = await maybe(['remote','get-url','origin']);
    if (pushUrls.length !== 1 || fetchUrl !== remoteUrl) throw new ContentError('origin 的讀取與推送網址需一致，且只設定一個推送目的地；請先在 Git 確認設定。', 409);
    if (!remoteUrl || remoteUrl.startsWith('-') || /\r|\n/.test(remoteUrl)) throw new ContentError('請先設定有效的 origin 遠端。', 409);
    let remoteLabel = remoteUrl;
    try { const parsed = new URL(remoteUrl); parsed.username = ''; parsed.password = ''; parsed.search = ''; parsed.hash = ''; remoteLabel = parsed.toString(); } catch {}
    return { branch, head, remoteLabel };
  };
  const fetchRemote = async branch => {
    // Fetch without merging or changing the working branch. Force only updates the remote-tracking ref.
    await git(['fetch','--no-tags','origin',`+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  };
  const inspect = async (includeCode = false, checkRemote = true) => {
    const ctx = await context();
    let remoteChecked = !checkRemote;
    let warning = '';
    if (checkRemote) {
      try { await fetchRemote(ctx.branch); remoteChecked = true; }
      catch { warning = '無法查詢遠端，請檢查網路或 Git 登入後重新整理。'; }
    }
    const remoteHead = await maybe(['rev-parse',`refs/remotes/origin/${ctx.branch}`]);
    const pendingCommits = remoteHead ? (await value(['log','--format=%h %s',`refs/remotes/origin/${ctx.branch}..HEAD`])).split('\n').filter(Boolean) : [];
    let diverged = false;
    if (remoteHead) { try { await git(['merge-base','--is-ancestor',remoteHead,'HEAD']); } catch { diverged = true; } }
    const raw = (await git(['status','--porcelain=v1','-z','--untracked-files=all'])).stdout;
    const records = raw.split('\0').filter(Boolean);
    const entries = [];
    for (let index = 0; index < records.length; index++) {
      const status = records[index].slice(0,2); const file = records[index].slice(3);
      if (/[RC]/.test(status)) { entries.push({ path: file, status, renamed: true }); index++; }
      else entries.push({ path: file, status });
    }
    const hasStaged = !!(await value(['diff','--cached','--name-only']));
    const hasConflict = entries.some(entry => /U|AA|DD/.test(entry.status));
    const content = validateContent(JSON.parse(await readFile(path.join(root,'content.json'),'utf8')));
    const references = new Set();
    const visit = data => {
      if (typeof data === 'string' && /^\/(?:uploads|banners)\/[a-zA-Z0-9_./-]+$/.test(data) && !data.includes('..')) references.add('public' + data);
      else if (data && typeof data === 'object') Object.values(data).forEach(visit);
    }; visit(content);
    const firstSetup = !(await maybe(['cat-file','-t','HEAD:content.json']));
    const files = []; const excluded = [];
    for (const entry of entries) {
      const allowed = entry.path === 'content.json' || references.has(entry.path) || (includeCode && sourceAllowed(entry.path));
      if (!allowed || entry.renamed) { excluded.push(entry.path); continue; }
      const absolute = path.join(root,entry.path);
      let hash = 'deleted';
      if (!entry.status.includes('D')) {
        const info = await lstat(absolute);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 12 * 1024 * 1024) throw new ContentError(`無法提交此檔案：${entry.path}`,409);
        hash = digest(await readFile(absolute));
      }
      files.push({ ...entry, hash });
    }
    const blocked = hasConflict ? '請先解決 Git 合併衝突。' : hasStaged ? 'Git 暫存區已有內容，請先在 Git 處理，再回到 Portal。' : diverged ? '遠端有本機尚未包含的提交，請先手動同步分支。' : firstSetup && !includeCode ? '首次更新請選擇「包含程式修改」，讓網站能讀取新的內容格式。' : !remoteChecked ? warning : !remoteHead ? '遠端尚無同名分支，請先手動設定推送分支。' : '';
    let before;
    try { before = JSON.parse(await value(['show','HEAD:content.json'])); } catch {}
    const suggestedMessage = suggestMessage(before, content, files.some(file => sourceAllowed(file.path)), files.filter(file=>file.path.startsWith('public/')).length);
    const reviewId = digest(JSON.stringify({ ...ctx, remoteHead, files, includeCode, hasStaged, hasConflict, pendingCommits }));
    return { ...ctx, remoteHead, files, excluded, pendingCommits, firstSetup, blocked, suggestedMessage, reviewId, includeCode, canPublish: !blocked && (files.length > 0 || pendingCommits.length > 0) };
  };
  const review = async includeCode => {
    if (running) throw new ContentError('正在提交或推送，請稍候。',409);
    return inspect(includeCode === true);
  };
  const publish = async input => {
    if (running) throw new ContentError('正在提交或推送，請稍候。',409);
    running = true;
    let committed = false; let sha;
    try {
      const report = await inspect(input.includeCode === true);
      if (report.blocked) throw new ContentError(report.blocked,409);
      if (report.reviewId !== input.reviewId) throw new ContentError('檔案、分支或遠端已改變，請重新檢視變更後再提交。',409);
      if (!report.canPublish) throw new ContentError('沒有需要提交或推送的變更。');
      const message = typeof input.message === 'string' ? input.message.trim() : '';
      if (report.files.length && (!message || message.length > 200 || /[\r\n\x00-\x1f]/.test(message))) throw new ContentError('請輸入 1–200 字的單行 commit 訊息。');
      await executeChecks();
      const checked = await inspect(input.includeCode === true, false);
      if (checked.reviewId !== report.reviewId) throw new ContentError('檢查期間檔案已改變，請重新檢視變更。',409);
      if (report.files.length) {
        try { await git(['var','GIT_AUTHOR_IDENT']); await git(['var','GIT_COMMITTER_IDENT']); }
        catch { throw new ContentError('請先設定 Git user.name 與 user.email。'); }
        const paths = report.files.map(file=>file.path);
        try {
          await git(['add','--',...paths]);
          // Commit only reviewed paths, even if another Git client stages unrelated files meanwhile.
          await git(['commit','--only','-m',message,'--',...paths], { timeout: 60000 });
          committed = true;
        } catch (error) {
          await git(['reset','-q','HEAD','--',...paths]).catch(()=>{});
          throw new ContentError(`提交失敗，原檔案已保留。${cleanError(error)}`,409);
        }
      }
      sha = await value(['rev-parse','HEAD']);
      try {
        await git(['push','origin',`HEAD:refs/heads/${report.branch}`]);
        return { status:'pushed', commit:sha, message:'已提交並推送至 origin。網站是否自動部署，依現有部署設定而定。' };
      } catch (error) {
        return { status:'push-failed', commit:sha, message:`${committed ? '已建立 commit，但' : ''}推送失敗；本地提交已保留。請檢查網路、登入或遠端狀態，重新檢視後可重試推送。${cleanError(error)}` };
      }
    } finally { running = false; }
  };
  return { review, publish, isRunning: () => running };
}
