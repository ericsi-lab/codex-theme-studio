import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { imageDimensions, loadTheme } from '../plugins/codex-theme-studio/runtime/src/theme.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M/wn4GBgYGJAQoAHgQCAf2c3zQAAAAASUVORK5CYII=', 'base64');

async function fixture(overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cts-theme-'));
  await fs.writeFile(path.join(directory, 'background.png'), PNG);
  const theme = {
    schemaVersion: 1,
    id: 'test-theme',
    name: 'Test Theme',
    appearance: 'auto',
    image: 'background.png',
    ...overrides,
  };
  await fs.writeFile(path.join(directory, 'theme.json'), JSON.stringify(theme));
  return directory;
}

test('reads PNG dimensions', () => {
  assert.deepEqual(imageDimensions(PNG), { width: 2, height: 2, type: 'png', animated: false });
});

test('normalizes a valid theme and ignores unknown fields', async t => {
  const directory = await fixture({ futureField: true, art: { focusX: 0.8, safeArea: 0.5 } });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const theme = await loadTheme(directory);
  assert.equal(theme.id, 'test-theme');
  assert.equal(theme.art.focusX, 0.8);
  assert.equal(theme.art.focusY, 0.5);
  assert.equal(theme.art.safeSide, 'left');
  assert.equal(theme.art.homeMode, 'hero');
  assert.equal(theme.image.width, 2);
  assert.deepEqual(theme.effects, { preset: 'none', intensity: 0, motion: false });
});

test('loads metadata without retaining compressed image bytes', async t => {
  const directory = await fixture({ effects: { preset: 'mist', intensity: 0.35, motion: true } });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const theme = await loadTheme(directory, { loadImage: false });
  assert.equal(theme.image.buffer, undefined);
  assert.equal(theme.image.size, PNG.length);
  assert.deepEqual(theme.effects, { preset: 'mist', intensity: 0.35, motion: true });
});

test('rejects oversized pixel dimensions from the bounded image header', async t => {
  const directory = await fixture();
  const oversized = Buffer.from(PNG);
  oversized.writeUInt32BE(5_000, 16);
  oversized.writeUInt32BE(5_000, 20);
  await fs.writeFile(path.join(directory, 'background.png'), oversized);
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(loadTheme(directory), /12000000 pixels/);
});

test('rejects animated PNG payloads', async t => {
  const directory = await fixture();
  await fs.writeFile(path.join(directory, 'background.png'), Buffer.concat([PNG, Buffer.from('acTL')]));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(loadTheme(directory), /Animated images/);
});

test('rejects path traversal', async t => {
  const directory = await fixture({ image: '../outside.png' });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(loadTheme(directory), error => error.code === 'THEME_INVALID');
});

test('rejects symbolic-link images', async t => {
  const directory = await fixture();
  await fs.rename(path.join(directory, 'background.png'), path.join(directory, 'real.png'));
  await fs.symlink('real.png', path.join(directory, 'background.png'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(loadTheme(directory), /Symbolic links/);
});

test('rejects invalid schema and art bounds', async t => {
  const directory = await fixture({ art: { focusX: 1.5 } });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(loadTheme(directory), /art\.focusX/);
});

test('rejects unsafe effect settings', async t => {
  const directory = await fixture({ effects: { preset: 'video', intensity: 2, motion: 'yes' } });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(loadTheme(directory), /effects\.preset/);
});
