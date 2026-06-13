import { dailyFileHeader, formatClipping, todayFilename } from './clip-format.js';

const NATIVE_HOST = 'com.newsreader.obsidianclip';

function sendNativeMessage(message) {
  return chrome.runtime.sendNativeMessage(NATIVE_HOST, message);
}

/**
 * @param {object} vault
 * @param {string} content
 * @param {string} filename
 */
async function writeViaNative(vault, content, filename) {
  const response = await sendNativeMessage({
    action: 'clip',
    vaultPath: vault.path,
    clippingsFolder: vault.clippingsFolder || 'Clippings',
    filename,
    content,
    newFileHeader: dailyFileHeader(),
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'Native host failed to save clipping.');
  }

  return { method: 'native', filePath: response.filePath };
}

/**
 * @param {object} vault
 * @param {string} content
 * @param {string} filename
 */
async function writeViaRestApi(vault, content, filename) {
  const baseUrl = (vault.restApiUrl || 'https://127.0.0.1:27124').replace(/\/$/, '');
  const folder = (vault.clippingsFolder || 'Clippings').replace(/^\/|\/$/g, '');
  const filePath = `${folder}/${filename}`;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `${baseUrl}/vault/${encodedPath}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vault.restApiKey}`,
      'Content-Type': 'text/markdown',
    },
    body: content,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      detail || `Obsidian REST API error (${response.status}). Is the vault open in Obsidian?`
    );
  }

  return { method: 'rest-api', filePath };
}

/**
 * @param {{ vault: object, text: string, pageTitle: string, pageUrl: string, writeMode?: string }} opts
 */
export async function saveClipping(opts) {
  const { vault, text, pageTitle, pageUrl, writeMode = 'auto' } = opts;

  if (!vault) {
    throw new Error('No Obsidian vault selected. Add one in Settings.');
  }

  if (!text?.trim()) {
    throw new Error('No text selected to clip.');
  }

  const content = formatClipping({ text, pageTitle, pageUrl });
  const filename = todayFilename();
  const mode = writeMode || 'auto';
  const errors = [];

  const tryNative = mode === 'native' || mode === 'auto';
  const tryRest = mode === 'rest-api' || mode === 'auto';

  if (tryNative) {
    if (!vault.path?.trim()) {
      errors.push('Vault path not configured for native write.');
    } else {
      try {
        return await writeViaNative(vault, content, filename);
      } catch (err) {
        errors.push(`Native: ${err.message}`);
        if (mode === 'native') throw err;
      }
    }
  }

  if (tryRest) {
    if (!vault.restApiKey?.trim()) {
      errors.push('REST API key not configured.');
    } else {
      try {
        return await writeViaRestApi(vault, content, filename);
      } catch (err) {
        errors.push(`REST API: ${err.message}`);
        if (mode === 'rest-api') throw err;
      }
    }
  }

  throw new Error(errors.join(' ') || 'Could not save clipping.');
}

/** @param {object} vault */
export async function testVaultConnection(vault, writeMode = 'auto') {
  const testContent = `\n> Connection test ${new Date().toISOString()}\n\n---\n`;
  const filename = todayFilename();

  if (writeMode === 'rest-api' || (writeMode === 'auto' && vault.restApiKey)) {
    return writeViaRestApi(vault, testContent, filename);
  }

  if (!vault.path?.trim()) {
    throw new Error('Vault path is required for native write mode.');
  }

  return writeViaNative(vault, testContent, filename);
}

export async function isNativeHostAvailable() {
  try {
    const response = await sendNativeMessage({ action: 'ping' });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}
