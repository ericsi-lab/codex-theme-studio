import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_ART,
  DEFAULT_COLORS,
  DEFAULT_EFFECTS,
  LIMITS,
  PRESETS_DIR,
  USER_THEMES_DIR,
} from './config.mjs';
import { fail } from './errors.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_PATTERN = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const APPEARANCES = new Set(['light', 'dark', 'auto']);
const TASK_MODES = new Set(['ambient', 'cover', 'quiet']);
const SAFE_SIDES = new Set(['left', 'right', 'center', 'none']);
const HOME_MODES = new Set(['hero', 'immersive', 'quiet']);
const EFFECT_PRESETS = new Set(['none', 'mist', 'stars', 'embers', 'petals', 'glow']);
const MIME = Object.freeze({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' });

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('THEME_INVALID', `${label} must be an object.`);
  }
}

function bounded(value, fallback, label) {
  const result = value ?? fallback;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < 0 || result > 1) {
    fail('THEME_INVALID', `${label} must be a number from 0 to 1.`);
  }
  return result;
}

function readPng(buffer) {
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    type: 'png',
    animated: buffer.includes(Buffer.from('acTL')),
  };
}

function readJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    if (sof.has(marker)) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        type: 'jpeg',
        animated: false,
      };
    }
    offset += 2 + length;
  }
  fail('THEME_INVALID', 'JPEG dimensions could not be read.');
}

function readWebp(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buffer.toString('ascii', 12, 16);
  if (kind === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
      type: 'webp',
      animated: Boolean(buffer[20] & 0x02) || buffer.includes(Buffer.from('ANIM')),
    };
  }
  if (kind === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      type: 'webp',
      animated: false,
    };
  }
  if (kind === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      type: 'webp',
      animated: false,
    };
  }
  fail('THEME_INVALID', 'WebP dimensions could not be read.');
}

export function imageDimensions(buffer) {
  return readPng(buffer) || readJpeg(buffer) || readWebp(buffer) || fail('THEME_INVALID', 'Unsupported or damaged image file.');
}

/**
 * Validates an image from a bounded header read before optionally loading its compressed bytes.
 *
 * @param {string} themeDir Theme package directory already selected by the runtime; must exist.
 * @param {string} relativeImage Relative manifest image path; absolute and escaping paths are rejected.
 * @param {{loadBuffer?: boolean}} options Controls whether the validated compressed image is read for injection.
 * @returns {Promise<object>} Validated image metadata and an optional Buffer when loadBuffer is true.
 */
async function safeImage(themeDir, relativeImage, { loadBuffer = true } = {}) {
  if (typeof relativeImage !== 'string' || !relativeImage || path.isAbsolute(relativeImage)) {
    fail('THEME_INVALID', 'image must be a relative path.');
  }
  const base = await fs.realpath(themeDir);
  const candidate = path.resolve(base, relativeImage);
  const relative = path.relative(base, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('THEME_INVALID', 'Image escapes the theme directory.');

  let cursor = candidate;
  while (cursor !== base) {
    const stat = await fs.lstat(cursor);
    if (stat.isSymbolicLink()) fail('THEME_INVALID', 'Symbolic links are not allowed in theme image paths.');
    cursor = path.dirname(cursor);
  }
  const stat = await fs.stat(candidate);
  if (!stat.isFile()) fail('THEME_INVALID', 'Theme image is not a regular file.');
  if (stat.size > LIMITS.maxBytes) fail('THEME_INVALID', `Theme image exceeds ${LIMITS.maxBytes} bytes.`);
  const extension = path.extname(candidate).toLowerCase();
  if (!MIME[extension]) fail('THEME_INVALID', 'Theme image must be PNG, JPEG, or WebP.');
  const handle = await fs.open(candidate, 'r');
  let header;
  try {
    const headerLength = Math.min(stat.size, LIMITS.headerBytes);
    header = Buffer.alloc(headerLength);
    await handle.read(header, 0, headerLength, 0);
  } finally {
    await handle.close();
  }
  const dimensions = imageDimensions(header);
  const expectedType = extension === '.png' ? 'png' : ['.jpg', '.jpeg'].includes(extension) ? 'jpeg' : 'webp';
  if (dimensions.type !== expectedType) fail('THEME_INVALID', 'Image contents do not match the filename extension.');
  if (dimensions.animated) fail('THEME_INVALID', 'Animated images are not supported in v0.1.');
  if (dimensions.width > LIMITS.maxSide || dimensions.height > LIMITS.maxSide) {
    fail('THEME_INVALID', `Theme image exceeds ${LIMITS.maxSide} pixels per side.`);
  }
  if (dimensions.width * dimensions.height > LIMITS.maxPixels) {
    fail('THEME_INVALID', `Theme image exceeds ${LIMITS.maxPixels} pixels.`);
  }
  return {
    path: candidate,
    mime: MIME[extension],
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    ...(loadBuffer ? { buffer: await fs.readFile(candidate) } : {}),
    ...dimensions,
  };
}

export async function loadTheme(themeDir, { loadImage = true } = {}) {
  const manifestPath = path.join(themeDir, 'theme.json');
  const manifestStat = await fs.lstat(manifestPath).catch(() => null);
  if (!manifestStat?.isFile() || manifestStat.isSymbolicLink()) fail('THEME_INVALID', 'theme.json is missing or unsafe.');
  if (manifestStat.size > 64 * 1024) fail('THEME_INVALID', 'theme.json exceeds 64 KiB.');
  let input;
  try { input = JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
  catch { fail('THEME_INVALID', 'theme.json is not valid JSON.'); }
  assertObject(input, 'theme.json');
  if (input.schemaVersion !== 1) fail('THEME_INVALID', 'schemaVersion must be 1.');
  if (!ID_PATTERN.test(input.id || '')) fail('THEME_INVALID', 'id must use lowercase kebab-case.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) fail('THEME_INVALID', 'name must be 1–80 characters.');
  if (!APPEARANCES.has(input.appearance)) fail('THEME_INVALID', 'appearance must be light, dark, or auto.');

  const colorsInput = input.colors ?? {};
  const artInput = input.art ?? {};
  const effectsInput = input.effects ?? {};
  assertObject(colorsInput, 'colors');
  assertObject(artInput, 'art');
  assertObject(effectsInput, 'effects');
  const colors = {};
  for (const key of Object.keys(DEFAULT_COLORS)) {
    const value = colorsInput[key] ?? DEFAULT_COLORS[key];
    if (!HEX_PATTERN.test(value)) fail('THEME_INVALID', `colors.${key} must be a hex color.`);
    colors[key] = value.toUpperCase();
  }
  const taskMode = artInput.taskMode ?? DEFAULT_ART.taskMode;
  if (!TASK_MODES.has(taskMode)) fail('THEME_INVALID', 'art.taskMode is invalid.');
  const safeSide = artInput.safeSide ?? DEFAULT_ART.safeSide;
  if (!SAFE_SIDES.has(safeSide)) fail('THEME_INVALID', 'art.safeSide is invalid.');
  const homeMode = artInput.homeMode ?? DEFAULT_ART.homeMode;
  if (!HOME_MODES.has(homeMode)) fail('THEME_INVALID', 'art.homeMode is invalid.');
  const art = {
    focusX: bounded(artInput.focusX, DEFAULT_ART.focusX, 'art.focusX'),
    focusY: bounded(artInput.focusY, DEFAULT_ART.focusY, 'art.focusY'),
    safeArea: bounded(artInput.safeArea, DEFAULT_ART.safeArea, 'art.safeArea'),
    safeSide,
    homeMode,
    taskMode,
  };
  const preset = effectsInput.preset ?? DEFAULT_EFFECTS.preset;
  if (!EFFECT_PRESETS.has(preset)) fail('THEME_INVALID', 'effects.preset is invalid.');
  const motion = effectsInput.motion ?? DEFAULT_EFFECTS.motion;
  if (typeof motion !== 'boolean') fail('THEME_INVALID', 'effects.motion must be a boolean.');
  const effects = {
    preset,
    intensity: bounded(effectsInput.intensity, DEFAULT_EFFECTS.intensity, 'effects.intensity'),
    motion,
  };
  const image = await safeImage(themeDir, input.image, { loadBuffer: loadImage });
  const directory = await fs.realpath(themeDir);
  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name.trim(),
    appearance: input.appearance,
    colors,
    art,
    effects,
    image,
    directory,
    fingerprint: `${manifestStat.mtimeMs}:${image.modifiedAt}:${image.size}`,
  };
}

async function directories(root, source) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  return entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).map(entry => ({ directory: path.join(root, entry.name), source }));
}

export async function listThemes({ includeInvalid = false, loadImages = false } = {}) {
  const candidates = [...await directories(PRESETS_DIR, 'preset'), ...await directories(USER_THEMES_DIR, 'user')];
  const byId = new Map();
  for (const candidate of candidates) {
    try {
      const theme = await loadTheme(candidate.directory, { loadImage: loadImages });
      byId.set(theme.id, { ...theme, source: candidate.source });
    } catch (error) {
      if (includeInvalid) byId.set(`invalid:${candidate.directory}`, { ...candidate, invalid: error.message });
    }
  }
  return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'));
}

export async function findTheme(id, { loadImage = true } = {}) {
  if (ID_PATTERN.test(id || '')) {
    for (const [root, source] of [[USER_THEMES_DIR, 'user'], [PRESETS_DIR, 'preset']]) {
      const directory = path.join(root, id);
      const stat = await fs.lstat(directory).catch(() => null);
      if (!stat?.isDirectory() || stat.isSymbolicLink()) continue;
      const theme = await loadTheme(directory, { loadImage });
      return { ...theme, source };
    }
  }
  const metadata = (await listThemes({ loadImages: false })).find(item => item.id === id || item.name === id);
  if (!metadata) fail('THEME_NOT_FOUND', `Theme not found: ${id}`);
  if (!loadImage) return metadata;
  return { ...(await loadTheme(metadata.directory, { loadImage: true })), source: metadata.source };
}

export async function themeHasChanged(theme) {
  const [manifest, image] = await Promise.all([
    fs.stat(path.join(theme.directory, 'theme.json')).catch(() => null),
    fs.stat(theme.image.path).catch(() => null),
  ]);
  if (!manifest?.isFile() || !image?.isFile()) return true;
  return `${manifest.mtimeMs}:${image.mtimeMs}:${image.size}` !== theme.fingerprint;
}

export function imagePayload(theme) {
  if (!theme.image.buffer) fail('THEME_IMAGE_NOT_LOADED', 'Theme image bytes were not loaded for injection.');
  return { mime: theme.image.mime, base64: theme.image.buffer.toString('base64') };
}
