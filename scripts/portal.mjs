import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createStore, ContentError } from './content-store.mjs';
import { createPublisher } from './git-publish.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 5174;
const origin = `http://127.0.0.1:${port}`;
const store = createStore(root);
const publisher = createPublisher(root);
async function body(req, limit) {
  const parts = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ContentError('上傳內容過大', 413);
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port, strictPort: true, open: false },
  plugins: [{
    name: 'local-content-portal',
    configureServer(vite) {
      // Keep unsaved portal drafts intact when content.json is saved externally.
      vite.watcher.unwatch(path.join(root, 'content.json'));
      vite.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname === '/portal' || pathname === '/portal/') {
          res.writeHead(302, { Location: '/portal/index.html' }); res.end(); return;
        }
        if (!pathname.startsWith('/api/portal/')) return next();
        const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
        try {
          if (req.headers.host !== `127.0.0.1:${port}` || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw new ContentError('只允許本機存取', 403);
          if (req.headers.origin && req.headers.origin !== origin) throw new ContentError('不允許跨網站請求', 403);
          if (req.method === 'GET' && pathname === '/api/portal/content') return send(200, await store.read());
          if (req.headers.origin !== origin || req.headers['x-mujiz-portal'] !== '1') throw new ContentError('請從本機 Portal 操作', 403);
          if (req.method === 'POST' && ['/api/portal/git/review', '/api/portal/git/publish'].includes(pathname)) {
            if (!req.headers['content-type']?.startsWith('application/json')) throw new ContentError('請使用 JSON');
            const data = JSON.parse((await body(req, 16384)).toString('utf8'));
            if (pathname.endsWith('/review')) return send(200, await publisher.review(data.includeCode));
            return send(200, await publisher.publish(data));
          }
          if (publisher.isRunning()) throw new ContentError('正在提交或推送，請完成後再編輯或上傳。', 409);
          if (req.method === 'PUT' && pathname === '/api/portal/content') {
            if (!req.headers['content-type']?.startsWith('application/json')) throw new ContentError('請使用 JSON');
            const data = JSON.parse((await body(req, 1024 * 1024)).toString('utf8'));
            const result = await store.save(data.content, data.revision);
            const modules = vite.moduleGraph.getModulesByFile(path.join(root, 'content.json'));
            if (modules) for (const module of modules) vite.moduleGraph.invalidateModule(module);
            return send(200, result);
          }
          if (req.method === 'POST' && pathname === '/api/portal/upload') return send(201, await store.upload(await body(req, 8 * 1024 * 1024), req.headers['content-type']));
          throw new ContentError('找不到操作', 404);
        } catch (error) {
          if (error instanceof SyntaxError) return send(400, { error: 'JSON 格式不正確' });
          if (!(error instanceof ContentError)) console.error('Portal operation failed:', error.message);
          send(error.status || 500, { error: error instanceof ContentError ? error.message : '操作失敗，請查看終端機後重試。' });
        }
      });
    },
    handleHotUpdate(context) {
      if (context.file === path.join(root, 'content.json')) return [];
    },
  }],
});
await server.listen();
console.log(`\nMujiz 本機 Portal → ${origin}/portal\n儲存只更新本地，公開網站需另行部署。\n`);
