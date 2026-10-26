import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const mathPython = path.join(
  root,
  'data/ocr-runtime',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
);

export function isMathVerifyAvailable() {
  return fs.existsSync(mathPython) && fs.existsSync(path.join(root, 'tools/math_verify.py'));
}

export function runMathVerify(payload, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    if (!isMathVerifyAvailable()) {
      return resolve({
        valid: false,
        equivalent: false,
        error: 'SymPy math runtime chưa được cài đặt hoặc không tìm thấy python runtime.',
      });
    }

    const scriptPath = path.join(root, 'tools/math_verify.py');
    const child = spawn(mathPython, [scriptPath], {
      cwd: root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({
          valid: false,
          equivalent: false,
          error: 'Thời gian kiểm tra biểu thức quá lâu (timeout).',
        });
      }
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        return resolve({
          valid: false,
          equivalent: false,
          error: `Lỗi thực thi kiểm tra Toán: ${stderr.trim() || `Exit code ${code}`}`,
        });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (err) {
        resolve({
          valid: false,
          equivalent: false,
          error: `Không thể đọc kết quả từ bộ kiểm tra: ${err.message}`,
        });
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        valid: false,
        equivalent: false,
        error: `Không thể khởi động tiến trình SymPy: ${err.message}`,
      });
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function verifyMathEquivalence(expr1, expr2) {
  return runMathVerify({ mode: 'equivalent', expr1, expr2 });
}

export async function validateMathExpression(expr) {
  return runMathVerify({ mode: 'validate', expr });
}
