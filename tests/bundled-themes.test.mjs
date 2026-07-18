import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTheme } from '../plugins/codex-theme-studio/runtime/src/theme.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/codex-theme-studio/themes');
const wanYaoThemes = new Map([
  ['wan-yao-liuli-lianmeng', '3f6d627b827eafa76ed9bb9f1c168b3cc18d7cda2c28a47ced6c4cb589d47ef3'],
  ['wan-yao-longyuan-lingji', '050e2d557579b96292c00536911081231c4044729493b00235338cfc302d48f3'],
  ['wan-yao-yuelun-xuanjun', '178a89dadb1a37dd8a3570f48eb3662aa1d428636f120ee4f0a06830d8417961'],
  ['wan-yao-jinye-yaohuang', '75b0c578f1d10b7617f5e3608a6c07dce7849c57bbe12a4d3747b1dcf85a9ebb'],
  ['wan-yao-yuepu-sanji', '42515f1d783872d6b8bbc37e18ff26ea363b413b24856b7af06aa474f66df227'],
  ['wan-yao-chimen-tiannu', '00d778d163944a5b16efeb9125007fed3af80a1a2b1e42d19cbe09a7e9b00a62'],
]);

test('bundles eighteen uniquely identified themes', async () => {
  const directories = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory());
  const themes = await Promise.all(directories.map(entry => loadTheme(path.join(root, entry.name), { loadImage: false })));
  assert.equal(themes.length, 18);
  assert.equal(new Set(themes.map(theme => theme.id)).size, themes.length);
  for (const theme of themes) {
    assert.equal(path.basename(theme.directory), theme.id);
  }
});

/**
 * Verifies the project-owner-authorized collection remains byte-identical to its licensed source.
 *
 * @param {Map<string, string>} collection theme ID to approved SHA-256 mapping; never empty
 * @param {string} displayPrefix required display-name prefix used to keep the series grouped
 * @returns {Promise<void>} resolves after every source, layout safety rule and motion limit passes
 */
async function assertSuppliedCollection(collection, displayPrefix) {
  for (const [id, expectedHash] of collection) {
    const directory = path.join(root, id);
    const theme = await loadTheme(directory, { loadImage: false });
    const bytes = await fs.readFile(path.join(directory, 'background.png'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
    assert.equal(theme.name.startsWith(displayPrefix), true);
    assert.equal(theme.image.width, 1672);
    assert.equal(theme.image.height, 941);
    assert.equal(theme.art.safeSide, 'left');
    assert.equal(theme.art.safeArea, 0.58);
    assert.equal(theme.effects.motion, false);
    assert.ok(theme.effects.intensity <= 0.1);
  }
}

test('preserves the six authorized Wan Yao Atlas backgrounds and low-motion defaults', async () => {
  await assertSuppliedCollection(wanYaoThemes, '万妖图录·');
});

test('does not bundle the removed Sheng Shi Hua Zhang collection', async () => {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  assert.equal(directories.some(id => id.startsWith('sheng-shi-')), false);
});
