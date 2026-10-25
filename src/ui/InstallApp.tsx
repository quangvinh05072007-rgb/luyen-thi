import { useState, useSyncExternalStore } from 'react';
import { activatePwaUpdate, getPwaSnapshot, installPwa, subscribePwa } from '../pwa';

/** Safe to show on login, parent portal, and authenticated pages. */
export function InstallApp() {
  const state = useSyncExternalStore(subscribePwa, getPwaSnapshot, getPwaSnapshot);
  const [installing, setInstalling] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState('');

  async function install() {
    setInstalling(true);
    const choice = await installPwa();
    setNotice(choice === 'accepted' ? 'Đã gửi yêu cầu cài đặt.' : choice === 'dismissed' ? 'Bạn có thể cài đặt vào lúc khác.' : 'Mở menu trình duyệt để cài đặt hoặc thêm vào màn hình chính.');
    setInstalling(false);
  }

  function update() {
    if (!window.confirm('Cập nhật sẽ tải lại ứng dụng. Hãy hoàn tất và gửi bài đang làm trước khi tiếp tục. Bạn muốn cập nhật ngay?')) return;
    if (activatePwaUpdate()) {
      setUpdating(true);
      setNotice('Đang cập nhật ứng dụng…');
    } else setNotice('Bản cập nhật đã thay đổi. Bạn có thể tải lại sau khi hoàn tất công việc.');
  }

  return (
    <div className="pwa-controls">
      <span className={`pwa-status ${state.online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite">
        <span aria-hidden="true">●</span> {state.online ? 'Có kết nối mạng' : 'Mất kết nối · Giữ trang bài làm đang mở'}
      </span>
      {state.installed && <span className="pwa-installed">Đã cài ứng dụng</span>}
      {state.installable && !state.installed && (
        <button className="btn sm" type="button" onClick={install} disabled={installing}>
          {installing ? 'Đang mở cài đặt…' : 'Cài ứng dụng'}
        </button>
      )}
      {state.updateReady && (
        <button className="btn sm" type="button" onClick={update} disabled={updating}>
          {updating ? 'Đang cập nhật…' : 'Có bản cập nhật'}
        </button>
      )}
      <details className="pwa-help">
        <summary>Cài đặt &amp; ngoại tuyến</summary>
        <div className="pwa-help-content">
          <p>{state.installed ? 'Ứng dụng đã mở ở chế độ độc lập.' : 'Bạn có thể thêm SmartExam AI vào màn hình chính để mở nhanh.'}</p>
          {!state.supported ? (
            <p>Cài ứng dụng và giao diện ngoại tuyến cần HTTPS hoặc localhost. Khi dùng địa chỉ IP qua HTTP trong mạng trường, hãy tiếp tục sử dụng bằng trình duyệt.</p>
          ) : !state.installed && !state.installable ? (
            <p>Trong menu trình duyệt, chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính” nếu có. Trên iPhone/iPad, mở bằng Safari → Chia sẻ → Thêm vào màn hình chính.</p>
          ) : null}
          <p>{state.ready ? 'Giao diện ngoại tuyến đã sẵn sàng.' : 'Giao diện ngoại tuyến được chuẩn bị khi có kết nối.'} Đề thi, đáp án và dữ liệu cá nhân cần kết nối máy chủ.</p>
          <p>Nếu mất mạng khi làm bài, giữ trang bài làm đang mở để ứng dụng gửi lại khi kết nối ổn định.</p>
        </div>
      </details>
      {(notice || state.error) && <span className="pwa-notice" role="status">{notice || state.error}</span>}
    </div>
  );
}
