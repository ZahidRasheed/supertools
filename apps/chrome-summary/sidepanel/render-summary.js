const ALLOWED_TAGS = new Set([
  'P', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'H3', 'H4', 'BR', 'CODE',
]);

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeMarkdownInput(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\\([*_])/g, '$1')
    .replace(/[\uFF0A\u2217\u204E]/g, '*');
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);

  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
  out = out.replace(/(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g, '<em>$1</em>');
  out = out.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '<em>$1</em>');
  out = out.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

  return out;
}

function isListLine(line) {
  return /^(\s*)([-*•]|\d+\.)\s+/.test(line);
}

function listMatch(line) {
  return line.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
}

function listTag(marker) {
  return /^\d+\.$/.test(marker) ? 'ol' : 'ul';
}

function parseListBlock(lines, startIndex) {
  const first = listMatch(lines[startIndex]);
  const baseIndent = first[1].length;
  const items = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const match = listMatch(line);
    if (!match || match[1].length < baseIndent) break;
    if (match[1].length > baseIndent) break;

    const content = match[3];
    const item = { html: inlineMarkdown(content), children: [] };
    i++;

    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) {
        i++;
        continue;
      }
      const nested = listMatch(next);
      if (nested && nested[1].length > baseIndent) {
        const nestedBlock = parseListBlock(lines, i);
        item.children.push(nestedBlock);
        i = nestedBlock.endIndex;
        continue;
      }
      break;
    }

    items.push({ item });
  }

  const tag = listTag(first[2]);
  const htmlItems = items.map(({ item }) => {
    const nested = item.children.map((c) => c.html).join('');
    return `<li>${item.html}${nested}</li>`;
  });

  return {
    html: `<${tag}>${htmlItems.join('')}</${tag}>`,
    endIndex: i,
  };
}

function markdownToHtml(markdown) {
  if (!markdown?.trim()) return '';

  const lines = normalizeMarkdownInput(markdown).split('\n');
  const blocks = [];
  let i = 0;
  let isFirstParagraph = true;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 2, 4);
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (isListLine(line)) {
      const listBlock = parseListBlock(lines, i);
      blocks.push(listBlock.html);
      i = listBlock.endIndex;
      isFirstParagraph = false;
      continue;
    }

    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isListLine(lines[i]) && !/^#{1,3}\s+/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }

    const cls = isFirstParagraph ? ' class="lead"' : '';
    blocks.push(`<p${cls}>${inlineMarkdown(paraLines.join(' '))}</p>`);
    isFirstParagraph = false;
  }

  return blocks.join('\n');
}

function looksLikeHtml(text) {
  return /<\/?(?:p|ul|ol|li|strong|h[2-4]|em|b|i)\b/i.test(text.trim());
}

/** Drop every attribute (onclick, onerror, href=javascript:, …). */
export function stripAllAttributes(el) {
  while (el.attributes?.length) {
    el.removeAttribute(el.attributes[0].name);
  }
}

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body;

  function clean(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!ALLOWED_TAGS.has(child.tagName)) {
          const fragment = doc.createDocumentFragment();
          while (child.firstChild) fragment.appendChild(child.firstChild);
          child.replaceWith(fragment);
          clean(fragment);
          return;
        }
        stripAllAttributes(child);
        clean(child);
      }
    });
  }

  clean(root);
  return root.innerHTML;
}

/** Fallback pass for markdown that survived first conversion. */
function fixResidualMarkdown(html) {
  return html.replace(/\*\*([^*\n<]+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Render Gemini summary text as safe HTML.
 * Supports HTML responses (preferred) and Markdown (legacy cache).
 * @param {string} text
 * @returns {string}
 */
export function renderSummaryContent(text) {
  if (!text?.trim()) return '';

  if (looksLikeHtml(text)) {
    return sanitizeHtml(text);
  }

  const html = markdownToHtml(text);
  if (html.includes('**') || html.includes('__')) {
    return fixResidualMarkdown(html);
  }
  return html;
}
