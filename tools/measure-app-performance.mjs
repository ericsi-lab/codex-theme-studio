import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import {
  applyTheme,
  restore,
  setDemoMode,
} from '../plugins/codex-theme-studio/runtime/src/operations.mjs';
import { readState } from '../plugins/codex-theme-studio/runtime/src/state.mjs';
import { doctor } from '../plugins/codex-theme-studio/runtime/src/system.mjs';

const execFile = promisify(execFileCallback);
const args = process.argv.slice(2);

function valueAfter(flag, fallback) {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
}

function integerAfter(flag, fallback, minimum = 0) {
  const value = Number(valueAfter(flag, fallback));
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${flag} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function cpuSeconds(value) {
  const normalized = value.trim();
  const [dayText, clock] = normalized.includes('-')
    ? normalized.split('-', 2)
    : ['0', normalized];
  const fields = clock.split(':').map(Number);
  if (fields.some(number => !Number.isFinite(number))) return 0;
  return Number(dayText) * 86_400 + fields.reduce((total, number) => total * 60 + number, 0);
}

async function processRows() {
  const { stdout } = await execFile('/bin/ps', ['-axo', 'pid=,ppid=,rss=,time='], {
    timeout: 3_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim().split('\n').map(line => {
    const [pid, ppid, rss, time] = line.trim().split(/\s+/);
    return {
      pid: Number(pid),
      ppid: Number(ppid),
      rssKiB: Number(rss),
      cpuSeconds: cpuSeconds(time),
    };
  }).filter(row => Number.isInteger(row.pid));
}

function descendants(rows, rootPid) {
  const included = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (!included.has(row.pid) && included.has(row.ppid)) {
        included.add(row.pid);
        changed = true;
      }
    }
  }
  return rows.filter(row => included.has(row.pid));
}

async function processTreeSample(rootPid) {
  const rows = descendants(await processRows(), rootPid);
  return {
    at: performance.now(),
    rssMiB: rows.reduce((total, row) => total + row.rssKiB, 0) / 1024,
    cpuSeconds: rows.reduce((total, row) => total + row.cpuSeconds, 0),
    processes: rows.length,
  };
}

async function wait(seconds) {
  if (seconds <= 0) return;
  await new Promise(resolve => setTimeout(resolve, seconds * 1_000));
}

async function sampleWindow(rootPid, seconds) {
  const samples = [await processTreeSample(rootPid)];
  for (let index = 0; index < seconds; index += 1) {
    await wait(1);
    samples.push(await processTreeSample(rootPid));
  }
  const rss = samples.slice(1).map(sample => sample.rssMiB);
  const first = samples[0];
  const last = samples.at(-1);
  const elapsedSeconds = Math.max(0.001, (last.at - first.at) / 1_000);
  const cpuIntervals = samples.slice(1).map((sample, index) => {
    const previous = samples[index];
    const intervalSeconds = Math.max(0.001, (sample.at - previous.at) / 1_000);
    return Math.max(0, sample.cpuSeconds - previous.cpuSeconds) / intervalSeconds * 100;
  }).sort((left, right) => left - right);
  return {
    seconds,
    samples: samples.length - 1,
    rssMiB: {
      average: Number((rss.reduce((total, value) => total + value, 0) / rss.length).toFixed(2)),
      min: Number(Math.min(...rss).toFixed(2)),
      max: Number(Math.max(...rss).toFixed(2)),
    },
    cpuPercent: {
      average: Number(
        (Math.max(0, last.cpuSeconds - first.cpuSeconds) / elapsedSeconds * 100).toFixed(2),
      ),
      p95: Number(cpuIntervals[Math.ceil(cpuIntervals.length * 0.95) - 1].toFixed(2)),
    },
    processCount: last.processes,
  };
}

async function restoreInitialState(initialState) {
  await restore();
  if (!initialState.activeTheme) return;
  await applyTheme(initialState.activeTheme);
  if (initialState.demoMode) await setDemoMode(true);
}

if (!args.includes('--confirmed')) {
  throw new Error('Pass --confirmed because this benchmark temporarily restores and reapplies the active theme.');
}

const seconds = integerAfter('--seconds', '600', 1);
const warmupSeconds = integerAfter('--warmup', '120', 0);
const switches = integerAfter('--switches', '30', 0);
const themeId = valueAfter('--theme');
const initialState = await readState();
const selectedTheme = themeId || initialState.activeTheme;
if (!selectedTheme) throw new Error('Apply a theme first or pass --theme THEME_ID.');

const runtime = await doctor();
const rootPid = runtime.process.pid;
let output;

try {
  await restore();
  await wait(warmupSeconds);
  const baseline = await sampleWindow(rootPid, seconds);

  await applyTheme(selectedTheme, { daemon: false });
  await wait(warmupSeconds);
  const themed = await sampleWindow(rootPid, seconds);

  for (let index = 0; index < switches; index += 1) {
    await applyTheme(selectedTheme, { daemon: false });
  }
  await restore();
  await wait(warmupSeconds || 2);
  const retained = await sampleWindow(rootPid, Math.min(seconds, 10));

  output = {
    scope: 'official-desktop-app-process-tree',
    application: {
      name: runtime.bundle.displayName,
      version: runtime.bundle.version,
      build: runtime.bundle.build,
    },
    themeId: selectedTheme,
    warmupSeconds,
    switches,
    baseline,
    themed,
    attributable: {
      rssMiBAverage: Number((themed.rssMiB.average - baseline.rssMiB.average).toFixed(2)),
      cpuPercentAverage: Number(
        (themed.cpuPercent.average - baseline.cpuPercent.average).toFixed(2),
      ),
      cpuPercentP95: Number((themed.cpuPercent.p95 - baseline.cpuPercent.p95).toFixed(2)),
    },
    retainedAfterRestore: {
      rssMiBVersusBaseline: Number((retained.rssMiB.average - baseline.rssMiB.average).toFixed(2)),
      sample: retained,
    },
  };
} finally {
  await restoreInitialState(initialState);
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
