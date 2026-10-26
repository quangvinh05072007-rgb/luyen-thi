/**
 * SmartExam AI - Fast Near-Duplicate Question Detection
 * Computes semantic and mathematical similarity between questions to prevent redundant
 * items in the school question bank.
 */

export function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents for base comparison
    .replace(/\[\[img:[^\]]+\]\]/g, ' [hinh] ') // normalize image tags
    .replace(/[\$]/g, ' ') // strip formula delimiters
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'<>]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTokens(str) {
  const norm = normalizeText(str);
  if (!norm) return new Set();
  const words = norm.split(' ').filter(w => w.length >= 2);
  const ngrams = new Set(words);
  // Also add character 3-grams for fuzzy word matching
  for (let i = 0; i <= norm.length - 3; i++) {
    ngrams.add(norm.slice(i, i + 3));
  }
  return ngrams;
}

export function similarityScore(strA, strB) {
  const tokensA = extractTokens(strA);
  const tokensB = extractTokens(strB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : Number((intersection / union).toFixed(3));
}

export function findDuplicates(candidateStem, existingQuestions, { threshold = 0.65, limit = 5 } = {}) {
  if (!candidateStem || !existingQuestions?.length) return [];

  const candNorm = normalizeText(candidateStem);
  if (candNorm.length < 10) return [];

  const matches = [];

  for (const q of existingQuestions) {
    const qStem = q.stem || '';
    const score = similarityScore(candidateStem, qStem);

    if (score >= threshold) {
      let reason = 'Nội dung và câu chữ gần như tương tự';
      if (score >= 0.9) reason = 'Gần như trùng khớp hoàn toàn (trùng > 90%)';
      else if (score >= 0.75) reason = 'Cùng dạng câu hỏi và cấu trúc toán học';

      matches.push({
        id: q.id,
        type: q.type,
        topic: q.topic,
        stem: qStem,
        score,
        reason,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
