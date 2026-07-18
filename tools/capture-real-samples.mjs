#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  CdpSession,
  getTargets,
} from '../plugins/codex-theme-studio/runtime/src/cdp.mjs';
import {
  assertPageIdentity,
  SELECTORS,
} from '../plugins/codex-theme-studio/runtime/src/adapter.mjs';

const execFile = promisify(execFileCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'plugins/codex-theme-studio/runtime/src/cli.mjs');
const outputRoot = path.join(root, 'docs/examples/real');
const manifestPath = path.join(root, 'docs/examples/manifest.json');
const allowedViews = new Set(['new-task', 'settings']);

function argumentAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const requestedView = argumentAfter('--view');
if (!allowedViews.has(requestedView)) {
  throw new Error('Use --view new-task or --view settings.');
}

/**
 * Runs one deterministic Theme Studio command without exposing local paths or page content.
 *
 * @param {string[]} args CLI command and arguments from the public cts command surface.
 * @returns {Promise<object>} Parsed structured CLI result.
 */
async function runCli(args) {
  try {
    const { stdout } = await execFile(process.execPath, [cli, ...args], {
      cwd: root,
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (error) {
    let result;
    try { result = JSON.parse(error.stderr || '{}'); } catch { result = null; }
    const failure = new Error(result?.message || `Theme command failed: ${args[0]}`);
    failure.code = result?.code || 'CAPTURE_COMMAND_FAILED';
    throw failure;
  }
}

function viewMatches(summary, view) {
  if (summary.width < 1_000 || summary.height < 700) return false;
  if (view === 'settings') return summary.route === 'settings' && summary.switches >= 2;
  return summary.route === 'home' && summary.switches < 2;
}

/**
 * Captures the largest eligible desktop renderer without reading visible page strings.
 *
 * Structural counts distinguish settings from the new-task view. Demo mode only masks account
 * identity labels; it never disables the composer, sidebar, terminal, or other interactive UI.
 *
 * @param {string} view One of new-task or settings.
 * @param {string} themeId Stable bundled theme identifier.
 * @returns {Promise<{data: Buffer, width: number, height: number}>} Privacy-safe WebP screenshot.
 */
async function captureCurrentView(view, themeId) {
  const candidates = [];
  for (const target of await getTargets()) {
    const session = await CdpSession.connect(target.webSocketDebuggerUrl);
    try {
      await assertPageIdentity(session);
      const summary = await session.evaluate(`(() => {
        const visible = node => {
          if (!node?.isConnected) return false;
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const privateTextSelector = ${JSON.stringify(SELECTORS.privateText.join(','))};
        const privateNodes = [...document.querySelectorAll(privateTextSelector)].filter(visible);
        const privateTextReady = privateNodes.length > 0
          && privateNodes
          .every(node => node.dataset.ctsDemoPrivate === '1');
        return {
          route: window.__CODEX_THEME_STUDIO__?.route?.() || null,
          themeId: window.__CODEX_THEME_STUDIO__?.themeId || null,
          demoMode: window.__CODEX_THEME_STUDIO__?.demoMode === true,
          switches: document.querySelectorAll('[role="switch"]').length,
          privateTextReady,
          width: innerWidth,
          height: innerHeight,
        };
      })()`);
      if (
        summary.themeId === themeId
        && summary.demoMode
        && summary.privateTextReady
        && viewMatches(summary, view)
      ) {
        candidates.push({ session, summary });
        continue;
      }
    } catch {
      // Internal helper pages are expected and never become screenshot candidates.
    }
    session.close();
  }

  candidates.sort((left, right) => (
    (right.summary.width * right.summary.height) - (left.summary.width * left.summary.height)
  ));
  const selected = candidates.shift();
  for (const candidate of candidates) candidate.session.close();
  if (!selected) throw new Error(`No privacy-safe ${view} renderer is currently open.`);

  try {
    // Account identity is already covered by the verified demo-mode marker. Capture the renderer
    // directly so project names, workspace labels, composer text, and the full sidebar stay real.
    const screenshot = await selected.session.request('Page.captureScreenshot', {
      format: 'webp',
      quality: 84,
      fromSurface: true,
      captureBeyondViewport: false,
    });
    if (!screenshot?.data) throw new Error(`The ${view} renderer returned no screenshot data.`);
    return {
      data: Buffer.from(screenshot.data, 'base64'),
      width: selected.summary.width,
      height: selected.summary.height,
    };
  } finally {
    selected.session.close();
  }
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch {
    return {
      schemaVersion: 1,
      generatedAt: null,
      captureMethod: 'Official ChatGPT desktop renderer through loopback-only CDP',
      privacy: 'Full-window new-task/settings capture; only account identity is masked',
      themes: {},
    };
  }
}

async function main() {
  const listed = await runCli(['list']);
  const initial = await runCli(['verify']);
  // Release evidence is deterministic: user-imported themes are intentionally excluded so a
  // maintainer's private collection can never leak into the public screenshot manifest.
  const themes = listed.themes.filter(theme => theme.source === 'preset' && !theme.invalid);
  const manifest = await readManifest();
  manifest.privacy = 'Full-window new-task/settings capture; only account identity is masked';
  let verificationFailed = false;

  await runCli(['demo-mode', 'on']);
  try {
    for (const theme of themes) {
      await runCli(['switch', theme.id]);
      const verified = await runCli(['verify']);
      if (
        verified.themeId !== theme.id
        || verified.checks.some(check => !check.ok || check.demoMode !== true || check.privacyReady !== true)
      ) {
        verificationFailed = true;
        throw new Error(`Privacy verification failed for ${theme.id}.`);
      }

      const screenshot = await captureCurrentView(requestedView, theme.id);
      const directory = path.join(outputRoot, theme.id);
      const destination = path.join(directory, `${requestedView}.webp`);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(destination, screenshot.data);
      manifest.themes[theme.id] = {
        ...(manifest.themes[theme.id] || {}),
        name: theme.name,
        appearance: theme.appearance,
        views: {
          ...(manifest.themes[theme.id]?.views || {}),
          [requestedView]: {
            file: path.relative(path.dirname(manifestPath), destination),
            width: screenshot.width,
            height: screenshot.height,
          },
        },
      };
      process.stdout.write(`captured ${theme.id} ${requestedView}\n`);
    }
  } catch (error) {
    if (verificationFailed) await runCli(['restore']).catch(() => {});
    throw error;
  } finally {
    if (!verificationFailed && initial.themeId) {
      await runCli(['switch', initial.themeId]);
      if (initial.checks?.[0]?.demoMode !== true) await runCli(['demo-mode', 'off']);
      await runCli(['verify']);
    }
  }

  manifest.generatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
