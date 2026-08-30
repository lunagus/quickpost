// Shared utilities for QuickPost

export const LANGUAGES = [
  { value: 'txt', label: 'Plain Text' },
  { value: 'py', label: 'Python' },
  { value: 'js', label: 'JavaScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C / C++' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'md', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
];

export function buildLangOptions(selectedExt = 'txt') {
  return LANGUAGES.map(l =>
    `<option value="${l.value}"${l.value === selectedExt ? ' selected' : ''}>${l.label}</option>`
  ).join('\n');
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Map file extensions to Prism language identifiers
const EXT_TO_PRISM = {
  txt: 'plaintext',
  py: 'python',
  js: 'javascript',
  html: 'markup',
  css: 'css',
  json: 'json',
  java: 'java',
  c: 'c',
  ts: 'typescript',
  md: 'markdown',
  sql: 'sql',
};

export function getPrismLang(ext) {
  return EXT_TO_PRISM[ext] || 'plaintext';
}
