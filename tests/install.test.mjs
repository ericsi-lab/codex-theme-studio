import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const node = process.execPath;
const cli = fileURLToPath(new URL('../plugins/codex-theme-studio/runtime/src/cli.mjs', import.meta.url));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M/wn4GBgYGJAQoAHgQCAf2c3zQAAAAASUVORK5CYII=', 'base64');

test('install is isolated and preserves the user theme directory', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cts-install-'));
  const installRoot = path.join(root, 'runtime');
  const dataRoot = path.join(root, 'data');
  const userMarker = path.join(dataRoot, 'themes/my-theme/keep.txt');
  await fs.mkdir(path.dirname(userMarker), { recursive: true });
  await fs.writeFile(userMarker, 'mine');
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = spawnSync(node, [cli, 'install'], {
    encoding: 'utf8',
    env: { ...process.env, CTS_INSTALL_ROOT: installRoot, CTS_DATA_ROOT: dataRoot, CTS_TEST_MODE: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  const installation = JSON.parse(result.stdout);
  assert.equal(installation.ok, true);
  assert.equal(installation.onboarding.freshInstall, true);
  assert.equal(installation.onboarding.launcherRequired, false);
  assert.equal(installation.onboarding.launcherDisplayPath, '~/Applications/Theme Studio for Codex.app');
  assert.deepEqual(installation.onboarding.defaultTheme, {
    id: 'wan-yao-longyuan-lingji',
    name: '万妖图录·龙渊灵姬',
    appliesOnFirstThemeModeActivation: true,
  });
  assert.equal(await fs.readFile(userMarker, 'utf8'), 'mine');
  assert.ok(await fs.stat(path.join(installRoot, 'runtime/src/cli.mjs')));
  assert.ok(await fs.stat(path.join(installRoot, 'runtime/bin/theme-watcher.sh')));
});

test('update preserves an existing user decision about the one-time default theme', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cts-update-'));
  const installRoot = path.join(root, 'runtime');
  const dataRoot = path.join(root, 'data');
  const stateFile = path.join(dataRoot, 'state/state.json');
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify({
    version: 1,
    installedVersion: '0.0.9',
    activeTheme: null,
    demoMode: false,
  })}\n`);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = spawnSync(node, [cli, 'update'], {
    encoding: 'utf8',
    env: { ...process.env, CTS_INSTALL_ROOT: installRoot, CTS_DATA_ROOT: dataRoot, CTS_TEST_MODE: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  const installation = JSON.parse(result.stdout);
  const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  assert.equal(installation.onboarding.freshInstall, false);
  assert.equal(installation.onboarding.defaultTheme.appliesOnFirstThemeModeActivation, false);
  assert.equal(state.defaultThemeApplied, true);
  assert.equal(state.onboardingVersion, 1);
});

test('watch cycle exits when no active theme remains', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cts-watch-cycle-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const result = spawnSync(node, [cli, 'watch-cycle'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CTS_INSTALL_ROOT: path.join(root, 'runtime'),
      CTS_DATA_ROOT: path.join(root, 'data'),
      CTS_TEST_MODE: '1',
      CTS_DAEMON: '1',
    },
  });
  assert.equal(result.status, 75, result.stderr);
  assert.equal(result.stdout, '');
});

test('release packaging removes an older ZIP before rebuilding', async () => {
  const packageScript = fileURLToPath(new URL('../tools/package-release.sh', import.meta.url));
  const source = await fs.readFile(packageScript, 'utf8');
  const removeArchive = source.indexOf('rm -f "$OUT/$NAME.zip" "$OUT/$NAME.zip.sha256"');
  const createArchive = source.indexOf('/usr/bin/zip -qr "$NAME.zip" "$NAME"');
  assert.match(source, /NAME="theme-studio-for-codex-v\$VERSION"/);
  assert.match(source, /LEGACY_NAME="codex-theme-studio-v\$VERSION"/);
  assert.doesNotMatch(source, /cp -R "\$ROOT\/docs"/);
  assert.match(source, /PACKAGE_README\.md/);
  assert.ok(removeArchive >= 0);
  assert.ok(removeArchive < createArchive);
});

test('real sample capture preserves project and workspace labels', async () => {
  const captureScript = fileURLToPath(new URL('../tools/capture-real-samples.mjs', import.meta.url));
  const source = await fs.readFile(captureScript, 'utf8');
  assert.doesNotMatch(source, /capture-redactions/);
  assert.doesNotMatch(source, /appendMask/);
  assert.doesNotMatch(source, /private project names never reach disk/);
  assert.match(source, /only account identity is masked/);
});

test('bundles an original macOS launcher icon', async () => {
  const iconPath = fileURLToPath(new URL(
    '../plugins/codex-theme-studio/assets/theme-studio-for-codex.icns',
    import.meta.url,
  ));
  const icon = await fs.readFile(iconPath);
  assert.equal(icon.subarray(0, 4).toString('ascii'), 'icns');
  assert.ok(icon.byteLength > 100_000);
});

test('launcher metadata prevents the generic Script Editor icon from winning', async () => {
  const operationsPath = fileURLToPath(new URL(
    '../plugins/codex-theme-studio/runtime/src/operations.mjs',
    import.meta.url,
  ));
  const source = await fs.readFile(operationsPath, 'utf8');
  assert.match(source, /setPlistString\('CFBundleIconFile', LAUNCHER_ICON_FILE_NAME\)/);
  assert.match(source, /\['-remove', 'CFBundleIconName', plist\]/);
  assert.match(source, /LAUNCH_SERVICES_REGISTER/);
});

test('imports a generated image with analyzed theme metadata', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cts-import-'));
  const source = path.join(root, 'nezha.png');
  const dataRoot = path.join(root, 'data');
  await fs.writeFile(source, PNG);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = spawnSync(node, [
    cli,
    'import',
    source,
    '--name', '莲火测试',
    '--accent', '#FF6A62',
    '--focus-x', '0.84',
    '--safe-side', 'left',
    '--effect', 'petals',
    '--effect-intensity', '0.18',
    '--motion',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CTS_INSTALL_ROOT: path.join(root, 'runtime'),
      CTS_DATA_ROOT: dataRoot,
      CTS_TEST_MODE: '1',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const manifest = JSON.parse(await fs.readFile(path.join(dataRoot, 'themes', output.id, 'theme.json'), 'utf8'));
  assert.equal(manifest.name, '莲火测试');
  assert.equal(manifest.colors.accent, '#FF6A62');
  assert.equal(manifest.art.focusX, 0.84);
  assert.deepEqual(manifest.effects, { preset: 'petals', intensity: 0.18, motion: true });
});
