// Chạy máy chủ: node server/index.mjs (phục vụ API + giao diện đã build trong dist/).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { seedSample } from './seed.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig() {
  const read = (f) => (fs.existsSync(path.join(root, f)) ? JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) : {});
  const base = read('config.json');
  const local = read('config.local.json');
  return { ...base, ...local, ai: { ...(base.ai ?? {}), ...(local.ai ?? {}) } };
}

export function startServer({ port, viteMiddleware } = {}) {
  const config = loadConfig();
  const app = createApp({
    ...config,
    dbFile: path.join(root, config.dataDir ?? 'data', 'smartexam.db'),
    distDir: viteMiddleware ? null : path.join(root, 'dist'),
  });
  if (!app.db.get('SELECT id FROM schools LIMIT 1')) {
    console.log('CSDL trống — đang tạo trường mẫu (dữ liệu mẫu)…');
    seedSample(app);
  }
  const server = http.createServer((req, res) => {
    if (viteMiddleware && !req.url.startsWith('/api/')) return viteMiddleware(req, res);
    app.handle(req, res);
  });
  const p = port ?? Number(process.env.PORT ?? config.port ?? 4700);
  server.listen(p, () => {
    console.log(`SmartExam AI đang chạy: http://localhost:${p}`);
    console.log(app.ai.enabled ? `AI: bật (${app.ai.model})` : 'AI: tắt (chưa có khóa) — mọi chức năng khác vẫn chạy.');
  });
  return { server, app };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('Chưa có bản build giao diện. Chạy "npm run build" trước, hoặc dùng "npm run dev".');
    process.exit(1);
  }
  startServer();
}
