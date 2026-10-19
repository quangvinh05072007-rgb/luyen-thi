// Chuyên đề Toán THPT theo chương trình GDPT 2018 (rút gọn theo chương sách giáo khoa).
// code: duy nhất, ổn định — lưu trong CSDL. grade: lớp. keywords: dùng cho bộ phân loại (shared/classify.mjs).

export const LEVELS = {
  1: 'Biết',
  2: 'Hiểu',
  3: 'Vận dụng',
};

export const QUESTION_TYPES = {
  mcq: 'Trắc nghiệm',
  tf: 'Đúng/Sai',
  short: 'Trả lời ngắn',
};

export const PART_OF_TYPE = { mcq: 'I', tf: 'II', short: 'III' };

export const SOURCES = {
  official: 'Official',
  teacher: 'Teacher Bank',
  imported: 'Imported',
  ai_generated: 'AI Generated',
  ai_modified: 'AI Modified',
};

export const SOURCE_HINT = {
  official: 'Đề chính thức hoặc minh họa của Bộ',
  teacher: 'Giáo viên tự soạn',
  imported: 'Nhập từ file, đã tách tự động',
  ai_generated: 'AI tạo mới — cần giáo viên kiểm tra',
  ai_modified: 'AI đã sửa từ câu gốc — cần giáo viên kiểm tra',
};

export const ERROR_TYPES = {
  concept: { label: 'Khái niệm', hint: 'Hiểu chưa đúng định nghĩa, tính chất', action: 'Đọc lại lý thuyết và làm câu mức Biết' },
  formula: { label: 'Công thức', hint: 'Nhớ sai hoặc áp dụng sai công thức', action: 'Ôn bảng công thức, làm câu mức Hiểu' },
  transform: { label: 'Biến đổi', hint: 'Sai khi biến đổi, tính toán nhiều bước', action: 'Làm chậm từng bước, luyện câu Vận dụng có lời giải' },
  careless: { label: 'Bất cẩn', hint: 'Biết cách làm nhưng nhầm dấu, nhầm đơn vị, đọc sót đề', action: 'Gạch chân yêu cầu đề, kiểm tra lại dấu và đơn vị' },
};

export const TOPICS = [
  // Lớp 10
  { code: 'T10.MENHDE', grade: 10, name: 'Mệnh đề và tập hợp', keywords: ['mệnh đề', 'tập hợp', 'tập con', 'giao của', 'hợp của', 'phần bù', '\\cap', '\\cup', '\\subset', 'phủ định'] },
  { code: 'T10.BPT2AN', grade: 10, name: 'Bất phương trình, hệ bất phương trình bậc nhất hai ẩn', keywords: ['bất phương trình bậc nhất hai ẩn', 'miền nghiệm', 'hệ bất phương trình bậc nhất hai ẩn'] },
  { code: 'T10.HTL', grade: 10, name: 'Hệ thức lượng trong tam giác', keywords: ['định lí côsin', 'định lí sin', 'định lý cosin', 'định lý sin', 'bán kính đường tròn ngoại tiếp', 'diện tích tam giác', 'giải tam giác', 'heron'] },
  { code: 'T10.VECTO', grade: 10, name: 'Vectơ (mặt phẳng)', keywords: ['vectơ', 'véc tơ', 'vecto', 'tích vô hướng', '\\vec', '\\overrightarrow', 'trung điểm', 'trọng tâm'] },
  { code: 'T10.HAMBAC2', grade: 10, name: 'Hàm số bậc hai và đồ thị', keywords: ['hàm số bậc hai', 'parabol', 'đỉnh của parabol', 'trục đối xứng', 'tam thức bậc hai', 'dấu của tam thức'] },
  { code: 'T10.TOADOOXY', grade: 10, name: 'Phương pháp tọa độ trong mặt phẳng', keywords: ['oxy', 'đường thẳng', 'phương trình đường tròn', 'đường tròn', 'elip', 'hypebol', 'vectơ pháp tuyến', 'vectơ chỉ phương', 'khoảng cách từ điểm'] },
  { code: 'T10.TOHOP', grade: 10, name: 'Đại số tổ hợp', keywords: ['hoán vị', 'chỉnh hợp', 'tổ hợp', 'quy tắc cộng', 'quy tắc nhân', 'nhị thức newton', 'c_n^', 'a_n^', 'c_{', 'a_{', 'bao nhiêu cách', 'có bao nhiêu số'] },
  { code: 'T10.THONGKE', grade: 10, name: 'Thống kê (số liệu không ghép nhóm)', keywords: ['số trung bình', 'trung vị', 'mốt', 'tứ phân vị', 'phương sai', 'độ lệch chuẩn', 'khoảng biến thiên', 'mẫu số liệu'] },
  // Lớp 11
  { code: 'T11.LUONGGIAC', grade: 11, name: 'Hàm số lượng giác và phương trình lượng giác', keywords: ['lượng giác', '\\sin', '\\cos', '\\tan', '\\cot', 'sin x', 'cos x', 'radian', 'góc lượng giác', 'chu kì'] },
  { code: 'T11.DAYSO', grade: 11, name: 'Dãy số, cấp số cộng, cấp số nhân', keywords: ['dãy số', 'cấp số cộng', 'cấp số nhân', 'công sai', 'công bội', 'u_n', 'số hạng tổng quát'] },
  { code: 'T11.GHEPNHOM', grade: 11, name: 'Mẫu số liệu ghép nhóm (số đặc trưng đo xu thế trung tâm)', keywords: ['ghép nhóm', 'nhóm chứa mốt', 'nhóm chứa trung vị', 'tần số tích lũy'] },
  { code: 'T11.SONGSONG', grade: 11, name: 'Quan hệ song song trong không gian', keywords: ['song song', 'giao tuyến', 'thiết diện', 'phép chiếu song song', 'hình chóp', 'hình lăng trụ'] },
  { code: 'T11.GIOIHAN', grade: 11, name: 'Giới hạn, hàm số liên tục', keywords: ['giới hạn', '\\lim', 'liên tục', 'gián đoạn', 'vô cực'] },
  { code: 'T11.MULOG', grade: 11, name: 'Hàm số mũ và hàm số lôgarit', keywords: ['lôgarit', 'logarit', '\\log', '\\ln', 'hàm số mũ', 'phương trình mũ', 'lãi kép', 'e^'] },
  { code: 'T11.VUONGGOC', grade: 11, name: 'Quan hệ vuông góc trong không gian', keywords: ['vuông góc với mặt phẳng', 'góc giữa đường thẳng và mặt phẳng', 'góc nhị diện', 'khoảng cách giữa hai đường thẳng', 'thể tích khối chóp', 'thể tích khối lăng trụ'] },
  { code: 'T11.XACSUAT', grade: 11, name: 'Các quy tắc tính xác suất', keywords: ['xác suất', 'biến cố', 'độc lập', 'quy tắc cộng xác suất', 'quy tắc nhân xác suất', 'ngẫu nhiên'] },
  { code: 'T11.DAOHAM', grade: 11, name: 'Đạo hàm', keywords: ["y'", "f'(", 'đạo hàm', 'tiếp tuyến', 'hệ số góc', 'vận tốc tức thời', 'đạo hàm cấp hai'] },
  // Lớp 12
  { code: 'T12.KHAOSAT', grade: 12, name: 'Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số', keywords: ['đồng biến', 'nghịch biến', 'cực trị', 'cực đại', 'cực tiểu', 'giá trị lớn nhất', 'giá trị nhỏ nhất', 'tiệm cận', 'bảng biến thiên', 'đồ thị hàm số', 'khảo sát'] },
  { code: 'T12.VECTOKG', grade: 12, name: 'Vectơ và hệ trục tọa độ trong không gian', keywords: ['hệ trục tọa độ oxyz', 'tọa độ của vectơ', 'tích có hướng', 'hình hộp', 'không gian oxyz'] },
  { code: 'T12.PHANTAN', grade: 12, name: 'Số đặc trưng đo mức độ phân tán (ghép nhóm)', keywords: ['khoảng tứ phân vị', 'phương sai của mẫu số liệu ghép nhóm', 'độ lệch chuẩn của mẫu số liệu ghép nhóm', 'mức độ phân tán'] },
  { code: 'T12.NGUYENHAM', grade: 12, name: 'Nguyên hàm và tích phân', keywords: ['nguyên hàm', 'tích phân', '\\int', 'diện tích hình phẳng', 'thể tích khối tròn xoay', 'quãng đường'] },
  { code: 'T12.OXYZ', grade: 12, name: 'Phương pháp tọa độ trong không gian', keywords: ['oxyz', 'mặt phẳng (p)', 'phương trình mặt phẳng', 'phương trình đường thẳng', 'mặt cầu', 'vectơ pháp tuyến của mặt phẳng'] },
  { code: 'T12.XSDK', grade: 12, name: 'Xác suất có điều kiện', keywords: ['xác suất có điều kiện', 'công thức bayes', 'xác suất toàn phần', 'p(a|b)', 'p(a\\mid b)', 'biết rằng'] },
];

export const TOPIC_BY_CODE = Object.fromEntries(TOPICS.map((t) => [t.code, t]));

export function topicName(code) {
  return TOPIC_BY_CODE[code]?.name ?? 'Chưa gắn chuyên đề';
}
