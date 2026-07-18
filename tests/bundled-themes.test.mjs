import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTheme } from '../plugins/codex-theme-studio/runtime/src/theme.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/codex-theme-studio/themes');
test('bundles twelve uniquely identified themes', async () => {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory());
  const themes = await Promise.all(directories.map(entry => loadTheme(path.join(root, entry.name), { loadImage: false })));
  assert.equal(themes.length, 12);
  assert.equal(new Set(themes.map(theme => theme.id)).size, themes.length);
  for (const theme of themes) {
    assert.equal(path.basename(theme.directory), theme.id);
  }
});

test('does not bundle the removed Sheng Shi Hua Zhang collection', async () => {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  assert.equal(directories.some(id => id.startsWith('sheng-shi-')), false);
});
