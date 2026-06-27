import { estimateTokens, truncateMiddle } from './utils.js';

/** Target ~60k chars per chunk (~15k tokens), leaving room for prompt + output. */
const CHUNK_CHAR_LIMIT = 60_000;
/** Single-request limit before map-reduce kicks in. */
const SINGLE_REQUEST_CHAR_LIMIT = 120_000;
const CHUNK_SUMMARY_PROMPT =
  'Extract the key points, facts, and arguments from this section of a longer article. Be concise but preserve important details and names.';

/**
 * Split text into overlapping chunks at paragraph boundaries when possible.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function splitIntoChunks(text, maxChars = CHUNK_CHAR_LIMIT) {
  if (text.length <= maxChars) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf(' ')
      );
      if (breakAt > maxChars * 0.5) {
        end = start + breakAt + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(Boolean);
}

/**
 * Prepare page content for Gemini: trim boilerplate noise and apply smart sizing.
 * @param {import('./utils.js').PageContent} page
 * @returns {{ mode: 'single' | 'map_reduce', content: string, chunks?: string[], meta: object }}
 */
export function prepareContentForApi(page) {
  let text = page.text.replace(/\n{3,}/g, '\n\n').trim();

  if (text.length <= SINGLE_REQUEST_CHAR_LIMIT) {
    return {
      mode: 'single',
      content: formatSinglePayload(page.title, page.url, text),
      meta: {
        originalChars: text.length,
        estimatedTokens: estimateTokens(text),
        strategy: text.length > SINGLE_REQUEST_CHAR_LIMIT * 0.8 ? 'full' : 'full',
      },
    };
  }

  const chunks = splitIntoChunks(text);
  return {
    mode: 'map_reduce',
    content: '',
    chunks: chunks.map((chunk, i) =>
      formatChunkPayload(page.title, page.url, chunk, i + 1, chunks.length)
    ),
    meta: {
      originalChars: text.length,
      estimatedTokens: estimateTokens(text),
      strategy: 'map_reduce',
      chunkCount: chunks.length,
    },
  };
}

function formatSinglePayload(title, url, text) {
  const body =
    text.length > SINGLE_REQUEST_CHAR_LIMIT
      ? truncateMiddle(text, SINGLE_REQUEST_CHAR_LIMIT)
      : text;

  return `Page title: ${title}\nURL: ${url}\n\n--- ARTICLE CONTENT ---\n\n${body}`;
}

function formatChunkPayload(title, url, chunk, index, total) {
  return `Page title: ${title}\nURL: ${url}\nSection: ${index} of ${total}\n\n--- SECTION CONTENT ---\n\n${chunk}`;
}

export function buildFinalPrompt(userPrompt, contentPayload) {
  return `${userPrompt.trim()}\n\n${contentPayload}`;
}

export function buildChunkPrompt(contentPayload) {
  return `${CHUNK_SUMMARY_PROMPT}\n\n${contentPayload}`;
}

export function buildReducePrompt(userPrompt, chunkSummaries, page) {
  const combined = chunkSummaries
    .map((s, i) => `### Section ${i + 1}\n${s}`)
    .join('\n\n');

  return `${userPrompt.trim()}

The following are summaries of different sections of a long article titled "${page.title}" (${page.url}). Combine them into one coherent summary following the instructions above.

--- SECTION SUMMARIES ---

${combined}`;
}
