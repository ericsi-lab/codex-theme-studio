import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const VERSION = '0.1.0';
export const DEFAULT_THEME_ID = 'wan-yao-longyuan-lingji';
export const DEFAULT_THEME_NAME = '万妖图录·龙渊灵姬';
export const PLUGIN_ROOT = path.resolve(here, '../..');
export const INSTALL_ROOT = path.resolve(
  process.env.CTS_INSTALL_ROOT || path.join(os.homedir(), '.codex/codex-theme-studio'),
);
export const DATA_ROOT = path.resolve(
  process.env.CTS_DATA_ROOT || path.join(os.homedir(), 'Library/Application Support/CodexThemeStudio'),
);
export const USER_THEMES_DIR = path.join(DATA_ROOT, 'themes');
export const PRESETS_DIR = path.join(DATA_ROOT, 'presets');
export const STATE_DIR = path.join(DATA_ROOT, 'state');
export const LOG_DIR = path.join(DATA_ROOT, 'logs');
export const STATE_FILE = path.join(STATE_DIR, 'state.json');
export const DAEMON_FILE = path.join(STATE_DIR, 'daemon.json');
export const APP_IDENTITY_CACHE_FILE = path.join(STATE_DIR, 'app-identity.json');
export const LAUNCHER_APP_NAME = 'Theme Studio for Codex.app';
export const LEGACY_LAUNCHER_APP_NAME = 'Codex Theme Studio.app';
export const LAUNCHER_MARKER_NAME = 'codex-theme-studio-managed';
export const LAUNCHER_ICON_FILE_NAME = 'ThemeStudioForCodex.icns';
export const LAUNCHER_APP = path.join(os.homedir(), 'Applications', LAUNCHER_APP_NAME);
export const LEGACY_LAUNCHER_APP = path.join(os.homedir(), 'Applications', LEGACY_LAUNCHER_APP_NAME);
export const LAUNCHER_MARKER = path.join(LAUNCHER_APP, 'Contents', 'Resources', LAUNCHER_MARKER_NAME);
export const LEGACY_LAUNCHER_MARKER = path.join(
  LEGACY_LAUNCHER_APP,
  'Contents',
  'Resources',
  LAUNCHER_MARKER_NAME,
);
export const LAUNCHER_ICON = path.join(PLUGIN_ROOT, 'assets', 'theme-studio-for-codex.icns');
export const APPLICATION_BUNDLES = Object.freeze(
  process.env.CTS_APP_BUNDLE
    ? [path.resolve(process.env.CTS_APP_BUNDLE)]
    : [
        '/Applications/ChatGPT.app',
        '/Applications/Codex.app',
        path.join(os.homedir(), 'Applications/ChatGPT.app'),
        path.join(os.homedir(), 'Applications/Codex.app'),
      ],
);
export const CDP_ORIGIN = process.env.CTS_CDP_ORIGIN || 'http://127.0.0.1:9222';
export const TEST_MODE = process.env.CTS_TEST_MODE === '1';

export const LIMITS = Object.freeze({
  maxBytes: 16 * 1024 * 1024,
  maxSide: 8_192,
  maxPixels: 12_000_000,
  headerBytes: 512 * 1024,
  logBytes: 256 * 1024,
});

export const DEFAULT_COLORS = Object.freeze({
  accent: '#72D6C9',
  surface: '#101820CC',
  text: '#F4F7F6',
  mutedText: '#C2CECB',
  overlay: '#07110E66',
});

export const DEFAULT_ART = Object.freeze({
  focusX: 0.78,
  focusY: 0.5,
  safeArea: 0.55,
  safeSide: 'left',
  homeMode: 'hero',
  taskMode: 'ambient',
});

export const DEFAULT_EFFECTS = Object.freeze({
  preset: 'none',
  intensity: 0,
  motion: false,
});
