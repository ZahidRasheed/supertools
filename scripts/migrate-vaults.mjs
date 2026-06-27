#!/usr/bin/env node
/**
 * Migrate vaults from a Summary/News Reader extension settings export
 * into ~/Library/Application Support/Assistant/vaults.json
 *
 * Usage: node scripts/migrate-vaults.mjs [path-to-export.json]
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vaultConfigFromExtensionExport } from '../packages/clip-core/src/vault.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultExport = join(__dirname, '../exports/news-reader-settings-2026-06-13.json');
const input = resolve(process.argv[2] || defaultExport);

const payload = JSON.parse(readFileSync(input, 'utf8'));
const config = vaultConfigFromExtensionExport(payload);

const supportDir = join(homedir(), 'Library', 'Application Support', 'Assistant');
mkdirSync(supportDir, { recursive: true });

const vaultsPath = join(supportDir, 'vaults.json');
writeFileSync(vaultsPath, `${JSON.stringify(config, null, 2)}\n`);

const prefsPath = join(supportDir, 'clipper.json');
writeFileSync(
  prefsPath,
  `${JSON.stringify({ launchAtLogin: true, showFloatingToolbar: true }, null, 2)}\n`
);

console.log(`Wrote ${vaultsPath} (${config.vaults.length} vaults)`);
console.log(`Wrote ${prefsPath}`);
