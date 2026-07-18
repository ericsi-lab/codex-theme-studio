#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function requireFile(relativePath) {
  const stat = await fs.stat(path.join(root, relativePath)).catch(() => null);
  if (!stat?.isFile()) errors.push(`missing required file: ${relativePath}`);
}

const requiredPublicFiles = [
  'LICENSE', 'NOTICE.md', 'README.md', 'README.en.md', 'SECURITY.md', 'PRIVACY.md',
  'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'ASSETS-LICENSE.md',
  '.agents/plugins/marketplace.json',
  'plugins/codex-theme-studio/.codex-plugin/plugin.json',
  'plugins/codex-theme-studio/skills/manage-codex-theme/SKILL.md',
  'docs/REAL_EXAMPLES.md', 'docs/examples/manifest.json',
];
await Promise.all(requiredPublicFiles.map(requireFile));

const packageJson = await readJson('package.json');
const pluginJson = await readJson('plugins/codex-theme-studio/.codex-plugin/plugin.json');
const marketplace = await readJson('.agents/plugins/marketplace.json');
const pluginBaseVersion = String(pluginJson.version).split('+')[0];
if (pluginBaseVersion !== packageJson.version) {
  errors.push(`version mismatch: package=${packageJson.version}, plugin=${pluginJson.version}`);
}
if (pluginJson.name !== 'codex-theme-studio') errors.push('plugin name must remain codex-theme-studio');
if (pluginJson.interface?.displayName !== 'Theme Studio for Codex') {
  errors.push('plugin displayName must be Theme Studio for Codex');
}
const marketplaceEntry = marketplace.plugins?.find(entry => entry.name === pluginJson.name);
if (!marketplaceEntry) errors.push('marketplace entry for codex-theme-studio is missing');
if (marketplaceEntry?.policy?.installation !== 'AVAILABLE') errors.push('marketplace installation policy must be AVAILABLE');
if (marketplaceEntry?.policy?.authentication !== 'ON_INSTALL') errors.push('marketplace authentication policy must be ON_INSTALL');

const themesRoot = path.join(root, 'plugins/codex-theme-studio/themes');
const themeIds = (await fs.readdir(themesRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
if (themeIds.length !== 18) errors.push(`expected 18 themes, found ${themeIds.length}`);
for (const themeId of themeIds) {
  for (const file of ['theme.json', 'background.png', 'preview-light.jpg', 'preview-dark.jpg', 'cover.jpg', 'LICENSE.txt']) {
    await requireFile(`plugins/codex-theme-studio/themes/${themeId}/${file}`);
  }
}

const examples = await readJson('docs/examples/manifest.json');
const exampleIds = Object.keys(examples.themes || {}).sort();
if (exampleIds.length !== themeIds.length) errors.push(`expected ${themeIds.length} example sets, found ${exampleIds.length}`);
for (const themeId of themeIds) {
  const views = examples.themes?.[themeId]?.views || {};
  if (views.task || views.home) errors.push(`${themeId} contains a disallowed task/home legacy screenshot`);
  for (const view of ['new-task', 'settings']) {
    const file = views[view]?.file;
    if (!file) {
      errors.push(`${themeId} is missing ${view} screenshot metadata`);
      continue;
    }
    await requireFile(path.join('docs/examples', file));
    if (views[view].width < 1000 || views[view].height < 700) {
      errors.push(`${themeId} ${view} screenshot is below the release resolution floor`);
    }
  }
}

// Scan public repository sources. Binary media is excluded from text checks.
const publicRoots = ['.agents', 'plugins', 'docs'];
const publicFiles = [];
for (const relativeRoot of publicRoots) {
  const pending = [path.join(root, relativeRoot)];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (/\.(?:md|json|mjs|js|sh|yml|yaml|txt)$/i.test(entry.name)) publicFiles.push(absolute);
    }
  }
}
for (const file of publicFiles) {
  const source = await fs.readFile(file, 'utf8');
  const relative = path.relative(root, file);
  if (/\/Users\/[A-Za-z0-9._-]+\//.test(source) || /\/var\/folders\//.test(source)) {
    errors.push(`${relative} contains an absolute private path`);
  }
  if (/盛世华章/.test(source)) errors.push(`${relative} contains the removed theme collection name`);
}

const packageScript = await fs.readFile(path.join(root, 'tools/package-release.sh'), 'utf8');
if (/\bvideos\b/.test(packageScript) || /\bmarketing\b/.test(packageScript)) {
  errors.push('release package must not include pending video or marketing proof assets');
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`✗ ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`✓ release audit passed: ${themeIds.length} themes, ${exampleIds.length * 2} real screenshots\n`);
}
