// CSDL SQLite có sẵn trong Node (node:sqlite). Cột *_json lưu JSON.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, sample INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id),
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, pass_hash TEXT NOT NULL,
  class_id INTEGER, xp INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, last_active_day TEXT,
  active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id), name TEXT NOT NULL,
  grade INTEGER NOT NULL, teacher_id INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id),
  type TEXT NOT NULL CHECK (type IN ('mcq','tf','short')), stem TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]', answer_json TEXT, explanation TEXT NOT NULL DEFAULT '',
  topic TEXT, level INTEGER NOT NULL DEFAULT 2,
  source TEXT NOT NULL CHECK (source IN ('official','teacher','imported','ai_generated','ai_modified')),
  status TEXT NOT NULL CHECK (status IN ('draft','approved','archived')) DEFAULT 'draft',
  distractors_json TEXT NOT NULL DEFAULT '{}', origin TEXT, parent_id INTEGER, tag_confidence REAL,
  created_by INTEGER, approved_by INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS q_school ON questions(school_id, status, type, topic);
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, title TEXT NOT NULL, blueprint_json TEXT NOT NULL,
  items_json TEXT NOT NULL, duration_min INTEGER NOT NULL, variants_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
  created_by INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, exam_id INTEGER NOT NULL REFERENCES exams(id),
  class_id INTEGER NOT NULL REFERENCES classes(id), mode TEXT NOT NULL CHECK (mode IN ('exam','homework')),
  title TEXT NOT NULL, open_at INTEGER NOT NULL, close_at INTEGER NOT NULL, duration_min INTEGER NOT NULL,
  show_result TEXT NOT NULL DEFAULT 'after_submit', created_by INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, assignment_id INTEGER, student_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('assignment','practice')), title TEXT,
  layout_json TEXT NOT NULL, started_at INTEGER NOT NULL, deadline_at INTEGER, submitted_at INTEGER,
  responses_json TEXT NOT NULL DEFAULT '{}', times_json TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 0,
  saved_at INTEGER, late_json TEXT, status TEXT NOT NULL DEFAULT 'in_progress',
  score10 REAL, points REAL, max_points REAL, result_json TEXT, diagnosis_json TEXT,
  events_json TEXT NOT NULL DEFAULT '[]', client_id TEXT, checked_json TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS att_one ON attempts(assignment_id, student_id) WHERE assignment_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL, student_id INTEGER NOT NULL, qid INTEGER NOT NULL,
  topic TEXT, level INTEGER, score REAL NOT NULL, correct INTEGER NOT NULL, error_type TEXT, attempt_id INTEGER, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ev_student ON evidence(student_id, at);
CREATE TABLE IF NOT EXISTS review_items (
  student_id INTEGER NOT NULL, qid INTEGER NOT NULL, school_id INTEGER NOT NULL,
  box INTEGER NOT NULL, due_at INTEGER NOT NULL, lapses INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (student_id, qid)
);
CREATE TABLE IF NOT EXISTS activity (
  student_id INTEGER NOT NULL, day TEXT NOT NULL, questions INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, day)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, school_id INTEGER, user_id INTEGER, action TEXT NOT NULL, detail TEXT, ip TEXT, at INTEGER NOT NULL
);
`;

/** Cột thêm sau bản đầu: thêm vào CSDL cũ mà không mất dữ liệu (chạy lại nhiều lần vẫn an toàn). */
const ADDED_COLUMNS = [
  ['questions', 'group_id', 'TEXT'],
  ['attempts', 'variant_code', 'TEXT'],
  ['assignments', 'variant_mode', "TEXT NOT NULL DEFAULT 'random'"],
  ['assignments', 'variant_map_json', 'TEXT'],
];

export function migrate(db) {
  for (const [table, col, def] of ADDED_COLUMNS) {
    const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

const JSON_COLS = /_json$/;

/** Đổi hàng có cột *_json thành đối tượng (bỏ hậu tố _json). */
export function hydrate(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (JSON_COLS.test(k)) out[k.replace(JSON_COLS, '')] = v == null ? null : JSON.parse(v);
    else out[k] = v;
  }
  return out;
}

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  migrate(db);
  const api = {
    raw: db,
    all(sql, ...p) {
      return db.prepare(sql).all(...p).map(hydrate);
    },
    get(sql, ...p) {
      return hydrate(db.prepare(sql).get(...p));
    },
    run(sql, ...p) {
      return db.prepare(sql).run(...p);
    },
    tx(fn) {
      db.exec('BEGIN');
      try {
        const r = fn();
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      db.close();
    },
  };
  return api;
}

/** Câu hỏi dạng dùng trong shared/* */
export function toQuestion(row) {
  if (!row) return null;
  const r = hydrate(row.options_json !== undefined ? row : row);
  return {
    id: r.id,
    type: r.type,
    stem: r.stem,
    options: r.options ?? [],
    answer: r.answer,
    explanation: r.explanation,
    topic: r.topic,
    level: r.level,
    source: r.source,
    status: r.status,
    distractors: r.distractors ?? {},
    origin: r.origin,
    parent_id: r.parent_id,
    tag_confidence: r.tag_confidence,
    created_by: r.created_by,
    approved_by: r.approved_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
    sample: r.sample,
    group_id: r.group_id ?? null,
  };
}
