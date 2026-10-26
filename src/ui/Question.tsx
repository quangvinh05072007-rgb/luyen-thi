// Hiển thị một câu hỏi: làm bài, xem lại có đáp án, hoặc chỉ xem.
import { MathText } from './MathText';
import { ErrorTypeBadge, SourceBadge, useApp } from './kit';

export type Item = { qid: number; type: 'mcq' | 'tf' | 'short'; stem: string; options: string[]; no: number; topic?: string; level?: number };
export type Review = { correctAnswer: any; explanation?: string; source?: string; grade?: { points: number; max: number; correct: boolean; parts?: boolean[] } | null; diagnosis?: any };

const PART = { mcq: 'Phần I', tf: 'Phần II', short: 'Phần III' };

export function QuestionView({ item, response, onChange, review, compact }: { item: Item; response: any; onChange?: (v: any) => void; review?: Review | null; compact?: boolean }) {
  const ro = !onChange;
  return (
    <div>
      {!compact && (
        <div className="row small muted mb">
          <span className="badge blue">
            {PART[item.type]} · Câu {item.no}
          </span>
          <span>{{ mcq: 'Chọn một phương án', tf: 'Chọn Đúng hoặc Sai cho từng ý', short: 'Nhập kết quả, dùng dấu phẩy cho số thập phân' }[item.type]}</span>
        </div>
      )}
      <MathText as="div" className="q-stem mb" text={item.stem} />
      {item.type === 'mcq' && (
        <div className="stack">
          {item.options.map((o, i) => {
            let cls = response === i ? 'on' : '';
            if (review) cls = i === review.correctAnswer ? 'right' : response === i ? 'wrong' : '';
            return (
              <button key={i} className={`opt ${cls}`} disabled={ro} onClick={() => onChange?.(response === i ? null : i)} aria-pressed={response === i}>
                <span className="letter">{'ABCD'[i]}</span>
                <MathText text={o} />
              </button>
            );
          })}
        </div>
      )}
      {item.type === 'tf' && (
        <div>
          {item.options.map((s, i) => {
            const v = Array.isArray(response) ? response[i] : undefined;
            const set = (x: boolean) => {
              const next = Array.isArray(response) ? [...response] : [null, null, null, null];
              next[i] = next[i] === x ? null : x;
              onChange?.(next);
            };
            const correct = review ? review.correctAnswer?.[i] : undefined;
            return (
              <div className="tf-row" key={i}>
                <div>
                  <b>{'abcd'[i]})</b> <MathText text={s} />
                  {review && typeof v === 'boolean' && v !== correct && <span className="badge red" style={{ marginLeft: 6 }}>sai</span>}
                </div>
                <div className="tf-btns">
                  <button className={`${v === true ? 'on-t' : ''} ${review && correct === true ? 'mark' : ''}`} disabled={ro} onClick={() => set(true)} aria-pressed={v === true}>
                    Đúng
                  </button>
                  <button className={`${v === false ? 'on-f' : ''} ${review && correct === false ? 'mark' : ''}`} disabled={ro} onClick={() => set(false)} aria-pressed={v === false}>
                    Sai
                  </button>
                </div>
              </div>
            );
          })}
          {review && <div className="tiny muted">Viền vàng là đáp án đúng.</div>}
        </div>
      )}
      {item.type === 'short' && (
        <div className="row">
          <input
            className="input short-input"
            inputMode="decimal"
            maxLength={8}
            placeholder="VD: -1,5"
            value={response ?? ''}
            readOnly={ro}
            onChange={(e) => onChange?.(e.target.value.replace(/[^0-9,.\-−/]/g, ''))}
            aria-label="Đáp số"
          />
          {review && (
            <span className={`badge ${review.grade?.correct ? 'green' : 'red'}`}>
              Đáp án: {String(review.correctAnswer).split(';')[0]}
            </span>
          )}
        </div>
      )}
      {review && <ReviewBox review={review} type={item.type} />}
    </div>
  );
}

export function ReviewBox({ review, type }: { review: Review; type: string }) {
  const { meta } = useApp();
  const g = review.grade;
  const d = review.diagnosis;
  const state = !g ? 'wrong' : g.correct ? 'right' : g.points > 0 ? 'half' : 'wrong';
  return (
    <div className={`feedback fb-${state}`}>
      <div className="row between">
        <b>{state === 'right' ? 'Chính xác!' : d?.kind === 'blank' ? 'Bỏ trống' : state === 'half' ? `Đúng ${g?.parts?.filter(Boolean).length ?? 0}/4 ý` : 'Chưa đúng'}</b>
        {g && (
          <span className="small strong">
            {(g.points / 1000).toLocaleString('vi-VN')} / {(g.max / 1000).toLocaleString('vi-VN')} điểm
          </span>
        )}
      </div>
      {d?.errors?.length > 0 && (
        <div className="stack mt" style={{ gap: 6 }}>
          {d.errors.map((e: any, i: number) => (
            <div key={i} className="row small" style={{ gap: 6 }}>
              <ErrorTypeBadge type={e.type} />
              <MathText text={e.note} />
            </div>
          ))}
          <div className="tiny muted">Gợi ý: {meta.errorTypes[d.errors[0].type]?.action}</div>
        </div>
      )}
      {review.explanation && (
        <div className="explain">
          <div className="row between tiny muted mb">
            <span className="strong">Lời giải</span>
            {review.source && <SourceBadge source={review.source} />}
          </div>
          <MathText as="div" text={review.explanation} />
        </div>
      )}
      {type === 'tf' && !review.explanation && null}
    </div>
  );
}

export function isAnswered(type: string, r: any) {
  if (type === 'mcq') return Number.isInteger(r);
  if (type === 'tf') return Array.isArray(r) && r.some((x) => typeof x === 'boolean');
  return typeof r === 'string' && r.trim() !== '';
}
