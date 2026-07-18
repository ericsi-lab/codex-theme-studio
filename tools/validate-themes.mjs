import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTheme } from '../plugins/codex-theme-studio/runtime/src/theme.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/codex-theme-studio/themes');
const entries = await fs.readdir(root, { withFileTypes: true });
let failed = false;
for (const entry of entries.filter(item => item.isDirectory())) {
  try {
    const theme = await loadTheme(path.join(root, entry.name));
    process.stdout.write(`✓ ${theme.id} — ${theme.name} (${theme.image.width}×${theme.image.height})\n`);
  } catch (error) {
    failed = true;
    process.stderr.write(`✗ ${entry.name}: ${error.message}\n`);
  }
}
if (!entries.length) {
  process.stderr.write('No bundled themes found.\n');
  failed = true;
}
if (failed) process.exitCode = 1;

