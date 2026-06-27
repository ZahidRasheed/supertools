import { cleanUrl } from './url-clean.js';

/** @returns {string} YYYY-MM-DD */
export function todayFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}.md`;
}

/**
 * @param {{ text: string, pageTitle: string, pageUrl: string, clippedAt?: Date }} clip
 * @returns {string}
 */
export function formatClipping(clip) {
  const at = clip.clippedAt || new Date();
  const time = at.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const title = clip.pageTitle?.trim() || 'Untitled page';
  const url = cleanUrl(clip.pageUrl?.trim() || '');
  const body = clip.text.trim();

  const lines = ['', `## ${title}`, ''];
  if (url) lines.push(url, '');
  lines.push(`*Clipped ${time}*`, '');
  body.split('\n').forEach((line) => lines.push(`> ${line}`));
  lines.push('', '---', '');

  return lines.join('\n');
}

/** Header written when creating a new daily clipping file. */
export function dailyFileHeader(date = new Date()) {
  const label = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `# Clippings — ${label}\n`;
}
