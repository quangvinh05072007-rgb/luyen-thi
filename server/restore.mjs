// Khôi phục CSDL từ một bản sao lưu: node server/restore.mjs <file-sao-luu> [file-db-dich]
// Phải tắt máy chủ trước. Bản đang dùng được chép sang "*.truoc-khoi-phuc-<giờ>" trước khi thay.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const REQUIRED_TABLES = ['schools', 'users', 'questions', 'exams', 'assignments', 'attempts', 'audit_log'];

/** Kiểm tra bản sao lưu đọc được và có đủ bảng chính. Trả về số tài khoản. */
export function verifyBackup(file) {
  if (!fs.existsSync(file)) throw new Error(`Không thấy file sao lưu: ${file}`);
  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const check = db.prepare('PRAGMA integrity_check').all();
    if (check.length !== 1 || check[0].integrity_check !== 'ok') throw new Error('Bản sao lưu bị hỏng (integrity_check không đạt).');
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
    if (missing.length) throw new Error(`Bản sao lưu thiếu bảng: ${missing.join(', ')}.`);
    return db.prepare('SELECT COUNT(*) n FROM users').get().n;
  } catch (e) {
    if (e.message.startsWith('Bản sao lưu')) throw e;
    throw new Error(`Không đọc được bản sao lưu: ${e.message}`);
  } finally {
    db?.close();
  }
}

export function restoreBackup(backupFile, dbFile, now = Date.now()) {
  const users = verifyBackup(backupFile);
  let kept = null;
  if (fs.existsSync(dbFile)) {
    const stamp = new Date(now + 7 * 3600000).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    kept = `${dbFile}.truoc-khoi-phuc-${stamp}`;
    fs.copyFileSync(dbFile, kept);
  }
  for (const ext of ['-wal', '-shm']) fs.rmSync(dbFile + ext, { force: true });
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.copyFileSync(backupFile, dbFile);
  return { users, kept };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [src, dest] = process.argv.slice(2);
  if (!src) {
    console.error('Cách dùng: npm run restore -- data/backups/smartexam-….db');
    process.exit(1);
  }
  try {
    const r = restoreBackup(path.resolve(src), path.resolve(dest ?? path.join(root, 'data', 'smartexam.db')));
    console.log(`Đã khôi phục (${r.users} tài khoản).${r.kept ? ` Bản cũ giữ tại: ${r.kept}` : ''}`);
  } catch (e) {
    console.error(`Không khôi phục được: ${e.message}`);
    process.exit(1);
  }
}
