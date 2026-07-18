import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { loadTheme } from '../plugins/codex-theme-studio/runtime/src/theme.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/codex-theme-studio/themes');
const entries = (await fs.readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

if (typeof global.gc === 'function') global.gc();
const baseline = process.memoryUsage();
const metadataStarted = performance.now();
for (let cycle = 0; cycle < 30; cycle += 1) {
  for (const id of entries) {
    const theme = await loadTheme(path.join(root, id), { loadImage: false });
    if (theme.image.buffer) throw new Error(`Metadata load retained image bytes for ${id}.`);
  }
}
const metadataDurationMs = performance.now() - metadataStarted;

let largestCompressedImageBytes = 0;
const imageStarted = performance.now();
for (const id of entries) {
  const theme = await loadTheme(path.join(root, id), { loadImage: true });
  largestCompressedImageBytes = Math.max(largestCompressedImageBytes, theme.image.buffer.length);
}
const imageDurationMs = performance.now() - imageStarted;
if (typeof global.gc === 'function') global.gc();
const completed = process.memoryUsage();

process.stdout.write(`${JSON.stringify({
  scope: 'node-theme-loader-only',
  releaseGate: false,
  themes: entries.length,
  metadataCycles: 30,
  metadataDurationMs: Number(metadataDurationMs.toFixed(2)),
  imageDurationMs: Number(imageDurationMs.toFixed(2)),
  largestCompressedImageBytes,
  rssDeltaBytes: completed.rss - baseline.rss,
  heapUsedDeltaBytes: completed.heapUsed - baseline.heapUsed,
  note: 'Renderer CPU/RSS acceptance must be measured separately in a signature-valid official app.',
}, null, 2)}\n`);
