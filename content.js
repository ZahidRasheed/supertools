/**
 * Extract readable main content from the current page.
 * Uses semantic selectors first, then falls back to body text with noise removed.
 */
(function () {
  const NOISE_SELECTORS = [
    'script',
    'style',
    'noscript',
    'svg',
    'iframe',
    'nav',
    'footer',
    'header',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[aria-hidden="true"]',
    '.ad',
    '.ads',
    '.advertisement',
    '.sidebar',
    '.social-share',
    '.comments',
    '#comments',
    '.cookie-banner',
    '.newsletter',
  ];

  const MAIN_SELECTORS = [
    'article',
    '[role="main"]',
    'main',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.story-body',
    '#article-body',
    '.content-body',
    '.article-content',
  ];

  function classifySelector(selector) {
    if (selector === 'article') return 'article';
    if (selector === 'main' || selector === '[role="main"]') return 'main';
    if (selector.startsWith('.') || selector.startsWith('#')) return 'content-class';
    return 'semantic';
  }

  function cloneAndClean(root) {
    const clone = root.cloneNode(true);
    NOISE_SELECTORS.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });
    return clone;
  }

  function textFromElement(el) {
    const blocks = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const seen = new Set();

    function addBlock(text) {
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (normalized.length < 2) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      blocks.push(normalized);
    }

    const blockTags = new Set([
      'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'TH', 'FIGCAPTION',
    ]);

    let node = walker.currentNode;
    while (node) {
      if (blockTags.has(node.tagName)) {
        addBlock(node.innerText || node.textContent || '');
      }
      node = walker.nextNode();
    }

    if (blocks.length < 3) {
      addBlock(el.innerText || el.textContent || '');
    }

    return blocks.join('\n\n');
  }

  function findMainRoot() {
    for (const sel of MAIN_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && (el.innerText || '').trim().length > 200) {
        return {
          root: el,
          extraction: {
            method: classifySelector(sel),
            selector: sel,
            foundSemanticTag: true,
          },
        };
      }
    }

    let best = null;
    let bestScore = 0;
    document.querySelectorAll('div, section').forEach((el) => {
      const len = (el.innerText || '').length;
      const linkDensity =
        el.querySelectorAll('a').length / Math.max(1, el.querySelectorAll('p, div').length);
      const score = len * (1 - Math.min(linkDensity, 0.8));
      if (score > bestScore && len > 300) {
        bestScore = score;
        best = el;
      }
    });

    if (best) {
      return {
        root: best,
        extraction: {
          method: 'heuristic',
          selector: best.tagName.toLowerCase(),
          foundSemanticTag: false,
        },
      };
    }

    return {
      root: document.body,
      extraction: {
        method: 'body',
        selector: 'body',
        foundSemanticTag: false,
      },
    };
  }

  function extractPageContent() {
    const { root, extraction } = findMainRoot();
    const cleaned = cloneAndClean(root);
    const text = textFromElement(cleaned);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
      title: document.title || '',
      url: location.href,
      text,
      wordCount,
      extraction,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'EXTRACT_CONTENT') {
      try {
        sendResponse({ ok: true, content: extractPageContent() });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || 'Failed to extract content' });
      }
    }

    if (message.type === 'GET_SELECTION') {
      sendResponse({ ok: true, text: window.getSelection()?.toString() || '' });
    }

    return true;
  });
})();
