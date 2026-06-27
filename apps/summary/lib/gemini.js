import { DEFAULT_MODEL } from './utils.js';
import {
  buildChunkPrompt,
  buildFinalPrompt,
  buildReducePrompt,
  prepareContentForApi,
} from './text-processor.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * @param {string} apiKey
 * @param {string} model
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callGemini(apiKey, model, prompt) {
  const url = `${API_BASE}/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg =
      data?.error?.message ||
      `Gemini API error (${response.status})`;
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join('\n');

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text.trim();
}

/**
 * Summarize page content with smart chunking for long articles.
 * @param {{ apiKey: string, model?: string, userPrompt: string, page: import('./utils.js').PageContent }} opts
 * @returns {Promise<{ summary: string, meta: object }>}
 */
export async function summarizePage({ apiKey, model = DEFAULT_MODEL, userPrompt, page }) {
  const prepared = prepareContentForApi(page);

  if (prepared.mode === 'single') {
    const prompt = buildFinalPrompt(userPrompt, prepared.content);
    const summary = await callGemini(apiKey, model, prompt);
    return { summary, meta: prepared.meta };
  }

  const chunkSummaries = [];
  for (const chunkPayload of prepared.chunks) {
    const chunkPrompt = buildChunkPrompt(chunkPayload);
    const chunkSummary = await callGemini(apiKey, model, chunkPrompt);
    chunkSummaries.push(chunkSummary);
  }

  const reducePrompt = buildReducePrompt(userPrompt, chunkSummaries, page);
  const summary = await callGemini(apiKey, model, reducePrompt);

  return {
    summary,
    meta: { ...prepared.meta, chunkSummaries: chunkSummaries.length },
  };
}
