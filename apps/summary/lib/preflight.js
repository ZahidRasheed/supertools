import { prepareContentForApi } from './text-processor.js';
import { estimateTokens } from './utils.js';

/**
 * Build warnings shown before calling Gemini.
 * @param {import('./utils.js').PageContent} page
 */
export function analyzePageForWarnings(page) {
  const warnings = [];
  const text = page.text?.trim() || '';
  const words = page.wordCount || 0;
  const chars = text.length;
  const extraction = page.extraction || {};
  const prepared = prepareContentForApi(page);

  if (!extraction.foundSemanticTag) {
    const source =
      extraction.method === 'body'
        ? 'the entire page'
        : 'a best-guess content block';

    warnings.push({
      id: 'no_semantic_tag',
      severity: 'warning',
      title: 'Main article not detected',
      message: `No standard article element was found (e.g. <article>, <main>). Extracted ~${words.toLocaleString()} words from ${source}, which may include navigation, sidebars, or ads.`,
    });
  }

  if (prepared.mode === 'map_reduce') {
    const apiCalls = prepared.meta.chunkCount + 1;
    warnings.push({
      id: 'long_content',
      severity: 'warning',
      title: 'Very long page',
      message: `~${words.toLocaleString()} words (~${estimateTokens(text).toLocaleString()} tokens). This will use ${apiCalls} Gemini API calls and may take a minute.`,
    });
  } else if (chars > 80_000) {
    warnings.push({
      id: 'large_content',
      severity: 'info',
      title: 'Large article',
      message: `~${words.toLocaleString()} words. One API call, but close to the single-request size limit.`,
    });
  }

  if (words > 0 && words < 80) {
    warnings.push({
      id: 'low_content',
      severity: 'warning',
      title: 'Little content found',
      message: `Only ${words} words were extracted. This may not be an article, or content may load dynamically via JavaScript.`,
    });
  }

  return {
    warnings,
    needsConfirmation: warnings.some((w) => w.severity === 'warning'),
    preview: {
      wordCount: words,
      charCount: chars,
      estimatedTokens: estimateTokens(text),
      extractionMethod: extraction.method || 'unknown',
      extractionSelector: extraction.selector || null,
      apiCalls: prepared.mode === 'map_reduce' ? prepared.meta.chunkCount + 1 : 1,
    },
  };
}
