import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DAEMON_FILE,
  DATA_ROOT,
  DEFAULT_ART,
  DEFAULT_COLORS,
  DEFAULT_EFFECTS,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_NAME,
  INSTALL_ROOT,
  LAUNCHER_ICON,
  LAUNCHER_ICON_FILE_NAME,
  LAUNCHER_APP,
  LAUNCHER_MARKER,
  LAUNCHER_MARKER_NAME,
  LEGACY_LAUNCHER_APP,
  LEGACY_LAUNCHER_MARKER,
  LIMITS,
  LOG_DIR,
  PLUGIN_ROOT,
  PRESETS_DIR,
  STATE_DIR,
  TEST_MODE,
  USER_THEMES_DIR,
  VERSION,
} from './config.mjs';
import {
  assertPageIdentity,
  injectionExpression,
  restoreExpression,
  verifyExpression,
} from './adapter.mjs';
import { withCodexPages } from './cdp.mjs';
import { fail } from './errors.mjs';
import { doctor, enableThemeMode } from './system.mjs';
import { findTheme, listThemes, loadTheme } from './theme.mjs';
import { readDaemon, readState, removeDaemonFile, updateState, writeDaemon } from './state.mjs';

const execFile = promisify(execFileCallback);
const CLI_PATH = path.join(INSTALL_ROOT, 'runtime/src/cli.mjs');
const WATCHER_SCRIPT = path.join(INSTALL_ROOT, 'runtime/bin/theme-watcher.sh');
const RUNTIME_LOG = path.join(LOG_DIR, 'runtime.log');
const WATCH_VERIFY_ATTEMPTS = 8;
const WATCH_VERIFY_DELAY_MS = 250;
const WATCH_RETRY_BASE_MS = 30_000;
const WATCH_RETRY_MAX_MS = 5 * 60_000;
export const LAUNCHER_BUNDLE_IDENTIFIER = 'io.github.ericsi-lab.theme-studio-for-codex.launcher';
const LAUNCHER_BUILD_VERSION = String(
  VERSION.split('.').map(Number).reduce((build, part) => (build * 1_000) + part, 0),
);
const LAUNCH_SERVICES_REGISTER = [
  '/System/Library/Frameworks/CoreServices.framework',
  'Frameworks/LaunchServices.framework/Support/lsregister',
].join('/');
const APPLET_PRIVACY_KEYS = Object.freeze([
  'NSAppleEventsUsageDescription',
  'NSAppleMusicUsageDescription',
  'NSCalendarsUsageDescription',
  'NSCameraUsageDescription',
  'NSContactsUsageDescription',
  'NSHomeKitUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSRemindersUsageDescription',
  'NSSiriUsageDescription',
  'NSSystemAdministrationUsageDescription',
]);

function appleScriptString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

/**
 * Builds the local launcher source without assuming which official desktop app is installed.
 *
 * The launcher delegates application selection to the verified runtime so the same generated app
 * remains accurate for current ChatGPT and legacy Codex installations.
 *
 * @param {string} command Absolute path to the installed deterministic CLI wrapper.
 * @returns {string} AppleScript source compiled into the user-owned launcher application.
 */
export function launcherAppleScript(command) {
  return [
    'on run',
    `  display dialog "将安全重启 ChatGPT 或旧版 Codex，并启用本机主题模式。首次启用会自动应用《${DEFAULT_THEME_NAME}》，以后会保留你的选择。不会修改官方应用。" buttons {"取消", "启用主题模式"} default button "启用主题模式" with title "Theme Studio for Codex"`,
    '  try',
    `    do shell script quoted form of "${appleScriptString(command)}" & " enable --confirmed"`,
    `    display notification "主题模式已启用。新安装会应用${DEFAULT_THEME_NAME}；已有选择或原始界面保持不变。" with title "Theme Studio for Codex"`,
    '  on error',
    '    display dialog "启用失败。请回到官方桌面应用说：检查主题。" buttons {"好"} default button "好" with title "Theme Studio for Codex"',
    '  end try',
    'end run',
    '',
  ].join('\n');
}

export async function ensureDataDirectories() {
  await Promise.all([
    fs.mkdir(USER_THEMES_DIR, { recursive: true, mode: 0o700 }),
    fs.mkdir(PRESETS_DIR, { recursive: true, mode: 0o700 }),
    fs.mkdir(STATE_DIR, { recursive: true, mode: 0o700 }),
    fs.mkdir(LOG_DIR, { recursive: true, mode: 0o700 }),
  ]);
}

/**
 * Keeps the watcher log bounded without retaining page text, user paths, or exception messages.
 *
 * @param {string} code Stable diagnostic code produced by the local runtime.
 * @returns {Promise<void>} Resolves after the sanitized event has been appended.
 */
async function appendRuntimeEvent(code) {
  await fs.mkdir(LOG_DIR, { recursive: true, mode: 0o700 });
  const stat = await fs.stat(RUNTIME_LOG).catch(() => null);
  if (stat?.size > LIMITS.logBytes) {
    const handle = await fs.open(RUNTIME_LOG, 'r');
    let tail;
    try {
      const length = Math.min(Math.floor(LIMITS.logBytes / 2), stat.size);
      tail = Buffer.alloc(length);
      await handle.read(tail, 0, length, stat.size - length);
    } finally {
      await handle.close();
    }
    const firstNewline = tail.indexOf(0x0a);
    await fs.writeFile(RUNTIME_LOG, firstNewline >= 0 ? tail.subarray(firstNewline + 1) : tail, { mode: 0o600 });
  }
  const safeCode = /^[A-Z0-9_]+$/.test(code || '') ? code : 'WATCH_ERROR';
  await fs.appendFile(RUNTIME_LOG, `${new Date().toISOString()} ${safeCode}\n`, { mode: 0o600 });
}

async function copyRuntime() {
  await fs.mkdir(INSTALL_ROOT, { recursive: true, mode: 0o700 });
  const sourceRuntime = path.join(PLUGIN_ROOT, 'runtime');
  const sourceScripts = path.join(PLUGIN_ROOT, 'scripts');
  const sourceAssets = path.join(PLUGIN_ROOT, 'assets');
  const targetRuntime = path.join(INSTALL_ROOT, 'runtime');
  const targetScripts = path.join(INSTALL_ROOT, 'scripts');
  const targetAssets = path.join(INSTALL_ROOT, 'assets');
  if (path.resolve(sourceRuntime) !== path.resolve(targetRuntime)) {
    await fs.rm(targetRuntime, { recursive: true, force: true });
    await fs.cp(sourceRuntime, targetRuntime, { recursive: true, errorOnExist: false });
  }
  if (path.resolve(sourceScripts) !== path.resolve(targetScripts)) {
    await fs.rm(targetScripts, { recursive: true, force: true });
    await fs.cp(sourceScripts, targetScripts, { recursive: true, errorOnExist: false });
  }
  if (path.resolve(sourceAssets) !== path.resolve(targetAssets)) {
    await fs.rm(targetAssets, { recursive: true, force: true });
    await fs.cp(sourceAssets, targetAssets, { recursive: true, errorOnExist: false });
  }
}

async function syncPresets() {
  const source = path.join(PLUGIN_ROOT, 'themes');
  await fs.rm(PRESETS_DIR, { recursive: true, force: true });
  await fs.mkdir(PRESETS_DIR, { recursive: true, mode: 0o700 });
  const exists = await fs.stat(source).catch(() => null);
  if (exists?.isDirectory()) await fs.cp(source, PRESETS_DIR, { recursive: true });
}

/**
 * Replaces the generic Script Editor metadata with the product name and original icon.
 *
 * osacompile creates broad privacy usage strings even though this launcher only displays a dialog
 * and invokes the local deterministic CLI. Removing those unused declarations avoids misleading
 * users while the ad-hoc signature keeps the user-owned bundle internally consistent.
 *
 * @param {string} appPath Absolute path to the newly compiled managed launcher.
 * @returns {Promise<void>} Resolves after metadata, icon, marker, and signature are finalized.
 */
async function customizeLauncherBundle(appPath) {
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  const resources = path.join(appPath, 'Contents', 'Resources');
  const iconDestination = path.join(resources, LAUNCHER_ICON_FILE_NAME);
  const markerDestination = path.join(resources, LAUNCHER_MARKER_NAME);
  const icon = await fs.stat(LAUNCHER_ICON).catch(() => null);
  if (!icon?.isFile()) fail('LAUNCHER_ASSET_MISSING', 'The original launcher icon is missing.');

  await fs.copyFile(LAUNCHER_ICON, iconDestination);
  const setPlistString = async (key, value) => {
    await execFile('/usr/bin/plutil', ['-remove', key, plist]).catch(() => {});
    await execFile('/usr/bin/plutil', ['-insert', key, '-string', value, plist]);
  };
  await setPlistString('CFBundleIdentifier', LAUNCHER_BUNDLE_IDENTIFIER);
  await setPlistString('CFBundleName', 'Theme Studio for Codex');
  await setPlistString('CFBundleDisplayName', 'Theme Studio for Codex');
  await setPlistString('CFBundleIconFile', LAUNCHER_ICON_FILE_NAME);
  await setPlistString('CFBundleShortVersionString', VERSION);
  await setPlistString('CFBundleVersion', LAUNCHER_BUILD_VERSION);

  // osacompile ships a monochrome `applet` icon in Assets.car. CFBundleIconName would make
  // LaunchServices prefer that catalog asset over our ICNS file, producing the generic white icon.
  await execFile('/usr/bin/plutil', ['-remove', 'CFBundleIconName', plist]).catch(() => {});
  await fs.rm(path.join(resources, 'applet.icns'), { force: true });
  for (const key of APPLET_PRIVACY_KEYS) {
    await execFile('/usr/bin/plutil', ['-remove', key, plist]).catch(() => {});
  }
  await fs.writeFile(markerDestination, 'managed by Theme Studio for Codex\n', { mode: 0o600 });
  await execFile('/usr/bin/codesign', ['--force', '--sign', '-', '--timestamp=none', appPath], {
    timeout: 10_000,
  });
}

/**
 * Creates a user-owned macOS launcher that enters theme mode without a Terminal command.
 *
 * A launcher created under the former display name is removed only after the replacement has been
 * compiled and signed successfully, and only when its private managed marker is present. This
 * preserves unrelated applications and keeps upgrades recoverable if launcher creation fails.
 *
 * @returns {Promise<{installed: boolean, path?: string, reason?: string, migratedLegacy?: boolean,
 * launchServicesRegistered?: boolean}>} Launcher installation status. Existing unrelated
 * applications are never overwritten.
 */
async function installLauncher() {
  if (TEST_MODE) return { installed: false, reason: 'test-mode' };
  const existing = await fs.stat(LAUNCHER_APP).catch(() => null);
  const managed = await fs.stat(LAUNCHER_MARKER).catch(() => null);
  if (existing && !managed) fail('LAUNCHER_CONFLICT', 'An unrelated Theme Studio for Codex.app already exists.');
  const legacyManaged = Boolean(await fs.stat(LEGACY_LAUNCHER_MARKER).catch(() => null));

  const command = path.join(INSTALL_ROOT, 'scripts', 'cts');
  const source = launcherAppleScript(command);
  const sourceFile = path.join(STATE_DIR, `launcher-${process.pid}.applescript`);
  const stagedApp = path.join(STATE_DIR, `launcher-${process.pid}.app`);
  await fs.mkdir(path.dirname(LAUNCHER_APP), { recursive: true, mode: 0o700 });
  await fs.writeFile(sourceFile, source, { mode: 0o600 });
  try {
    await fs.rm(stagedApp, { recursive: true, force: true });
    await execFile('/usr/bin/osacompile', ['-o', stagedApp, sourceFile], { timeout: 10_000 });
    await customizeLauncherBundle(stagedApp);
    if (managed) {
      await execFile(LAUNCH_SERVICES_REGISTER, ['-u', LAUNCHER_APP], { timeout: 10_000 }).catch(() => {});
      await fs.rm(LAUNCHER_APP, { recursive: true, force: true });
    }
    await fs.rename(stagedApp, LAUNCHER_APP);
    if (legacyManaged) await fs.rm(LEGACY_LAUNCHER_APP, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(stagedApp, { recursive: true, force: true });
    throw error;
  } finally {
    await fs.rm(sourceFile, { force: true });
  }
  const launchServicesRegistered = await execFile(
    LAUNCH_SERVICES_REGISTER,
    ['-f', LAUNCHER_APP],
    { timeout: 10_000 },
  ).then(() => true, () => false);
  return {
    installed: true,
    path: LAUNCHER_APP,
    migratedLegacy: legacyManaged,
    launchServicesRegistered,
  };
}

export async function install() {
  const previousState = await readState();
  await ensureDataDirectories();
  await copyRuntime();
  await syncPresets();
  const launcher = await installLauncher();
  const freshInstall = !previousState.installedVersion;
  const legacyInstallation = Boolean(previousState.installedVersion)
    && previousState.onboardingVersion < 1;
  const nextState = await updateState({
    installedVersion: VERSION,
    onboardingVersion: 1,
    // Existing users keep their current/restored appearance after an upgrade. Only a genuinely
    // fresh installation receives the featured theme on its first theme-mode activation.
    ...(freshInstall ? { defaultThemeApplied: false } : {}),
    ...(legacyInstallation ? { defaultThemeApplied: true } : {}),
  });
  return {
    ok: true,
    version: VERSION,
    installRoot: INSTALL_ROOT,
    dataRoot: DATA_ROOT,
    launcher,
    onboarding: {
      freshInstall,
      launcherRequired: false,
      launcherDisplayPath: `~/Applications/${path.basename(LAUNCHER_APP)}`,
      defaultTheme: {
        id: DEFAULT_THEME_ID,
        name: DEFAULT_THEME_NAME,
        appliesOnFirstThemeModeActivation: !nextState.defaultThemeApplied && !nextState.activeTheme,
      },
      nextAction: launcher.installed
        ? `Open ~/Applications/${path.basename(LAUNCHER_APP)} once, or approve theme mode in this task.`
        : 'Approve theme mode in this task; no Terminal command is required.',
    },
  };
}

export async function availableThemes() {
  await ensureDataDirectories();
  return (await listThemes({ includeInvalid: true })).map(theme => theme.invalid ? {
    source: theme.source,
    invalid: theme.invalid,
  } : {
    id: theme.id,
    name: theme.name,
    appearance: theme.appearance,
    source: theme.source,
  });
}

function slug(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `custom-${Date.now()}`;
}

async function unusedDestination(id) {
  let candidate = id;
  let suffix = 2;
  while (await fs.stat(path.join(USER_THEMES_DIR, candidate)).catch(() => null)) candidate = `${id}-${suffix++}`;
  return { id: candidate, directory: path.join(USER_THEMES_DIR, candidate) };
}

export async function importTheme(inputPath, options = {}) {
  await ensureDataDirectories();
  const absolute = path.resolve(inputPath);
  const inputStat = await fs.lstat(absolute).catch(() => null);
  if (!inputStat) fail('IMPORT_NOT_FOUND', 'Import path does not exist.');
  if (inputStat.isSymbolicLink()) fail('THEME_INVALID', 'Symbolic links cannot be imported.');
  if (inputStat.isDirectory()) {
    const rejectLinks = async directory => {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) fail('THEME_INVALID', 'Theme packages may not contain symbolic links.');
        if (entry.isDirectory()) await rejectLinks(child);
      }
    };
    await rejectLinks(absolute);
    const source = await loadTheme(absolute);
    const destination = await unusedDestination(source.id);
    await fs.cp(absolute, destination.directory, { recursive: true, dereference: false, errorOnExist: true });
    const copiedManifest = JSON.parse(await fs.readFile(path.join(destination.directory, 'theme.json'), 'utf8'));
    copiedManifest.id = destination.id;
    await fs.writeFile(path.join(destination.directory, 'theme.json'), `${JSON.stringify(copiedManifest, null, 2)}\n`, { mode: 0o600 });
    const imported = await loadTheme(destination.directory);
    return { ok: true, id: imported.id, name: imported.name };
  }
  if (!inputStat.isFile()) fail('THEME_INVALID', 'Import must be an image file or theme directory.');
  const extension = path.extname(absolute).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) fail('THEME_INVALID', 'Image must be PNG, JPEG, or WebP.');
  const requestedName = typeof options.name === 'string' ? options.name.trim() : '';
  const name = (requestedName || path.basename(absolute, extension)).slice(0, 80) || 'Custom theme';
  const destination = await unusedDestination(slug(name));
  await fs.mkdir(destination.directory, { recursive: true, mode: 0o700 });
  const imageName = `background${extension}`;
  await fs.copyFile(absolute, path.join(destination.directory, imageName), fsSync.constants.COPYFILE_EXCL);
  await fs.writeFile(path.join(destination.directory, 'theme.json'), `${JSON.stringify({
    schemaVersion: 1,
    id: destination.id,
    name,
    appearance: 'auto',
    image: imageName,
    colors: {
      accent: options.colors?.accent ?? DEFAULT_COLORS.accent,
      surface: options.colors?.surface ?? DEFAULT_COLORS.surface,
      text: options.colors?.text ?? DEFAULT_COLORS.text,
      mutedText: options.colors?.mutedText ?? DEFAULT_COLORS.mutedText,
      overlay: options.colors?.overlay ?? DEFAULT_COLORS.overlay,
    },
    art: {
      focusX: options.art?.focusX ?? DEFAULT_ART.focusX,
      focusY: options.art?.focusY ?? DEFAULT_ART.focusY,
      safeArea: options.art?.safeArea ?? DEFAULT_ART.safeArea,
      safeSide: options.art?.safeSide ?? DEFAULT_ART.safeSide,
      homeMode: options.art?.homeMode ?? DEFAULT_ART.homeMode,
      taskMode: options.art?.taskMode ?? DEFAULT_ART.taskMode,
    },
    effects: {
      preset: options.effects?.preset ?? DEFAULT_EFFECTS.preset,
      intensity: options.effects?.intensity ?? DEFAULT_EFFECTS.intensity,
      motion: options.effects?.motion ?? DEFAULT_EFFECTS.motion,
    },
  }, null, 2)}\n`, { mode: 0o600 });
  try {
    const imported = await loadTheme(destination.directory);
    return { ok: true, id: imported.id, name: imported.name };
  } catch (error) {
    await fs.rm(destination.directory, { recursive: true, force: true });
    throw error;
  }
}

async function restorePages({ alreadyVerified = false } = {}) {
  if (!alreadyVerified) {
    try { await doctor(); }
    catch (error) {
      if (['APP_NOT_RUNNING', 'CDP_UNAVAILABLE', 'APP_IDENTITY_FAILED'].includes(error.code)) return [];
      throw error;
    }
  }
  return withCodexPages(async session => {
    await assertPageIdentity(session);
    return session.evaluate(restoreExpression());
  }).catch(error => {
    if (['CDP_UNAVAILABLE', 'TARGET_IDENTITY_FAILED'].includes(error.code)) return [];
    throw error;
  });
}

export async function inject(theme, demoMode) {
  await doctor();
  try {
    return await withCodexPages(async session => {
      await assertPageIdentity(session);
      return session.evaluate(injectionExpression(theme, { demoMode }));
    });
  } catch (error) {
    await restorePages({ alreadyVerified: true });
    throw error;
  }
}

async function fingerprint(pid) {
  const { stdout } = await execFile('/bin/ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'command='], { timeout: 2_000 }).catch(() => ({ stdout: '' }));
  const lines = stdout.trim().split('\n');
  if (!lines[0]) return null;
  return { started: lines[0].slice(0, 24).trim(), command: lines[0].slice(24).trim() };
}

export async function stopDaemon() {
  const record = await readDaemon();
  if (!record?.pid) return { stopped: false };
  const current = await fingerprint(record.pid);
  const matches = current && current.started === record.started && current.command.includes(record.cliPath);
  if (matches) {
    process.kill(record.pid, 'SIGTERM');
    for (let index = 0; index < 20; index += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (!(await fingerprint(record.pid))) break;
    }
  }
  await removeDaemonFile();
  return { stopped: Boolean(matches) };
}

export async function startDaemon() {
  await stopDaemon();
  await appendRuntimeEvent('WATCH_START');
  const log = await fs.open(RUNTIME_LOG, 'a', 0o600);
  const child = spawn('/bin/sh', [WATCHER_SCRIPT, process.execPath, CLI_PATH], {
    detached: true,
    stdio: ['ignore', log.fd, log.fd],
    env: { ...process.env, CTS_DAEMON: '1' },
  });
  child.unref();
  await new Promise(resolve => setTimeout(resolve, 80));
  const current = await fingerprint(child.pid);
  await log.close();
  if (!current) fail('DAEMON_FAILED', 'Theme watcher did not start.');
  await writeDaemon({
    pid: child.pid,
    cliPath: WATCHER_SCRIPT,
    started: current.started,
    createdAt: new Date().toISOString(),
  });
  return { pid: child.pid };
}

/**
 * Selects the theme that should be restored or applied when theme mode starts.
 *
 * A theme explicitly requested by the user always wins. Otherwise an existing active theme is
 * restored. The featured default is selected only once for a fresh installation; after the user
 * restores the original appearance, later launcher opens must not silently reapply it.
 *
 * @param {object} state Persisted local theme state; missing optional fields use safe defaults.
 * @param {string|null} requestedThemeId Theme chosen in the current user request, if any.
 * @returns {{id: string, source: 'requested'|'active'|'default'}|null} Activation target or null
 * when theme mode should start without applying a theme.
 */
export function activationThemeForState(state, requestedThemeId = null) {
  if (requestedThemeId) return { id: requestedThemeId, source: 'requested' };
  if (state?.activeTheme) return { id: state.activeTheme, source: 'active' };
  if (!state?.defaultThemeApplied) return { id: DEFAULT_THEME_ID, source: 'default' };
  return null;
}

/**
 * Enables loopback-only theme mode and restores the user's theme in one deterministic command.
 *
 * The launcher uses this operation so first use cannot stop at “ChatGPT reopened but no theme was
 * applied”. A requested theme bypasses the featured default, while a fresh install with no choice
 * receives 万妖图录·龙渊灵姬 exactly once. Apply/verify failures retain the existing rollback
 * behavior and do not consume the one-time default.
 *
 * @param {{confirmed?: boolean, requestedThemeId?: string|null}} options Restart consent and an
 * optional theme ID resolved from the user's current request.
 * @returns {Promise<object>} Sanitized runtime and applied-theme status for user-facing feedback.
 */
export async function activateThemeMode({ confirmed = false, requestedThemeId = null } = {}) {
  // Validate an explicit choice before restarting the desktop app so a typo cannot cause an
  // unnecessary interruption and then fail only after ChatGPT returns.
  if (requestedThemeId && !TEST_MODE) {
    await findTheme(requestedThemeId, { loadImage: false });
  }
  const runtime = await enableThemeMode({ confirmed });
  const state = await readState();
  const target = activationThemeForState(state, requestedThemeId);
  if (!target || TEST_MODE) {
    return {
      ...runtime,
      theme: null,
      originalAppearancePreserved: !target,
      defaultTheme: target?.source === 'default'
        ? { id: DEFAULT_THEME_ID, name: DEFAULT_THEME_NAME, pending: true }
        : null,
    };
  }

  const applied = await applyTheme(target.id);
  return {
    ...runtime,
    theme: applied.theme,
    pages: applied.pages,
    watcher: applied.watcher,
    defaultThemeApplied: target.source === 'default',
    restoredActiveTheme: target.source === 'active',
  };
}

export async function applyTheme(id, { daemon = true } = {}) {
  const theme = await findTheme(id);
  const state = await readState();
  let pages;
  try {
    await inject(theme, state.demoMode);
    pages = await verifyInjectedTheme(theme, state.demoMode);
  } catch (error) {
    await stopDaemon();
    // Verification already restores incomplete decorations. Preserve the user's previous theme
    // selection so a transient page or desktop-app failure can be retried instead of becoming an
    // irreversible loss of state.
    await updateState({
      activeTheme: state.activeTheme,
      demoMode: state.demoMode,
      watchFailureCount: 0,
      watchRetryAt: null,
    });
    throw error;
  }
  // Any permanent user choice consumes the one-time featured default. A later restore therefore
  // remains respected instead of causing the launcher to reapply 龙渊灵姬 on its next open.
  await updateState({
    activeTheme: theme.id,
    defaultThemeApplied: true,
    watchFailureCount: 0,
    watchRetryAt: null,
  });
  const watcher = daemon ? await startDaemon() : null;
  return { ok: true, theme: { id: theme.id, name: theme.name }, pages: pages.length, watcher };
}

export async function previewTheme(id, seconds = 30) {
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 120) fail('INVALID_ARGUMENT', 'Preview duration must be 5–120 seconds.');
  const theme = await findTheme(id);
  const state = await readState();
  // Pause the watcher so it cannot race the temporary preview by re-applying the active theme.
  await stopDaemon();
  let interrupted = false;
  let wake;
  let previewTimer;
  let previewError = null;
  let verified = false;
  const interrupt = () => { interrupted = true; wake?.(); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    await inject(theme, state.demoMode);
    await verifyInjectedTheme(theme, state.demoMode);
    verified = true;
    if (!interrupted) {
      await new Promise(resolve => { wake = resolve; previewTimer = setTimeout(resolve, seconds * 1_000); });
    }
  } catch (error) {
    previewError = error;
  }
  finally {
    clearTimeout(previewTimer);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    try {
      if (state.activeTheme) {
        const activeTheme = await findTheme(state.activeTheme);
        await inject(activeTheme, state.demoMode);
        await verifyInjectedTheme(activeTheme, state.demoMode);
        await startDaemon();
      } else {
        await restorePages();
      }
    } catch (restoreError) {
      // Remove incomplete decoration, but retain the user's prior selection for an explicit retry.
      await restorePages().catch(() => []);
      await updateState({
        activeTheme: state.activeTheme,
        demoMode: state.demoMode,
        watchFailureCount: 1,
        watchRetryAt: null,
      });
      if (!previewError) previewError = restoreError;
    }
  }
  if (previewError) throw previewError;
  return { ok: true, theme: { id: theme.id, name: theme.name }, seconds, verified, restored: true, interrupted };
}

async function verifyInjectedTheme(theme, demoMode = null) {
  const themeId = typeof theme === 'string' ? theme : theme.id;
  const fingerprint = typeof theme === 'string' ? null : theme.fingerprint;
  const results = await withCodexPages(async session => {
    await assertPageIdentity(session);
    const result = await session.evaluate(verifyExpression(themeId, fingerprint, demoMode));
    // One auxiliary or hidden renderer must not restore otherwise healthy Codex pages. Clean up
    // only the incomplete target here, then decide success from the aggregate below.
    if (!result?.ok) await session.evaluate(restoreExpression()).catch(() => true);
    return result;
  });
  const { healthy } = partitionThemeVerificationResults(results);
  if (!healthy.length) {
    await restorePages({ alreadyVerified: true });
    fail('VERIFY_FAILED', 'Theme verification failed and the original appearance was restored.', { results });
  }
  return healthy;
}

export async function verifyTheme() {
  await doctor();
  const state = await readState();
  if (!state.activeTheme) fail('NO_ACTIVE_THEME', 'No theme is currently active.');
  try {
    const theme = await findTheme(state.activeTheme, { loadImage: false });
    const results = await verifyInjectedTheme(theme, state.demoMode);
    return { ok: true, themeId: state.activeTheme, pages: results.length, checks: results };
  } catch (error) {
    await stopDaemon();
    // Keep the desired theme ID. The page has already been restored and the stopped watcher will
    // not reapply it until the user retries or re-enables theme mode.
    await updateState({ watchFailureCount: 1, watchRetryAt: null });
    throw error;
  }
}

/**
 * Checks the current official desktop build against the page adapter contract.
 *
 * This is intentionally structural: it reports application identity, supported routes and theme
 * roles without reading task text, prompt content, usernames or local project paths.
 *
 * @returns {Promise<object>} Sanitized compatibility status for the current ChatGPT/Codex build.
 */
export async function checkCompatibility() {
  const runtime = await doctor();
  const state = await readState();
  const theme = state.activeTheme
    ? await findTheme(state.activeTheme, { loadImage: false })
    : null;
  const checks = await withCodexPages(async session => {
    const identity = await assertPageIdentity(session);
    if (!theme) {
      return {
        ok: identity.ok,
        adapterVersion: null,
        route: null,
        identityMarker: identity.marker,
      };
    }
    return session.evaluate(verifyExpression(theme.id, theme.fingerprint, state.demoMode));
  });
  return {
    ok: checks.length > 0 && checks.every(check => check?.ok),
    application: {
      name: runtime.bundle.displayName,
      version: runtime.bundle.version,
      build: runtime.bundle.build,
      profile: runtime.bundle.profile,
      identityCached: Boolean(runtime.bundle.identity?.cached),
    },
    activeTheme: state.activeTheme,
    pages: checks.length,
    checks,
  };
}

export async function restore() {
  await stopDaemon();
  const pages = await restorePages();
  await updateState({
    activeTheme: null,
    demoMode: false,
    watchFailureCount: 0,
    watchRetryAt: null,
  });
  return { ok: true, restored: true, pages: pages.length };
}

export async function setDemoMode(enabled) {
  const state = await readState();
  if (!state.activeTheme) fail('NO_ACTIVE_THEME', 'Apply a theme before changing demo mode.');
  const theme = await findTheme(state.activeTheme);
  await stopDaemon();
  await inject(theme, enabled);
  await verifyInjectedTheme(theme, enabled);
  await updateState({ demoMode: enabled });
  await startDaemon();
  return { ok: true, demoMode: enabled };
}

export async function uninstall({ deleteUserData = false } = {}) {
  await restore();
  if (await fs.stat(LAUNCHER_MARKER).catch(() => null)) {
    await fs.rm(LAUNCHER_APP, { recursive: true, force: true });
  }
  if (await fs.stat(LEGACY_LAUNCHER_MARKER).catch(() => null)) {
    await fs.rm(LEGACY_LAUNCHER_APP, { recursive: true, force: true });
  }
  await fs.rm(INSTALL_ROOT, { recursive: true, force: true });
  if (deleteUserData) await fs.rm(DATA_ROOT, { recursive: true, force: true });
  return { ok: true, removedRuntime: true, preservedUserData: !deleteUserData };
}

/**
 * Gives ChatGPT's route shell a bounded window to finish mounting before a watcher cycle treats
 * missing main/composer roles as an adapter failure. Route transitions replace these nodes
 * transiently, so a single immediate verification can otherwise create a restore/reapply loop.
 *
 * @param {object} session Validated loopback CDP session for one eligible app page.
 * @param {object} theme Active theme metadata; its ID and fingerprint must match the injection.
 * @param {boolean} demoMode Whether privacy-safe demo substitutions are expected.
 * @param {{attempts?: number, delayMs?: number, delay?: (ms: number) => Promise<void>}} options
 * Bounded retry controls. The injected delay exists so tests do not wait on wall-clock time.
 * @returns {Promise<object|null>} Last structured verification result; `ok` is true when stable.
 */
export async function waitForStableThemeVerification(
  session,
  theme,
  demoMode,
  {
    attempts = WATCH_VERIFY_ATTEMPTS,
    delayMs = WATCH_VERIFY_DELAY_MS,
    delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
  } = {},
) {
  let status = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    status = await session.evaluate(verifyExpression(theme.id, theme.fingerprint, demoMode));
    if (status?.ok) return status;
    if (attempt + 1 < attempts) await delay(delayMs);
  }
  return status;
}

/**
 * Separates healthy targets from incomplete auxiliary or hidden renderers.
 *
 * A desktop release can expose several eligible page targets at once. Theme health is therefore
 * established by at least one complete Codex page instead of requiring every auxiliary renderer
 * to have the same layout at the same moment.
 *
 * @param {object[]} results Sanitized page verification results.
 * @returns {{healthy: object[], unhealthy: object[]}} Stable aggregate without page text.
 */
export function partitionThemeVerificationResults(results = []) {
  const healthy = results.filter(result => result?.ok);
  return { healthy, unhealthy: results.filter(result => !result?.ok) };
}

/**
 * Computes a bounded exponential retry delay after every all-page verification failure.
 *
 * Backoff prevents visible restore/reapply flicker while retaining the user's selected theme so a
 * later healthy page or official app restart can recover automatically.
 *
 * @param {number} failureCount Consecutive all-page failures, starting at one.
 * @returns {number} Retry delay in milliseconds, capped at five minutes.
 */
export function watchRetryDelay(failureCount) {
  const exponent = Math.max(0, Math.min(10, Number(failureCount || 1) - 1));
  return Math.min(WATCH_RETRY_MAX_MS, WATCH_RETRY_BASE_MS * (2 ** exponent));
}

/**
 * Reconciles the active theme once, then returns so the full Node/CDP process can exit.
 *
 * A short-lived cycle is intentional: retaining the complete Node runtime between 30-second
 * checks costs substantially more memory than the background image and CSS being managed.
 *
 * @returns {Promise<{continue: boolean, pages?: number}>} Whether the lightweight supervisor
 * should schedule another cycle and the number of eligible pages checked.
 */
export async function watchCycle() {
  const state = await readState();
  if (!state.activeTheme) {
    if (process.env.CTS_DAEMON === '1') await fs.rm(DAEMON_FILE, { force: true });
    return { continue: false };
  }

  const retryAt = Date.parse(state.watchRetryAt || '');
  if (Number.isFinite(retryAt) && retryAt > Date.now()) {
    return { continue: true, suspended: true, retryAt: state.watchRetryAt };
  }

  try {
    const themeMetadata = await findTheme(state.activeTheme, { loadImage: false });
    await doctor();
    let loadedTheme = null;
    const results = await withCodexPages(async session => {
      await assertPageIdentity(session);
      let status = await session.evaluate(
        verifyExpression(themeMetadata.id, themeMetadata.fingerprint, state.demoMode),
      );
      if (status?.ok) return status;

      loadedTheme ??= await loadTheme(themeMetadata.directory, { loadImage: true });
      await session.evaluate(injectionExpression(loadedTheme, { demoMode: state.demoMode }));
      status = await waitForStableThemeVerification(
        session,
        themeMetadata,
        state.demoMode,
      );
      if (!status?.ok) {
        await session.evaluate(restoreExpression()).catch(() => true);
      }
      return status;
    });
    const { healthy, unhealthy } = partitionThemeVerificationResults(results);
    if (!healthy.length) {
      const failureCount = Number(state.watchFailureCount || 0) + 1;
      const retryDelay = watchRetryDelay(failureCount);
      const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
      await updateState({ watchFailureCount: failureCount, watchRetryAt: nextRetryAt });
      await appendRuntimeEvent('WATCH_BACKOFF');
      return {
        continue: true,
        pages: 0,
        unhealthyPages: unhealthy.length,
        suspended: true,
        retryAt: nextRetryAt,
      };
    }
    if (state.watchFailureCount || state.watchRetryAt) {
      await updateState({ watchFailureCount: 0, watchRetryAt: null });
      await appendRuntimeEvent('WATCH_RECOVERED');
    }
    if (unhealthy.length) await appendRuntimeEvent('WATCH_PARTIAL');
    return { continue: true, pages: healthy.length, unhealthyPages: unhealthy.length };
  } catch (error) {
    await appendRuntimeEvent(error.code || 'WATCH_ERROR');
    if (error.code === 'THEME_NOT_FOUND') {
      // A removed theme cannot recover. Unlike page verification failures, clearing this missing
      // identifier prevents an endless lookup loop without discarding a valid user selection.
      await restorePages({ alreadyVerified: true }).catch(() => []);
      await updateState({
        activeTheme: null,
        demoMode: false,
        watchFailureCount: 0,
        watchRetryAt: null,
      });
      await appendRuntimeEvent('WATCH_DEACTIVATED');
      return { continue: false, deactivated: true };
    }
    return { continue: true };
  }
}

/**
 * Retains the original foreground watch command for diagnostics and test environments.
 *
 * Production uses the shell supervisor plus {@link watchCycle}; this loop therefore does not run
 * in the normal installed background path.
 *
 * @returns {Promise<void>} Resolves after the active theme is removed or the process is stopped.
 */
export async function watch() {
  let stopping = false;
  let wake = null;
  const stop = () => { stopping = true; wake?.(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  while (!stopping) {
    const result = await watchCycle();
    if (!result.continue) break;
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 30_000);
      wake = () => { clearTimeout(timer); resolve(); };
    });
    wake = null;
  }
  if (process.env.CTS_DAEMON === '1') await fs.rm(DAEMON_FILE, { force: true });
}
