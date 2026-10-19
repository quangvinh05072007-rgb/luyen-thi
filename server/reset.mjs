// Xóa dữ liệu để thiết lập lại từ đầu. Trước khi xóa luôn chép một bản vào data/backups.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const db = path.join(dataDir, 'smartexam.db');
if (!fs.existsSync(db)) {
  console.log('Chưa có dữ liệu. Chạy SmartExam để thiết lập trường.');
  process.exit(0);
}
fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
const keep = path.join(dataDir, 'backups', `smartexam-truoc-khi-reset-${Date.now()}.db`);
fs.copyFileSync(db, keep);
for (const f of [db, db + '-wal', db + '-shm']) if (fs.existsSync(f)) fs.rmSync(f);
console.log(`Đã xóa dữ liệu (bản cũ lưu tại ${keep}). Chạy lại SmartExam để thiết lập trường mới.`);
