import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  APPLICATION_BUNDLES,
  APP_IDENTITY_CACHE_FILE,
  CDP_ORIGIN,
  STATE_DIR,
  TEST_MODE,
} from './config.mjs';
import { getTargets, getVersion } from './cdp.mjs';
import { fail } from './errors.mjs';

const execFile = promisify(execFileCallback);
const BUNDLE_ID = 'com.openai.codex';
const OPENAI_TEAM_ID = '2DC432GLL2';
const IDENTITY_CACHE_SCHEMA = 2;

async function run(command, args) {
  return execFile(command, args, { timeout: 4_000, maxBuffer: 1024 * 1024 });
}

async function plistValue(info, key, fallback = '') {
  try {
    return (await run('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', info])).stdout.trim();
  } catch {
    return fallback;
  }
}

export function applicationProfile(displayName) {
  const normalized = displayName.toLowerCase();
  if (normalized === 'chatgpt') return 'chatgpt-current';
  if (normalized === 'codex') return 'codex-legacy';
  return null;
}

async function inspectBundle(bundlePath) {
  const info = path.join(bundlePath, 'Contents/Info.plist');
  if (!(await fs.stat(info).catch(() => null))?.isFile()) return null;
  const [identifier, displayName, executableName, version, build] = await Promise.all([
    plistValue(info, 'CFBundleIdentifier'),
    plistValue(info, 'CFBundleDisplayName', path.basename(bundlePath, '.app')),
    plistValue(info, 'CFBundleExecutable'),
    plistValue(info, 'CFBundleShortVersionString', 'unknown'),
    plistValue(info, 'CFBundleVersion', 'unknown'),
  ]);
  const profile = applicationProfile(displayName);
  if (identifier !== BUNDLE_ID || !executableName || !profile) return null;
  const executable = path.join(bundlePath, 'Contents/MacOS', executableName);
  if (!(await fs.stat(executable).catch(() => null))?.isFile()) return null;
  return {
    path: await fs.realpath(bundlePath),
    identifier,
    displayName,
    executable,
    executableName,
    version,
    build,
    profile,
  };
}

function statFingerprint(stat) {
  return stat ? {
    size: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
    ino: stat.ino,
    dev: stat.dev,
  } : null;
}

function signatureValue(signature, key) {
  return signature.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim() || '';
}

/**
 * Confirms that the embedded designated requirement identifies OpenAI's Codex desktop bundle.
 *
 * Full resource-envelope verification is intentionally not used as an availability gate because
 * current official desktop builds can fail `codesign --verify --deep --strict` after installation
 * even while their stable signing identity, bundle metadata and notarization ticket remain intact.
 * The runtime still requires the Apple Developer ID requirement, exact bundle identifier and Team
 * ID before it will inspect the running process or connect to loopback CDP.
 *
 * @param {string} requirement Output from `codesign -d -r-`; empty output is never accepted.
 * @returns {boolean} True only when every stable Apple/OpenAI identity signal is present.
 */
export function designatedRequirementMatches(requirement) {
  return [
    'identifier "com.openai.codex"',
    'anchor apple generic',
    'certificate 1[field.1.2.840.113635.100.6.2.6]',
    'certificate leaf[field.1.2.840.113635.100.6.1.13]',
    `certificate leaf[subject.OU] = "${OPENAI_TEAM_ID}"`,
  ].every(signal => requirement.includes(signal));
}

/**
 * Confirms that macOS reports the running process as OpenAI's valid Developer ID code.
 *
 * Static resource-envelope checks can produce false negatives for a currently supported desktop
 * build. Before CDP is touched, the runtime therefore asks macOS to validate the live process and
 * then checks the identity and complete Developer ID authority chain returned for that PID.
 *
 * @param {string} signature Output from `codesign -d --verbose=4 +PID`; never page content.
 * @returns {boolean} True only for the expected Codex identifier, Team ID and Apple trust chain.
 */
export function runningSignatureMatches(signature) {
  const authorities = [...signature.matchAll(/^Authority=(.+)$/gm)]
    .map(match => match[1].trim());
  const openAiDeveloperId = new RegExp(
    `^Developer ID Application: .+ \\(${OPENAI_TEAM_ID}\\)$`,
  );
  return signatureValue(signature, 'Identifier') === BUNDLE_ID
    && signatureValue(signature, 'TeamIdentifier') === OPENAI_TEAM_ID
    && authorities.some(authority => openAiDeveloperId.test(authority))
    && authorities.includes('Developer ID Certification Authority')
    && authorities.includes('Apple Root CA');
}

/**
 * Builds a stable fingerprint for one installed application build.
 *
 * The fingerprint exists so stable bundle-identity inspection is reused only while the executable
 * and CodeResources metadata remain unchanged. It never replaces the live-process validity check
 * performed before a CDP connection.
 *
 * @param {object} bundle Metadata read from the candidate application bundle.
 * @param {string} signature Output from `codesign -dv --verbose=4`.
 * @returns {Promise<object>} Cache-safe build identity without page, prompt, or task content.
 */
async function bundleFingerprint(bundle, signature) {
  const resources = path.join(bundle.path, 'Contents/_CodeSignature/CodeResources');
  const [executableStat, resourcesStat] = await Promise.all([
    fs.stat(bundle.executable),
    fs.stat(resources).catch(() => null),
  ]);
  return {
    path: bundle.path,
    identifier: bundle.identifier,
    profile: bundle.profile,
    version: bundle.version,
    build: bundle.build,
    executableName: bundle.executableName,
    cdHash: signatureValue(signature, 'CDHash'),
    teamIdentifier: signatureValue(signature, 'TeamIdentifier'),
    executable: statFingerprint(executableStat),
    codeResources: statFingerprint(resourcesStat),
  };
}

export function identityCacheMatches(entry, fingerprint) {
  if (!entry?.fingerprint || !fingerprint) return false;
  return JSON.stringify(entry.fingerprint) === JSON.stringify(fingerprint);
}

async function readIdentityCache() {
  try {
    const parsed = JSON.parse(await fs.readFile(APP_IDENTITY_CACHE_FILE, 'utf8'));
    return parsed.schemaVersion === IDENTITY_CACHE_SCHEMA && Array.isArray(parsed.entries)
      ? parsed
      : { schemaVersion: IDENTITY_CACHE_SCHEMA, entries: [] };
  } catch {
    return { schemaVersion: IDENTITY_CACHE_SCHEMA, entries: [] };
  }
}

async function writeIdentityCache(entry) {
  const cache = await readIdentityCache();
  const entries = cache.entries
    .filter(item => item?.fingerprint?.path !== entry.fingerprint.path)
    .concat(entry)
    .slice(-8);
  const temporary = `${APP_IDENTITY_CACHE_FILE}.${process.pid}.tmp`;
  await fs.mkdir(STATE_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(temporary, `${JSON.stringify({
    schemaVersion: IDENTITY_CACHE_SCHEMA,
    entries,
  }, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, APP_IDENTITY_CACHE_FILE);
}

function throwCachedIdentityFailure(bundle, reason) {
  const message = reason === 'team'
    ? `${bundle.displayName} is not signed by the expected OpenAI team.`
    : `${bundle.displayName} does not contain the expected Apple/OpenAI signing requirement.`;
  fail('APP_IDENTITY_FAILED', message, {
    application: bundle.displayName,
    version: bundle.version,
    build: bundle.build,
    injectionAvailable: false,
  });
}

/**
 * Inspects an app build once and caches either the stable identity or a stable rejection.
 *
 * @param {object} bundle Candidate returned by `inspectBundle`.
 * @returns {Promise<object>} Verification metadata including whether the cache was used.
 */
async function verifyBundleIdentity(bundle) {
  const [detail, requirementDetail] = await Promise.all([
    run('/usr/bin/codesign', ['-dv', '--verbose=4', bundle.path])
      .catch(() => fail('APP_IDENTITY_FAILED', `${bundle.displayName} has no readable code signature.`)),
    run('/usr/bin/codesign', ['-d', '-r-', bundle.path])
      .catch(() => fail('APP_IDENTITY_FAILED', `${bundle.displayName} has no readable signing requirement.`)),
  ]);
  const signature = `${detail.stdout}\n${detail.stderr}`;
  const requirement = `${requirementDetail.stdout}\n${requirementDetail.stderr}`;
  const fingerprint = await bundleFingerprint(bundle, signature);
  const cache = await readIdentityCache();
  const cached = cache.entries.find(entry => identityCacheMatches(entry, fingerprint));
  if (cached?.status === 'verified') {
    return { cached: true, checkedAt: cached.checkedAt, integrity: cached.integrity };
  }
  if (cached?.status === 'rejected') throwCachedIdentityFailure(bundle, cached.reason);

  if (fingerprint.teamIdentifier !== OPENAI_TEAM_ID) {
    await writeIdentityCache({
      fingerprint, status: 'rejected', reason: 'team', checkedAt: new Date().toISOString(),
    });
    throwCachedIdentityFailure(bundle, 'team');
  }

  if (!designatedRequirementMatches(requirement)) {
    await writeIdentityCache({
      fingerprint, status: 'rejected', reason: 'requirement', checkedAt: new Date().toISOString(),
    });
    throwCachedIdentityFailure(bundle, 'requirement');
  }

  // Keep the complete on-disk resource envelope as a diagnostic. The hard validity gate is the
  // running process check below, which macOS evaluates against the code it actually launched.
  const integrity = await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle.path])
    .then(() => 'static-verified', () => 'runtime-verification-required');
  const checkedAt = new Date().toISOString();
  await writeIdentityCache({ fingerprint, status: 'verified', integrity, checkedAt });
  return { cached: false, integrity, checkedAt };
}

async function cachedVerifiedBundle(bundles) {
  const cache = await readIdentityCache();
  for (const bundle of bundles) {
    const detail = await run('/usr/bin/codesign', ['-dv', '--verbose=4', bundle.path]).catch(() => null);
    if (!detail) continue;
    const signature = `${detail.stdout}\n${detail.stderr}`;
    const fingerprint = await bundleFingerprint(bundle, signature);
    if (cache.entries.some(entry => entry.status === 'verified' && identityCacheMatches(entry, fingerprint))) {
      return bundle;
    }
  }
  return null;
}

export async function resolveApplication({ verifySignature = true } = {}) {
  const found = [];
  for (const candidate of APPLICATION_BUNDLES) {
    const bundle = await inspectBundle(candidate);
    if (bundle) found.push(bundle);
  }
  if (!found.length) {
    fail('APP_IDENTITY_FAILED', 'An official ChatGPT or legacy Codex desktop app was not found.');
  }
  found.sort((a, b) => Number(b.profile === 'chatgpt-current') - Number(a.profile === 'chatgpt-current'));
  if (!verifySignature) return await cachedVerifiedBundle(found) || found[0];

  let firstFailure;
  for (const bundle of found) {
    try {
      bundle.identity = await verifyBundleIdentity(bundle);
      return bundle;
    } catch (error) {
      if (error.code !== 'APP_IDENTITY_FAILED') throw error;
      firstFailure ||= error;
    }
  }
  throw firstFailure;
}

async function verifyProcess(bundle) {
  const { stdout } = await run('/bin/ps', ['-axo', 'pid=,command=']);
  const line = stdout.split('\n').find(item => item.trim().match(/^\d+\s+/) && item.includes(bundle.executable));
  if (!line) fail('APP_NOT_RUNNING', `${bundle.displayName} is not running.`);
  const command = line.trim().replace(/^\d+\s+/, '');
  const origin = new URL(CDP_ORIGIN);
  const port = origin.port || '9222';
  if (!command.includes(`--remote-debugging-port=${port}`)) {
    fail('CDP_PROCESS_MISMATCH', `${bundle.displayName} does not own the configured CDP port.`);
  }
  if (!command.includes('--remote-debugging-address=127.0.0.1')) {
    fail('CDP_NOT_LOOPBACK', `${bundle.displayName} was not explicitly bound to 127.0.0.1.`);
  }
  const pid = Number(line.trim().split(/\s+/, 1)[0]);
  await run('/usr/bin/codesign', ['-v', `+${pid}`])
    .catch(() => fail('APP_IDENTITY_FAILED', `${bundle.displayName} is not a dynamically valid macOS process.`));
  const detail = await run('/usr/bin/codesign', ['-d', '--verbose=4', `+${pid}`])
    .catch(() => fail('APP_IDENTITY_FAILED', `${bundle.displayName} has no readable running signature.`));
  const signature = `${detail.stdout}\n${detail.stderr}`;
  if (!runningSignatureMatches(signature)) {
    fail('APP_IDENTITY_FAILED', `${bundle.displayName} is not a valid OpenAI-signed running process.`);
  }
  return { pid, executable: bundle.executable, identity: 'dynamically-verified' };
}

async function applicationProcesses(bundle) {
  const { stdout } = await run('/bin/ps', ['-axo', 'pid=,command=']);
  return stdout.split('\n').flatMap(item => {
    const match = item.trim().match(/^(\d+)\s+(.+)$/);
    if (!match || !match[2].includes(bundle.executable)) return [];
    return [{ pid: Number(match[1]), command: match[2] }];
  });
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * Restarts the verified official desktop app with a loopback-only CDP endpoint.
 *
 * This is the deterministic implementation behind the Skill's one-click consent flow. It never
 * edits the app bundle or persists debugging on a non-loopback address.
 *
 * @param {{confirmed?: boolean}} options Whether the user explicitly approved closing ChatGPT.
 * @returns {Promise<object>} Runtime health after the relaunched page passes identity checks.
 */
export async function enableThemeMode({ confirmed = false } = {}) {
  if (!confirmed) {
    fail('RESTART_CONSENT_REQUIRED', 'Explicit confirmation is required before restarting ChatGPT.', {
      action: 'Close and reopen ChatGPT with a loopback-only local theme endpoint.',
    });
  }
  if (process.platform !== 'darwin' && !TEST_MODE) {
    fail('UNSUPPORTED_PLATFORM', 'Theme Studio for Codex v0.1.0 supports macOS only.');
  }
  if (TEST_MODE) return { ok: true, restarted: false, alreadyEnabled: true, application: 'ChatGPT' };

  const bundle = await resolveApplication({ verifySignature: true });
  const origin = new URL(CDP_ORIGIN);
  const port = origin.port || '9222';
  const processes = await applicationProcesses(bundle);
  const enabled = processes.some(processInfo =>
    processInfo.command.includes(`--remote-debugging-port=${port}`)
    && processInfo.command.includes('--remote-debugging-address=127.0.0.1'));
  if (enabled) {
    const runtime = await doctor();
    return { ...runtime, restarted: false, alreadyEnabled: true };
  }

  if (processes.length) {
    await run('/usr/bin/osascript', ['-e', `tell application "${bundle.displayName}" to quit`])
      .catch(() => fail('APP_QUIT_FAILED', `${bundle.displayName} could not be closed safely.`));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (!(await applicationProcesses(bundle)).length) break;
      if (attempt === 59) fail('APP_QUIT_TIMEOUT', `${bundle.displayName} did not finish closing.`);
      await delay(250);
    }
  }

  await run('/usr/bin/open', [
    '-na', bundle.displayName, '--args',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
  ]).catch(() => fail('APP_LAUNCH_FAILED', `${bundle.displayName} could not be opened in theme mode.`));

  let lastError;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      const runtime = await doctor();
      return { ...runtime, restarted: true, alreadyEnabled: false };
    } catch (error) {
      lastError = error;
      if (![
        'APP_NOT_RUNNING',
        'CDP_PROCESS_MISMATCH',
        'CDP_UNAVAILABLE',
        'TARGET_IDENTITY_FAILED',
      ].includes(error.code)) throw error;
      await delay(250);
    }
  }
  fail('THEME_MODE_TIMEOUT', `${bundle.displayName} did not become ready for themes.`, {
    cause: lastError?.code || 'UNKNOWN',
    restartCommand: restartCommand(bundle),
  });
}

async function inspectRuntime({ verifySignature, requirePage }) {
  if (process.platform !== 'darwin' && !TEST_MODE) fail('UNSUPPORTED_PLATFORM', 'Theme Studio for Codex v0.1.0 supports macOS only.');
  const bundle = TEST_MODE ? {
    path: '/Applications/ChatGPT.app', identifier: BUNDLE_ID, displayName: 'ChatGPT',
    executable: process.execPath, executableName: path.basename(process.execPath), version: 'test',
    build: 'test', profile: 'chatgpt-current',
  } : await resolveApplication({ verifySignature });
  let processInfo;
  try { processInfo = TEST_MODE ? { pid: process.pid, executable: process.execPath } : await verifyProcess(bundle); }
  catch (error) {
    if (['APP_NOT_RUNNING', 'CDP_PROCESS_MISMATCH'].includes(error.code)) {
      error.details = { restartCommand: restartCommand(bundle), application: bundle.displayName };
    }
    throw error;
  }
  let version;
  try { version = await getVersion(); }
  catch (error) {
    if (error.code === 'CDP_UNAVAILABLE') error.details = { restartCommand: restartCommand(bundle), application: bundle.displayName };
    throw error;
  }
  const targets = requirePage ? await getTargets() : [];
  if (requirePage && !targets.length) fail('TARGET_IDENTITY_FAILED', 'CDP is reachable, but no eligible ChatGPT/Codex app page passed validation.');
  return { ok: true, bundle, process: processInfo, browser: version.Browser || 'Chromium', targets: targets.length };
}

export function restartCommand(bundle = { displayName: 'ChatGPT' }) {
  const origin = new URL(CDP_ORIGIN);
  const name = bundle.profile === 'codex-legacy' ? 'Codex' : 'ChatGPT';
  return `open -na "${name}" --args --remote-debugging-address=127.0.0.1 --remote-debugging-port=${origin.port || '9222'}`;
}

export async function doctor({ requirePage = true } = {}) {
  return inspectRuntime({ verifySignature: true, requirePage });
}

/**
 * Performs the watcher health check after a process has passed full identity validation.
 *
 * @param {{requirePage?: boolean}} options Whether at least one eligible app page must be available.
 * @returns {Promise<object>} Current process, CDP, and target health without repeating static deep verification.
 */
export async function healthCheck({ requirePage = true } = {}) {
  return inspectRuntime({ verifySignature: false, requirePage });
}
