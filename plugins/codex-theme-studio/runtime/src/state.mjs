import fs from 'node:fs/promises';
import path from 'node:path';
import { DAEMON_FILE, STATE_FILE } from './config.mjs';

const EMPTY_STATE = Object.freeze({
  version: 1,
  activeTheme: null,
  demoMode: false,
  updatedAt: null,
});

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, file);
}

export async function readState() {
  return { ...EMPTY_STATE, ...(await readJson(STATE_FILE, EMPTY_STATE)) };
}

export async function updateState(patch) {
  const next = { ...(await readState()), ...patch, updatedAt: new Date().toISOString() };
  await writeJsonAtomic(STATE_FILE, next);
  return next;
}

export async function readDaemon() {
  return readJson(DAEMON_FILE, null);
}

export async function writeDaemon(value) {
  return writeJsonAtomic(DAEMON_FILE, value);
}

export async function removeDaemonFile() {
  await fs.rm(DAEMON_FILE, { force: true });
}

