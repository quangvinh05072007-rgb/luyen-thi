import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const omrPython = path.join(
  root,
  'data/ocr-runtime',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
);

export function isOmrAvailable() {
  return fs.existsSync(omrPython) && fs.existsSync(path.join(root, 'tools/omr_processor.py'));
}

export function processOmrImage(imageBuffer, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    if (!isOmrAvailable()) {
      return resolve({
        success: false,
        error: 'Chưa cài đặt OpenCV/Python OMR runtime trong data/ocr-runtime.',
      });
    }

    const scriptPath = path.join(root, 'tools/omr_processor.py');
    const child = spawn(omrPython, [scriptPath, '-'], {
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
          success: false,
          error: 'Quá thời gian xử lý phiếu chấm trắc nghiệm (timeout).',
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
          success: false,
          error: `Lỗi nhận dạng OMR: ${stderr.trim() || `Exit code ${code}`}`,
        });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (err) {
        resolve({
          success: false,
          error: `Không thể đọc kết quả nhận dạng phiếu: ${err.message}`,
        });
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        success: false,
        error: `Không thể khởi động tiến trình OMR: ${err.message}`,
      });
    });

    child.stdin.write(imageBuffer);
    child.stdin.end();
  });
}

/**
 * Sinh mã HTML phiếu trả lời trắc nghiệm chuẩn theo định dạng Bộ GD&ĐT 2025/2026.
 * Trang in A4 với 4 điểm định vị (corner markers) phục vụ quét/chấm bằng camera điện thoại hoặc máy scan.
 */
export function generateOmrTemplateHtml({ schoolName = 'TRƯỜNG THPT', examTitle = 'BÀI KIỂM TRA ĐỊNH KỲ', durationMin = 90 } = {}) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Phiếu Trả Lời Trắc Nghiệm - ${examTitle}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 10px;
    background: #fff;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    position: relative;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    border: 2px solid #000;
    padding: 18px 24px;
  }
  /* Corner alignment markers for 4-point perspective warp */
  .marker {
    position: absolute;
    width: 22px;
    height: 22px;
    background: #000;
  }
  .marker.tl { top: 12px; left: 12px; }
  .marker.tr { top: 12px; right: 12px; }
  .marker.bl { bottom: 12px; left: 12px; }
  .marker.br { bottom: 12px; right: 12px; }

  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 16px; margin: 0 0 4px 0; text-transform: uppercase; }
  .header h2 { font-size: 14px; margin: 0 0 4px 0; font-weight: normal; }
  .header .info-row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; }

  .student-box {
    display: grid;
    grid-template-columns: 1fr 140px 90px;
    gap: 12px;
    border: 1px solid #000;
    padding: 8px;
    margin-bottom: 12px;
    font-size: 12px;
  }
  .fill-grid {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .fill-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .bubble {
    width: 14px;
    height: 14px;
    border: 1px solid #000;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: bold;
    user-select: none;
  }
  .parts-container {
    display: grid;
    grid-template-columns: 1.1fr 1.2fr 1.2fr;
    gap: 12px;
  }
  .part-card {
    border: 1px solid #000;
    padding: 6px 8px;
  }
  .part-title {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    background: #f0f0f0;
    padding: 3px 6px;
    margin: -6px -8px 8px -8px;
    border-bottom: 1px solid #000;
    text-align: center;
  }
  .q-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 11px;
  }
  .q-label { font-weight: bold; width: 34px; }
  .q-choices { display: flex; gap: 4px; }
  .guide {
    margin-top: 10px;
    border-top: 1px dashed #666;
    padding-top: 6px;
    font-size: 10px;
    color: #444;
  }
  @media print {
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="no-print" style="text-align: center; margin-bottom: 12px;">
  <button onclick="window.print()" style="padding: 8px 20px; font-size: 14px; background: #1d4ed8; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🖨️ In phiếu ra giấy A4</button>
  <span style="margin-left: 12px; font-size: 13px; color: #555;">(Lưu ý: giữ nguyên tỷ lệ 100%, không co dãn lề khi in để quét chính xác nhất)</span>
</div>

<div class="sheet">
  <div class="marker tl"></div>
  <div class="marker tr"></div>
  <div class="marker bl"></div>
  <div class="marker br"></div>

  <div class="header">
    <h1>${schoolName}</h1>
    <h2>PHIẾU TRẢ LỜI TRẮC NGHIỆM ĐỊNH DẠNG 2025</h2>
    <div style="font-weight: bold; font-size: 13px;">${examTitle} · Thời gian: ${durationMin} phút</div>
    <div class="info-row">
      <span>Họ và tên thí sinh: ........................................................................</span>
      <span>Lớp: ........................ Phòng thi: ..............</span>
    </div>
  </div>

  <div class="student-box">
    <div>
      <b>HƯỚNG DẪN TÔ ĐÁP ÁN:</b>
      <p style="margin: 4px 0 0 0; line-height: 1.3;">- Dùng bút chì 2B hoặc bút đen tô kín ô tròn.<br>- Không gấp, làm rách hoặc tẩy lem phiếu.<br>- Sửa đáp án: tẩy sạch ô cũ trước khi tô ô mới.</p>
    </div>
    <div>
      <b style="display:block; text-align:center;">SỐ BÁO DANH</b>
      <div class="fill-grid" style="justify-content: center;">
        ${[0, 1, 2, 3, 4, 5].map(() => `
          <div class="fill-col">
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<div class="bubble">${d}</div>`).join('')}
          </div>
        `).join('')}
      </div>
    </div>
    <div>
      <b style="display:block; text-align:center;">MÃ ĐỀ</b>
      <div class="fill-grid" style="justify-content: center;">
        ${[0, 1, 2].map(() => `
          <div class="fill-col">
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<div class="bubble">${d}</div>`).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <div class="parts-container">
    <!-- Phần I: 12 câu trắc nghiệm nhiều lựa chọn -->
    <div class="part-card">
      <div class="part-title">Phần I: 12 Câu MCQ (A-B-C-D)</div>
      ${Array.from({ length: 12 }).map((_, i) => `
        <div class="q-row">
          <span class="q-label">Câu ${i + 1}</span>
          <div class="q-choices">
            <div class="bubble">A</div>
            <div class="bubble">B</div>
            <div class="bubble">C</div>
            <div class="bubble">D</div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Phần II: 4 câu Đúng/Sai -->
    <div class="part-card">
      <div class="part-title">Phần II: Đúng / Sai (4 câu)</div>
      ${[1, 2, 3, 4].map((q) => `
        <div style="margin-bottom: 6px; border-bottom: 1px dotted #ccc; padding-bottom: 4px;">
          <span style="font-weight: bold; font-size: 11px;">Câu ${q}:</span>
          ${['a', 'b', 'c', 'd'].map((sub) => `
            <div class="q-row" style="margin: 2px 0 2px 10px;">
              <span style="width: 24px;">${sub})</span>
              <div class="q-choices" style="gap: 10px;">
                <div class="bubble">Đ</div>
                <div class="bubble">S</div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <!-- Phần III: 6 câu Trả lời ngắn -->
    <div class="part-card">
      <div class="part-title">Phần III: Trả lời ngắn (6 câu)</div>
      ${[1, 2, 3, 4, 5, 6].map((q) => `
        <div style="margin-bottom: 5px; border-bottom: 1px dotted #ccc; padding-bottom: 3px;">
          <span style="font-weight: bold; font-size: 11px;">Câu ${q}:</span>
          <div class="fill-grid" style="justify-content: flex-end; margin-top: 2px;">
            <div class="fill-col" style="margin-right: 4px;">
              <div class="bubble" style="font-size: 8px;">-</div>
              <div class="bubble" style="font-size: 8px;">,</div>
            </div>
            ${[0, 1, 2, 3].map(() => `
              <div class="fill-col">
                ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<div class="bubble" style="width:12px;height:12px;font-size:8px;">${d}</div>`).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="guide">
    <b>SmartExam AI OMR System</b>: Phiếu này được quét tự động bằng thị giác máy tính OpenCV. Điểm định vị ở 4 góc cho phép xử lý ảnh chụp điện thoại bị nghiêng hoặc biến dạng góc nhìn.
  </div>
</div>
</body>
</html>`;
}
