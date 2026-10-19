// AI (Claude) — tùy chọn. Không có khóa thì enabled = false và mọi chức năng AI trả lỗi có hướng dẫn.
// Nội dung AI tạo luôn lưu ở trạng thái nháp, nhãn AI Generated / AI Modified, chờ giáo viên duyệt.

const SYSTEM = `Bạn là giáo viên Toán THPT Việt Nam (chương trình GDPT 2018). Viết công thức bằng LaTeX trong $...$. Trả lời chính xác, ngắn gọn, đúng thuật ngữ sách giáo khoa.`;

export function makeAi(config) {
  const key = config.ai?.apiKey || process.env.ANTHROPIC_API_KEY || '';
  const model = config.ai?.model || 'claude-sonnet-5-5';
  const enabled = Boolean(key);

  async function call(content, maxTokens = 2000) {
    if (!enabled) throw Object.assign(new Error('Chưa cấu hình khóa AI. Thêm ANTHROPIC_API_KEY vào config.local.json rồi khởi động lại.'), { status: 503 });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: SYSTEM, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw Object.assign(new Error(`AI trả lỗi ${res.status}. Kiểm tra khóa và mạng. ${t.slice(0, 200)}`), { status: 502 });
    }
    const j = await res.json();
    return j.content.map((c) => c.text ?? '').join('');
  }

  function extractJson(text) {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw Object.assign(new Error('AI không trả về dữ liệu đúng dạng. Thử lại.'), { status: 502 });
    return JSON.parse(m[0]);
  }

  const shape = `{"type":"mcq|tf|short","stem":"...","options":["...","...","...","..."],"answer": 0 | [true,false,true,true] | "1,5","explanation":"...","distractors":{"1":{"error":"formula","note":"..."}}}`;

  return {
    enabled,
    model,
    async similarQuestion(q) {
      const text = await call(
        `Tạo MỘT câu hỏi mới cùng dạng, cùng chuyên đề, cùng mức độ với câu sau nhưng khác số liệu/bối cảnh. Kiểm tra lại đáp án.
Câu gốc (JSON): ${JSON.stringify({ type: q.type, stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation })}
Trả về DUY NHẤT JSON dạng: ${shape}
Với tf: options là 4 mệnh đề a)–d), answer là mảng 4 giá trị đúng/sai. Với short: options là [], answer là số viết tối đa 4 ký tự (dấu phẩy thập phân). distractors: với mcq, khóa là chỉ số phương án SAI, error ∈ concept|formula|transform|careless.`,
      );
      return extractJson(text);
    },
    async explain(q) {
      return (
        await call(
          `Viết lời giải từng bước cho câu sau, cuối cùng nêu đáp án. Nếu là trắc nghiệm, giải thích ngắn vì sao mỗi phương án sai là sai.
${JSON.stringify({ type: q.type, stem: q.stem, options: q.options, answer: q.answer })}`,
          1500,
        )
      ).trim();
    },
    async imageToText(buf, mediaType) {
      return call(
        [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: Buffer.from(buf).toString('base64') } },
          {
            type: 'text',
            text: `Chép lại đề trong ảnh thành văn bản. Công thức viết LaTeX trong $...$. Giữ định dạng: "PHẦN I/II/III", "Câu 1.", phương án "A. ... B. ... C. ... D. ..." mỗi phương án một dòng, ý đúng/sai "a) ... d)" mỗi ý một dòng. Nếu thấy đáp án, ghi "Đáp án: ..." dưới câu. Chỉ trả về văn bản đề, không bình luận.`,
          },
        ],
        4000,
      );
    },
  };
}
