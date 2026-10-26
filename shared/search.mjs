/** Consistent Vietnamese search for names, titles and class codes. */
export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim().replace(/\s+/g, ' ');
}

export function matchesSearch(value, query) {
  return normalizeSearch(value).includes(normalizeSearch(query));
}
