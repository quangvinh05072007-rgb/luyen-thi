// Chạy máy chủ: node server/index.mjs (phục vụ API + giao diện đã build trong dist/).
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig() {
  const read = (f) => (fs.existsSync(path.join(root, f)) ? JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) : {});
  const base = read('config.json');
  const local = read('config.local.json');
  return { ...base, ...local, ai: { ...(base.ai ?? {}), ...(local.ai ?? {}) } };
}

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

export function startServer({ port, viteMiddleware } = {}) {
  const config = loadConfig();
  const dataDir = path.join(root, config.dataDir ?? 'data');
  const app = createApp({
    ...config,
    dbFile: path.join(dataDir, 'smartexam.db'),
    backupDir: path.join(dataDir, 'backups'),
    distDir: viteMiddleware ? null : path.join(root, 'dist'),
  });
  const server = http.createServer((req, res) => {
    if (viteMiddleware && !req.url.startsWith('/api/')) return viteMiddleware(req, res);
    app.handle(req, res);
  });
  const p = port ?? Number(process.env.PORT ?? config.port ?? 4700);
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`Cổng ${p} đang bận — có thể SmartExam đã chạy rồi. Mở http://localhost:${p}, hoặc đặt "port" khác trong config.local.json.`);
    else console.error(e);
    process.exit(1);
  });
  server.listen(p, () => {
    console.log(`\nSmartExam AI đang chạy.`);
    console.log(`  Trên máy này:      http://localhost:${p}`);
    for (const ip of lanAddresses()) console.log(`  Máy khác cùng mạng: http://${ip}:${p}`);
    console.log(app.ai.enabled ? `  AI: bật (${app.ai.model})` : '  AI: tắt (chưa có khóa) — mọi chức năng khác vẫn chạy.');
    if (!app.db.get('SELECT id FROM schools LIMIT 1')) console.log('  Lần đầu chạy: mở trình duyệt để thiết lập trường.');
    console.log('  Đóng cửa sổ này (hoặc Ctrl+C) để tắt.\n');
  });
  // Sao lưu khi khởi động (nếu đã có dữ liệu) và mỗi 6 giờ; giữ 14 bản gần nhất trong data/backups.
  const backup = () => {
    try {
      if (app.db.get('SELECT id FROM schools LIMIT 1')) app.backupNow('tu-dong');
    } catch (e) {
      console.error('Sao lưu lỗi:', e.message);
    }
  };
  if (!viteMiddleware) {
    backup();
    setInterval(backup, 6 * 3600 * 1000).unref();
  }
  const stop = () => {
    server.close();
    app.db.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return { server, app };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('Chưa có bản build giao diện. Chạy "npm run build" trước, hoặc dùng "npm run dev".');
    process.exit(1);
  }
  startServer();
}
