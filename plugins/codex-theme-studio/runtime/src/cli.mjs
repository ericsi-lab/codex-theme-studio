#!/usr/bin/env node
import { CtsError } from './errors.mjs';
import { doctor } from './system.mjs';
import {
  activateThemeMode,
  applyTheme,
  availableThemes,
  checkCompatibility,
  importTheme,
  install,
  previewTheme,
  restore,
  setDemoMode,
  uninstall,
  verifyTheme,
  watch,
  watchCycle,
} from './operations.mjs';

function valueAfter(args, flag, fallback) {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
}

function optionalNumber(args, flag) {
  const value = valueAfter(args, flag);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new CtsError('INVALID_ARGUMENT', `${flag} must be a number.`);
  return number;
}

async function route(args) {
  const [command = 'help', subject] = args;
  switch (command) {
    case 'install':
    case 'update': return install();
    case 'doctor': return doctor();
    case 'compatibility': return checkCompatibility();
    case 'enable': {
      const requestedThemeId = valueAfter(args, '--theme', null);
      if (args.includes('--theme') && !requestedThemeId) {
        throw new CtsError('INVALID_ARGUMENT', '--theme requires a theme ID.');
      }
      return activateThemeMode({
        confirmed: args.includes('--confirmed'),
        requestedThemeId,
      });
    }
    case 'list':
    case 'themes': return { ok: true, themes: await availableThemes() };
    case 'import':
      if (!subject) throw new CtsError('INVALID_ARGUMENT', 'Provide an image or theme directory to import.');
      return importTheme(subject, {
        name: valueAfter(args, '--name'),
        colors: {
          accent: valueAfter(args, '--accent'),
          surface: valueAfter(args, '--surface'),
          text: valueAfter(args, '--text'),
          mutedText: valueAfter(args, '--muted-text'),
          overlay: valueAfter(args, '--overlay'),
        },
        art: {
          focusX: optionalNumber(args, '--focus-x'),
          focusY: optionalNumber(args, '--focus-y'),
          safeArea: optionalNumber(args, '--safe-area'),
          safeSide: valueAfter(args, '--safe-side'),
          homeMode: valueAfter(args, '--home-mode'),
          taskMode: valueAfter(args, '--task-mode'),
        },
        effects: {
          preset: valueAfter(args, '--effect'),
          intensity: optionalNumber(args, '--effect-intensity'),
          motion: args.includes('--motion') ? true : undefined,
        },
      });
    case 'preview': {
      if (!subject) throw new CtsError('INVALID_ARGUMENT', 'Provide a theme ID to preview.');
      const seconds = Number(valueAfter(args, '--seconds', '30'));
      return previewTheme(subject, seconds);
    }
    case 'apply':
    case 'switch':
      if (!subject) throw new CtsError('INVALID_ARGUMENT', 'Provide a theme ID to apply.');
      return applyTheme(subject);
    case 'verify': return verifyTheme();
    case 'restore':
    case 'remove': return restore();
    case 'demo-mode':
      if (!['on', 'off'].includes(subject)) throw new CtsError('INVALID_ARGUMENT', 'Use demo-mode on or demo-mode off.');
      return setDemoMode(subject === 'on');
    case 'uninstall': return uninstall({ deleteUserData: args.includes('--delete-user-data') });
    case 'watch': await watch(); return { ok: true, stopped: true };
    case 'watch-cycle': return watchCycle();
    case 'help': return {
      ok: true,
      usage: 'cts <install|enable|doctor|compatibility|list|import|preview|apply|switch|verify|update|restore|demo-mode|uninstall>',
    };
    default: throw new CtsError('UNKNOWN_COMMAND', `Unknown command: ${command}`);
  }
}

try {
  const result = await route(process.argv.slice(2));
  const command = process.argv[2];
  if (!['watch', 'watch-cycle'].includes(command)) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
  if (command === 'watch-cycle' && result?.continue === false) process.exitCode = 75;
} catch (error) {
  const output = {
    ok: false,
    code: error.code || 'UNEXPECTED_ERROR',
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  };
  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
}
