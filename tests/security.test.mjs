import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  runTargetOperations,
  validateLoopbackUrl,
} from '../plugins/codex-theme-studio/runtime/src/cdp.mjs';
import {
  injectionExpression,
  restoreExpression,
  SELECTORS,
  verifyExpression,
} from '../plugins/codex-theme-studio/runtime/src/adapter.mjs';
import {
  applicationProfile,
  designatedRequirementMatches,
  identityCacheMatches,
  enableThemeMode,
  restartCommand,
  runningSignatureMatches,
} from '../plugins/codex-theme-studio/runtime/src/system.mjs';
import {
  activationThemeForState,
  LAUNCHER_BUNDLE_IDENTIFIER,
  launcherAppleScript,
  waitForStableThemeVerification,
} from '../plugins/codex-theme-studio/runtime/src/operations.mjs';
import {
  LAUNCHER_APP_NAME,
  LAUNCHER_ICON_FILE_NAME,
  LAUNCHER_MARKER_NAME,
  LEGACY_LAUNCHER_APP_NAME,
} from '../plugins/codex-theme-studio/runtime/src/config.mjs';

test('accepts loopback CDP URLs only', () => {
  assert.equal(validateLoopbackUrl('http://127.0.0.1:9222').hostname, '127.0.0.1');
  assert.equal(validateLoopbackUrl('ws://[::1]:9222/devtools/page/a', ['ws:']).hostname, '[::1]');
  assert.throws(() => validateLoopbackUrl('http://0.0.0.0:9222'), error => error.code === 'CDP_NOT_LOOPBACK');
  assert.throws(() => validateLoopbackUrl('https://example.com'), error => error.code === 'CDP_INVALID_URL');
});

test('skips internal app targets that fail page identity while keeping eligible pages', async () => {
  const targets = [
    { id: 'internal-window' },
    { id: 'task-page' },
    { id: 'home-page' },
  ];
  const closed = [];
  const results = await runTargetOperations(
    targets,
    async target => ({
      target,
      close() { closed.push(target.id); },
    }),
    async (_session, target) => {
      if (target.id === 'internal-window') {
        const error = new Error('Not a supported app page.');
        error.code = 'TARGET_IDENTITY_FAILED';
        throw error;
      }
      return target.id;
    },
    { ignoredErrorCodes: ['TARGET_IDENTITY_FAILED'] },
  );

  assert.deepEqual(results, ['task-page', 'home-page']);
  assert.deepEqual(closed, targets.map(target => target.id));
});

test('adapter injection and restore expressions are parseable', () => {
  const theme = {
    id: 'test-theme', name: 'Test', appearance: 'auto',
    colors: { accent: '#72D6C9', surface: '#101820CC', text: '#F4F7F6', mutedText: '#C2CECB', overlay: '#07110E66' },
    art: { focusX: 0.8, focusY: 0.5, safeArea: 0.55, taskMode: 'ambient' },
    effects: { preset: 'mist', intensity: 0.35, motion: true },
    image: { mime: 'image/png', buffer: Buffer.from('png') },
  };
  const expression = injectionExpression(theme);
  assert.doesNotThrow(() => new Function(`return ${expression}`));
  assert.doesNotThrow(() => new Function(`return ${restoreExpression()}`));
  assert.match(expression, /URL\.createObjectURL/);
  assert.match(expression, /URL\.revokeObjectURL/);
  assert.match(expression, /250 - \(performance\.now\(\) - lastDecoratedAt\)/);
  assert.match(expression, /structuralMutation/);
  assert.match(expression, /document\.hasFocus\(\)/);
  assert.match(expression, /window\.addEventListener\('blur', pause/);
  assert.match(expression, /--color-token-text-primary:#F4F7F6/);
  assert.match(expression, /--color-background-elevated-primary:var\(--cts-elevated\)/);
  assert.match(expression, /--vscode-menu-background:var\(--cts-elevated\)/);
  assert.match(expression, /html\.cts-theme body,html\.cts-theme #root\{--cts-panel-solid:/);
  assert.match(expression, /\.composer-surface-chrome,\[data-testid\*="composer"\],form/);
  assert.match(expression, /\.app-theme:has\(\.xterm\)/);
  assert.match(expression, /--vscode-terminal-background:var\(--cts-panel-solid\)!important/);
  assert.match(expression, /\.xterm-rows\{color:var\(--cts-text\)!important/);
  assert.match(expression, /\.xterm-cursor\{color:var\(--cts-accent\)!important/);
  assert.match(expression, /\[data-cts-role='composer'\] ::placeholder/);
  assert.match(expression, /\[role='dialog'\]/);
  assert.doesNotMatch(expression, /data-cts-demo-placeholder/);
  assert.doesNotMatch(expression, /SAFE DEMO/);
  assert.doesNotMatch(expression, /ctsDemoInput/);
  assert.match(expression, /fingerprint: next\.fingerprint/);
  assert.doesNotMatch(expression, /data:image\/png;base64/);

  const verify = verifyExpression('test-theme', 'fingerprint-1', false);
  assert.match(verify, /backgroundCount === 1/);
  assert.match(verify, /styleCount === 1/);
  assert.match(verify, /mainTagged/);
  assert.match(verify, /composerTagged/);
  assert.match(verify, /semanticReady/);
  assert.match(verify, /runtime\?\.fingerprint === "fingerprint-1"/);

  const demoVerify = verifyExpression('test-theme', 'fingerprint-1', true);
  assert.match(demoVerify, /root\.dataset\.ctsDemo === 'true' && privateTextReady/);
  assert.match(demoVerify, /&& privacyReady/);
});

test('adapter keeps centralized interactive selectors', () => {
  assert.ok(SELECTORS.sidebar.length >= 2);
  assert.ok(SELECTORS.composerInput.includes('textarea'));
  assert.ok(SELECTORS.taskContent.includes('[data-thread-find-target="conversation"]'));
  assert.ok(SELECTORS.settingsControl.includes('[role="switch"]'));
  assert.equal(SELECTORS.privateSurface, undefined);
});

test('restart command supports current ChatGPT and legacy Codex names', () => {
  assert.match(restartCommand({ displayName: 'ChatGPT', profile: 'chatgpt-current' }), /open -na "ChatGPT"/);
  assert.match(restartCommand({ displayName: 'Codex', profile: 'codex-legacy' }), /open -na "Codex"/);
  assert.match(restartCommand({ displayName: 'ChatGPT', profile: 'chatgpt-current' }), /127\.0\.0\.1/);
});

test('launcher copy is accurate for both current ChatGPT and legacy Codex', () => {
  const source = launcherAppleScript('/tmp/cts');
  assert.match(source, /ChatGPT 或旧版 Codex/);
  assert.match(source, /官方桌面应用/);
  assert.match(source, /with title "Theme Studio for Codex"/);
  assert.match(source, /万妖图录·龙渊灵姬/);
  assert.match(source, /首次启用/);
  assert.doesNotMatch(source, /安全重启 ChatGPT 并/);
  assert.doesNotMatch(source, /with title "Codex Theme Studio"/);
});

test('launcher AppleScript remains compilable after onboarding copy changes', async t => {
  if (process.platform !== 'darwin') return t.skip('macOS launcher test');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cts-launcher-source-'));
  const sourceFile = path.join(directory, 'launcher.applescript');
  const appPath = path.join(directory, 'Theme Studio for Codex.app');
  const probePath = path.join(directory, 'Scripting Additions Probe.app');
  await fs.writeFile(sourceFile, launcherAppleScript('/tmp/cts'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  // Codex's command sandbox can hide the Standard Additions dictionary from osacompile. Skip only
  // when the platform cannot compile a minimal dialog; macOS CI and normal installers still run
  // the full source compilation below.
  const probe = spawnSync('/usr/bin/osacompile', [
    '-e', 'display dialog "probe"', '-o', probePath,
  ], { encoding: 'utf8' });
  if (probe.status !== 0) return t.skip('Standard Additions unavailable in this command sandbox');
  const compiled = spawnSync('/usr/bin/osacompile', ['-o', appPath, sourceFile], {
    encoding: 'utf8',
  });
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.ok(await fs.stat(path.join(appPath, 'Contents/Info.plist')));
});

test('launcher bundle identifier belongs to the publishing repository', () => {
  assert.equal(
    LAUNCHER_BUNDLE_IDENTIFIER,
    'io.github.ericsi-lab.theme-studio-for-codex.launcher',
  );
});

test('theme-mode activation uses a requested theme, current theme, then one-time default', () => {
  assert.deepEqual(
    activationThemeForState({ activeTheme: 'fortune-guardian', defaultThemeApplied: false }, 'aurora-glass'),
    { id: 'aurora-glass', source: 'requested' },
  );
  assert.deepEqual(
    activationThemeForState({ activeTheme: 'fortune-guardian', defaultThemeApplied: false }),
    { id: 'fortune-guardian', source: 'active' },
  );
  assert.deepEqual(
    activationThemeForState({ activeTheme: null, defaultThemeApplied: false }),
    { id: 'wan-yao-longyuan-lingji', source: 'default' },
  );
  assert.equal(
    activationThemeForState({ activeTheme: null, defaultThemeApplied: true }),
    null,
  );
});

test('launcher rename preserves the private marker used for safe upgrades', () => {
  assert.equal(LAUNCHER_APP_NAME, 'Theme Studio for Codex.app');
  assert.equal(LEGACY_LAUNCHER_APP_NAME, 'Codex Theme Studio.app');
  assert.equal(LAUNCHER_ICON_FILE_NAME, 'ThemeStudioForCodex.icns');
  assert.equal(LAUNCHER_MARKER_NAME, 'codex-theme-studio-managed');
});

test('recognizes the official Codex-to-ChatGPT migration profile', () => {
  assert.equal(applicationProfile('ChatGPT'), 'chatgpt-current');
  assert.equal(applicationProfile('Codex'), 'codex-legacy');
  assert.equal(applicationProfile('Unknown Desktop'), null);
});

test('accepts only the expected Apple/OpenAI designated requirement', () => {
  const requirement = 'designated => identifier "com.openai.codex" and anchor apple generic '
    + 'and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ '
    + 'and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ '
    + 'and certificate leaf[subject.OU] = "2DC432GLL2"';
  assert.equal(designatedRequirementMatches(requirement), true);
  assert.equal(designatedRequirementMatches(requirement.replace('2DC432GLL2', 'OTHERTEAM')), false);
  assert.equal(designatedRequirementMatches(requirement.replace('com.openai.codex', 'example.app')), false);
  assert.equal(designatedRequirementMatches(requirement.replace('anchor apple generic', 'anchor generic')), false);
  assert.equal(designatedRequirementMatches(requirement.replace('1.2.840.113635.100.6.1.13', '1.2.3')), false);
});

test('accepts only a dynamically valid OpenAI Developer ID identity chain', () => {
  const signature = [
    'Identifier=com.openai.codex',
    'Authority=Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)',
    'Authority=Developer ID Certification Authority',
    'Authority=Apple Root CA',
    'TeamIdentifier=2DC432GLL2',
  ].join('\n');
  assert.equal(runningSignatureMatches(signature), true);
  assert.equal(runningSignatureMatches(signature.replace('TeamIdentifier=2DC432GLL2', 'TeamIdentifier=OTHERTEAM')), false);
  assert.equal(runningSignatureMatches(signature.replace('Identifier=com.openai.codex', 'Identifier=example.app')), false);
  assert.equal(runningSignatureMatches(signature.replace('Authority=Apple Root CA\n', '')), false);
  assert.equal(runningSignatureMatches(signature.replace('(2DC432GLL2)', '(OTHERTEAM)')), false);
});

test('reuses identity results only for an unchanged app build fingerprint', () => {
  const fingerprint = {
    path: '/Applications/ChatGPT.app',
    identifier: 'com.openai.codex',
    profile: 'chatgpt-current',
    version: '26.715.31925',
    build: '5551',
    executableName: 'ChatGPT',
    cdHash: 'abc123',
    teamIdentifier: '2DC432GLL2',
    executable: { size: 100, mtimeMs: 200, ino: 300, dev: 400 },
    codeResources: { size: 500, mtimeMs: 600, ino: 700, dev: 400 },
  };
  const entry = { fingerprint, status: 'verified' };
  assert.equal(identityCacheMatches(entry, fingerprint), true);
  assert.equal(identityCacheMatches(entry, { ...fingerprint, build: '5552' }), false);
  assert.equal(identityCacheMatches(entry, {
    ...fingerprint,
    executable: { ...fingerprint.executable, mtimeMs: 201 },
  }), false);
});

test('theme mode restart requires explicit consent', async () => {
  await assert.rejects(
    enableThemeMode(),
    error => error.code === 'RESTART_CONSENT_REQUIRED',
  );
});

test('theme mode is a no-op in test mode after consent', async () => {
  const cli = fileURLToPath(new URL('../plugins/codex-theme-studio/runtime/src/cli.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [cli, 'enable', '--confirmed'], {
    encoding: 'utf8',
    env: { ...process.env, CTS_TEST_MODE: '1' },
  });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.alreadyEnabled, true);
  assert.deepEqual(result.defaultTheme, {
    id: 'wan-yao-longyuan-lingji',
    name: '万妖图录·龙渊灵姬',
    pending: true,
  });
});

test('theme-mode CLI rejects an empty requested theme before activation', () => {
  const cli = fileURLToPath(new URL('../plugins/codex-theme-studio/runtime/src/cli.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [cli, 'enable', '--confirmed', '--theme'], {
    encoding: 'utf8',
    env: { ...process.env, CTS_TEST_MODE: '1' },
  });
  assert.equal(child.status, 1);
  const result = JSON.parse(child.stderr);
  assert.equal(result.code, 'INVALID_ARGUMENT');
});

test('preview pauses the watcher and restores the previous active theme', async () => {
  const operationsPath = fileURLToPath(new URL('../plugins/codex-theme-studio/runtime/src/operations.mjs', import.meta.url));
  const source = await fs.readFile(operationsPath, 'utf8');
  const preview = source.slice(source.indexOf('export async function previewTheme'), source.indexOf('async function verifyInjectedTheme'));
  assert.ok(preview.indexOf('await stopDaemon()') < preview.indexOf('await inject(theme, state.demoMode)'));
  assert.match(preview, /const activeTheme = await findTheme\(state\.activeTheme\)/);
  assert.match(preview, /await inject\(activeTheme, state\.demoMode\)/);
  assert.match(preview, /await verifyInjectedTheme\(activeTheme, state\.demoMode\)/);
  assert.match(preview, /await startDaemon\(\)/);
  assert.match(preview, /await updateState\(\{ activeTheme: null, demoMode: false \}\)/);
});

test('daemon keeps only a lightweight shell supervisor resident', async () => {
  const operationsPath = fileURLToPath(new URL('../plugins/codex-theme-studio/runtime/src/operations.mjs', import.meta.url));
  const source = await fs.readFile(operationsPath, 'utf8');
  const start = source.slice(source.indexOf('export async function startDaemon'), source.indexOf('export async function applyTheme'));
  assert.match(start, /spawn\('\/bin\/sh', \[WATCHER_SCRIPT/);
  assert.doesNotMatch(start, /spawn\(process\.execPath, \[CLI_PATH, 'watch'\]/);
});

test('watcher waits for transient route structure and accepts the first stable verification', async () => {
  const statuses = [
    { ok: false, mainTagged: false, composerTagged: false },
    { ok: false, mainTagged: true, composerTagged: false },
    { ok: true, mainTagged: true, composerTagged: true },
  ];
  const delays = [];
  const session = {
    async evaluate() {
      return statuses.shift();
    },
  };
  const result = await waitForStableThemeVerification(
    session,
    { id: 'test-theme', fingerprint: 'fingerprint-1' },
    false,
    {
      attempts: 4,
      delayMs: 25,
      delay: async milliseconds => delays.push(milliseconds),
    },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(delays, [25, 25]);
});

test('watcher deactivates a persistently invalid theme instead of reapplying it forever', async () => {
  const operationsPath = fileURLToPath(new URL('../plugins/codex-theme-studio/runtime/src/operations.mjs', import.meta.url));
  const source = await fs.readFile(operationsPath, 'utf8');
  const cycle = source.slice(source.indexOf('export async function watchCycle'), source.indexOf('export async function watch()'));
  assert.match(cycle, /\['VERIFY_FAILED', 'THEME_NOT_FOUND'\]\.includes\(error\.code\)/);
  assert.match(cycle, /await updateState\(\{ activeTheme: null, demoMode: false \}\)/);
  assert.match(cycle, /return \{ continue: false, deactivated: true \}/);
});
