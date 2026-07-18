import { fail } from './errors.mjs';
import { imagePayload } from './theme.mjs';

export const ADAPTER_VERSION = 13;

export const SELECTORS = Object.freeze({
  shell: ['#root', '[data-testid="app-shell"]', 'body'],
  sidebar: ['[data-testid*="sidebar"]', 'aside'],
  composerInput: ['[data-testid*="composer"] textarea', 'textarea', '[contenteditable="true"]'],
  taskContent: [
    '[data-message-author-role]',
    '[data-thread-find-target="conversation"]',
    '[data-virtualized-turn-content]',
    '.thread-scroll-container',
    'article',
    '[data-testid*="thread"]',
    '[data-testid*="task"]',
  ],
  suggestion: ['[data-testid*="suggestion"]', '[data-testid*="starter"]'],
  settingsControl: ['[role="switch"]'],
  privateText: [
    '[data-testid*="account"]',
    '[data-testid*="profile"]',
    '[aria-label*="account" i]',
    '[aria-label*="profile" i]',
    '[aria-label*="账户"]',
    '[aria-label*="账号"]',
    '[aria-label*="个人"]',
  ],
});

function serialized(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function scrim(theme) {
  const percent = Math.round(theme.art.safeArea * 100);
  const surface = theme.colors.surface;
  if (theme.art.safeSide === 'right') {
    return `linear-gradient(270deg,${surface} 0%,${surface} ${percent}%,transparent 96%)`;
  }
  if (theme.art.safeSide === 'center') {
    return `radial-gradient(ellipse at center,${surface} 0%,${surface} ${Math.max(30, percent - 18)}%,transparent 92%)`;
  }
  if (theme.art.safeSide === 'none') return theme.colors.overlay;
  return `linear-gradient(90deg,${surface} 0%,${surface} ${percent}%,transparent 96%)`;
}

function effectBackground(theme) {
  const effects = theme.effects ?? { preset: 'none', intensity: 0, motion: false };
  const accent = theme.colors.accent;
  const softAccent = `color-mix(in srgb,${accent} 34%,transparent)`;
  switch (effects.preset) {
    case 'mist':
      return `radial-gradient(ellipse at 72% 18%,${softAccent} 0 2%,transparent 30%),radial-gradient(ellipse at 88% 78%,#ffffff33 0 1%,transparent 26%)`;
    case 'stars':
      return `radial-gradient(circle at 18% 24%,#fff 0 1px,transparent 2px),radial-gradient(circle at 72% 36%,${accent} 0 1px,transparent 2px),radial-gradient(circle at 84% 72%,#fff 0 1px,transparent 2px)`;
    case 'embers':
      return `radial-gradient(circle at 76% 82%,${accent} 0 1px,transparent 3px),radial-gradient(circle at 88% 64%,#fff3 0 1px,transparent 3px)`;
    case 'petals':
      return `radial-gradient(ellipse at 78% 22%,${accent} 0 2px,transparent 4px),radial-gradient(ellipse at 88% 58%,#fff8 0 2px,transparent 4px)`;
    case 'glow':
      return `radial-gradient(circle at 82% 44%,${softAccent} 0,transparent 36%)`;
    default:
      return 'none';
  }
}

function solidHex(color) {
  return color.slice(0, 7);
}

function relativeLuminance(color) {
  const channels = [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * Maps theme colors onto ChatGPT's stable semantic color variables.
 *
 * The desktop app uses shared semantic tokens for the shell, menus, editor widgets and popovers.
 * Overriding those variables keeps text and elevated surfaces coherent without depending on
 * generated class names that change between app builds.
 *
 * @param {object} theme Validated theme metadata.
 * @returns {string} CSS custom-property declarations for the injected root style.
 */
function semanticTokenCss(theme) {
  const surface = solidHex(theme.colors.surface);
  const accentText = relativeLuminance(theme.colors.accent) > 0.46 ? '#111318' : '#FFFFFF';
  const text = theme.colors.text;
  const muted = theme.colors.mutedText;
  const accent = theme.colors.accent;
  return [
    `--cts-panel-solid:${surface}`,
    `--cts-elevated:color-mix(in srgb,${surface} 88%,#FFFFFF)`,
    `--cts-control:color-mix(in srgb,${theme.colors.surface} 88%,transparent)`,
    `--cts-hover:color-mix(in srgb,${accent} 14%,transparent)`,
    `--color-text-foreground:${text}`,
    `--color-text-foreground-secondary:${muted}`,
    `--color-text-foreground-tertiary:color-mix(in srgb,${muted} 68%,transparent)`,
    `--color-text-button-primary:${accentText}`,
    `--color-text-button-secondary:${text}`,
    `--color-text-button-tertiary:${muted}`,
    `--color-text-accent:${accent}`,
    '--color-background-surface:transparent',
    '--color-background-surface-under:transparent',
    '--color-background-panel:transparent',
    '--color-background-control:var(--cts-control)',
    '--color-background-control-opaque:var(--cts-panel-solid)',
    '--color-background-editor-opaque:var(--cts-panel-solid)',
    '--color-background-elevated-primary:var(--cts-elevated)',
    '--color-background-elevated-primary-opaque:var(--cts-panel-solid)',
    '--color-background-elevated-secondary:var(--cts-elevated)',
    '--color-background-elevated-secondary-opaque:var(--cts-panel-solid)',
    `--color-background-button-primary:${accent}`,
    '--color-background-button-primary-hover:var(--cts-hover)',
    '--color-background-button-secondary:var(--cts-control)',
    '--color-background-button-secondary-hover:var(--cts-hover)',
    `--color-border:color-mix(in srgb,${accent} 22%,transparent)`,
    `--color-border-light:color-mix(in srgb,${accent} 14%,transparent)`,
    `--color-border-heavy:color-mix(in srgb,${accent} 34%,transparent)`,
    `--color-border-focus:${accent}`,
    `--color-token-primary:${accent}`,
    `--color-token-link:${accent}`,
    `--color-token-text-link-foreground:${accent}`,
    `--color-token-text-link-active-foreground:${accent}`,
    `--color-token-foreground:${text}`,
    `--color-token-text-primary:${text}`,
    `--color-token-text-secondary:${muted}`,
    `--color-token-text-tertiary:color-mix(in srgb,${muted} 68%,transparent)`,
    `--color-token-description-foreground:${muted}`,
    `--color-token-disabled-foreground:color-mix(in srgb,${muted} 56%,transparent)`,
    `--color-token-icon-foreground:${text}`,
    `--color-token-non-assistant-body-descendant:${muted}`,
    `--color-token-conversation-body:${muted}`,
    `--color-token-conversation-header:color-mix(in srgb,${muted} 62%,transparent)`,
    '--color-token-main-surface-primary:transparent',
    '--color-token-bg-primary:var(--cts-glass)',
    '--color-token-bg-secondary:var(--cts-control)',
    '--color-token-bg-tertiary:var(--cts-hover)',
    '--color-token-bg-fog:var(--cts-hover)',
    '--color-token-side-bar-background:var(--cts-glass)',
    '--color-token-input-background:var(--cts-control)',
    `--color-token-input-foreground:${text}`,
    `--color-token-input-placeholder-foreground:${muted}`,
    `--color-token-input-border:color-mix(in srgb,${accent} 26%,transparent)`,
    '--color-token-menu-background:var(--cts-elevated)',
    `--color-token-menu-foreground:${text}`,
    `--color-token-menu-border:color-mix(in srgb,${accent} 22%,transparent)`,
    '--color-token-dropdown-background:var(--cts-elevated)',
    `--color-token-dropdown-foreground:${text}`,
    '--color-token-checkbox-background:var(--cts-control)',
    `--color-token-checkbox-foreground:${text}`,
    `--color-token-checkbox-border:color-mix(in srgb,${accent} 26%,transparent)`,
    '--color-token-list-hover-background:var(--cts-hover)',
    '--color-token-list-active-selection-background:var(--cts-hover)',
    `--color-token-list-active-selection-foreground:${text}`,
    `--color-token-list-active-selection-icon-foreground:${text}`,
    '--color-token-editor-background:var(--cts-panel-solid)',
    `--color-token-editor-foreground:${text}`,
    '--color-token-editor-widget-background:var(--cts-elevated)',
    '--color-token-terminal-background:var(--cts-panel-solid)',
    `--color-token-terminal-foreground:${text}`,
    '--color-token-text-code-block-background:var(--cts-control)',
    '--color-token-text-preformat-background:var(--cts-elevated)',
    `--color-token-text-preformat-foreground:${text}`,
    `--color-token-border:color-mix(in srgb,${accent} 22%,transparent)`,
    `--color-token-border-default:color-mix(in srgb,${accent} 22%,transparent)`,
    `--color-token-border-light:color-mix(in srgb,${accent} 14%,transparent)`,
    `--color-token-border-heavy:color-mix(in srgb,${accent} 34%,transparent)`,
    `--color-token-focus-border:${accent}`,
    `--vscode-foreground:${text}`,
    `--vscode-descriptionForeground:${muted}`,
    `--vscode-icon-foreground:${text}`,
    `--vscode-menu-foreground:${text}`,
    '--vscode-menu-background:var(--cts-elevated)',
    `--vscode-menu-selectionForeground:${accentText}`,
    `--vscode-menu-selectionBackground:${accent}`,
    `--vscode-input-foreground:${text}`,
    '--vscode-input-background:var(--cts-control)',
    `--vscode-input-placeholderForeground:${muted}`,
    '--vscode-commandCenter-background:var(--cts-elevated)',
    `--vscode-commandCenter-foreground:${text}`,
    '--vscode-editorWidget-background:var(--cts-elevated)',
    `--vscode-editorWidget-foreground:${text}`,
    '--vscode-quickInput-background:var(--cts-elevated)',
    `--vscode-quickInput-foreground:${text}`,
    '--vscode-list-hoverBackground:var(--cts-hover)',
    '--vscode-list-activeSelectionBackground:var(--cts-hover)',
    `--vscode-list-activeSelectionForeground:${text}`,
    '--vscode-sideBar-background:var(--cts-glass)',
    `--vscode-sideBar-foreground:${text}`,
    `--vscode-sideBarTitle-foreground:${text}`,
    '--vscode-terminal-background:var(--cts-panel-solid)',
    `--vscode-terminal-foreground:${text}`,
    '--vscode-editor-background:var(--cts-panel-solid)',
    `--vscode-editor-foreground:${text}`,
    '--vscode-textPreformat-background:var(--cts-elevated)',
    `--vscode-textPreformat-foreground:${text}`,
  ].join(';');
}

function themeCss(theme, image) {
  const position = `${theme.art.focusX * 100}% ${theme.art.focusY * 100}%`;
  const effects = theme.effects ?? { preset: 'none', intensity: 0, motion: false };
  const effectOpacity = Math.min(0.72, Math.max(0, effects.intensity));
  const colorScheme = relativeLuminance(solidHex(theme.colors.surface)) < 0.34 ? 'dark' : 'light';
  const semanticTokens = semanticTokenCss(theme);
  return [
    `:root{--cts-accent:${theme.colors.accent};--cts-surface:${theme.colors.surface};--cts-text:${theme.colors.text};--cts-muted:${theme.colors.mutedText};--cts-line:color-mix(in srgb,${theme.colors.accent} 28%,transparent);--cts-glass:color-mix(in srgb,${theme.colors.surface} 82%,transparent);${semanticTokens}}`,
    // ChatGPT defines several semantic variables directly on body. Re-declare the complete
    // theme palette at the same scope so settings cards, command buttons and editor controls
    // do not fall back to the application's light appearance while a dark theme is active.
    `html.cts-theme body,html.cts-theme #root{${semanticTokens}}`,
    `html.cts-theme,html.cts-theme body,html.cts-theme #root{background:transparent!important;color:var(--cts-text)!important;color-scheme:${colorScheme}}`,
    `html.cts-theme body::before{content:'';position:fixed;inset:0;z-index:-4;background:${theme.colors.surface};pointer-events:none}`,
    `#codex-theme-studio-background{position:fixed;inset:0;z-index:-3;overflow:hidden;pointer-events:none!important;user-select:none;background:${theme.colors.overlay} url("${image}") ${position}/cover no-repeat;transition:opacity .28s ease,filter .28s ease}`,
    `#codex-theme-studio-background::before{content:'';position:absolute;inset:-4%;pointer-events:none;background-image:${effectBackground(theme)};background-size:240px 240px,320px 320px,400px 400px;opacity:${effectOpacity};will-change:auto}`,
    `#codex-theme-studio-background::after{content:'';position:absolute;inset:0;pointer-events:none;background:${scrim(theme)}}`,
    `html.cts-theme[data-cts-home-mode='quiet'] #codex-theme-studio-background{filter:saturate(.82) brightness(.78)}`,
    `html.cts-theme[data-cts-route='task'] #codex-theme-studio-background{opacity:.62;filter:saturate(.72) brightness(.62)}`,
    `html.cts-theme[data-cts-route='task'] #codex-theme-studio-background::after{background:linear-gradient(180deg,${theme.colors.overlay} 0%,${theme.colors.surface} 82%,${theme.colors.surface} 100%),${scrim(theme)}}`,
    `html.cts-theme [data-cts-role='main']{position:relative!important;isolation:isolate;background:transparent!important;color:var(--cts-text)!important}`,
    `html.cts-theme [data-cts-role='sidebar']{color:var(--cts-text)!important;background:var(--cts-glass)!important;border-right:1px solid var(--cts-line)!important;box-shadow:12px 0 36px color-mix(in srgb,${theme.colors.surface} 44%,transparent)!important;backdrop-filter:blur(8px) saturate(1.04)!important}`,
    `html.cts-theme [data-cts-role='sidebar'] nav{background:transparent!important}`,
    `html.cts-theme [data-cts-role='sidebar'] :is(button,a){transition:background-color .18s ease,border-color .18s ease,color .18s ease!important}`,
    `html.cts-theme [data-cts-role='sidebar'] :is(button,a):hover{background:color-mix(in srgb,${theme.colors.accent} 12%,transparent)!important}`,
    `html.cts-theme [data-cts-role='composer']{color:var(--cts-text)!important;background:var(--cts-control)!important;border:1px solid var(--cts-line)!important;border-radius:25px!important;box-shadow:0 20px 56px color-mix(in srgb,${theme.colors.surface} 54%,transparent),inset 0 1px 0 #ffffff12!important;backdrop-filter:blur(8px) saturate(1.05)!important}`,
    `html.cts-theme [data-cts-role='composer'] :is(textarea,input,[contenteditable='true']){color:var(--cts-text)!important;caret-color:var(--cts-accent)!important;background:transparent!important}`,
    `html.cts-theme [data-cts-role='composer'] ::placeholder{color:var(--cts-muted)!important;opacity:.82!important}`,
    // Terminal panes mount a nested app-theme scope with inline light-mode VS Code variables.
    // Limit the override to containers that actually own xterm so other embedded app surfaces
    // retain their native role while both docked terminal positions share the active theme.
    `html.cts-theme .app-theme:has(.xterm){--vscode-terminal-background:var(--cts-panel-solid)!important;--vscode-terminal-foreground:var(--cts-text)!important;--color-background-surface:var(--cts-panel-solid)!important;--color-text-foreground:var(--cts-text)!important;background:var(--cts-panel-solid)!important;color:var(--cts-text)!important}`,
    `html.cts-theme .app-theme:has(.xterm) :is(.xterm,.xterm-viewport){background:transparent!important;color:var(--cts-text)!important}`,
    // xterm's DOM renderer generates owner-specific light-theme rules after mounting. Override
    // only its inherited default row color and cursor variants; explicit ANSI span colors remain
    // untouched so command prompts and status colors keep their semantic meaning.
    `html.cts-theme .app-theme:has(.xterm) .xterm-rows{color:var(--cts-text)!important}`,
    `html.cts-theme .app-theme:has(.xterm) .xterm-rows .xterm-dim{color:color-mix(in srgb,var(--cts-text) 52%,transparent)!important}`,
    `html.cts-theme .app-theme:has(.xterm) .xterm-rows .xterm-cursor{color:var(--cts-accent)!important;border-color:var(--cts-accent)!important}`,
    `html.cts-theme .app-theme:has(.xterm) .xterm-rows .xterm-cursor.xterm-cursor-block{background-color:var(--cts-accent)!important;color:var(--cts-panel-solid)!important}`,
    `html.cts-theme .app-theme:has(.xterm) .xterm-rows .xterm-cursor.xterm-cursor-underline{border-bottom-color:var(--cts-accent)!important}`,
    `html.cts-theme [data-cts-role='suggestion']{background:color-mix(in srgb,${theme.colors.surface} 76%,transparent)!important;border:1px solid var(--cts-line)!important;border-radius:16px!important;box-shadow:0 14px 34px color-mix(in srgb,${theme.colors.surface} 30%,transparent)!important;transition:transform .18s ease,border-color .18s ease,background-color .18s ease!important}`,
    `html.cts-theme [data-cts-role='suggestion']:hover{transform:translateY(-2px);border-color:color-mix(in srgb,${theme.colors.accent} 52%,transparent)!important;background:color-mix(in srgb,${theme.colors.surface} 82%,transparent)!important}`,
    `html.cts-theme [data-cts-role='utility']{background:color-mix(in srgb,${theme.colors.surface} 78%,transparent)!important;border-color:var(--cts-line)!important}`,
    `html.cts-theme :is([role='dialog'],[role='menu'],[role='listbox'],[data-radix-popper-content-wrapper]>div,[data-side][data-state='open']){color:var(--cts-text)!important;background:var(--cts-elevated)!important;border-color:var(--cts-line)!important;box-shadow:0 24px 72px #0008,inset 0 1px 0 #ffffff12!important;backdrop-filter:blur(10px) saturate(1.05)!important}`,
    `html.cts-theme :is([role='dialog'],[role='menu'],[role='listbox'],[data-radix-popper-content-wrapper]>div,[data-side][data-state='open']) :is(h1,h2,h3,p,span,label,button,[role='menuitem'],[role='option']){color:var(--cts-text)!important}`,
    `html.cts-theme :is([role='dialog'],[role='menu'],[role='listbox'],[data-radix-popper-content-wrapper]>div,[data-side][data-state='open']) :is(a,[data-link]){color:var(--cts-accent)!important}`,
    `html.cts-theme :is(button,[role='button']):focus-visible{outline:2px solid ${theme.colors.accent}!important;outline-offset:2px!important}`,
    // Account-only demo mode covers the verified identity control as one neutral surface. It does
    // not touch project names, workspace labels, prompts, sidebar rows, or application geometry.
    `html.cts-theme[data-cts-demo='true'] [data-cts-demo-private='1']{position:relative!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}`,
    `html.cts-theme[data-cts-demo='true'] [data-cts-demo-private='1']::after{content:''!important;position:absolute!important;inset:1px!important;z-index:2147483646!important;pointer-events:none!important;border-radius:inherit!important;background:var(--cts-panel-solid)!important}`,
    `html.cts-theme[data-cts-motion='true']:not([data-cts-paused='true']) #codex-theme-studio-background::before{animation:cts-effect-drift 24s ease-in-out infinite alternate;will-change:transform}`,
    `@keyframes cts-effect-drift{from{transform:translate3d(-.6%,0,0)}to{transform:translate3d(.6%,-.4%,0)}}`,
    `@media(prefers-reduced-motion:reduce){html.cts-theme *,#codex-theme-studio-background{transition:none!important}#codex-theme-studio-background::before{animation:none!important;will-change:auto!important}}`,
  ].join('');
}

export function identityExpression() {
  return `(() => {
    const urlOk = location.protocol === 'app:' || location.protocol === 'codex:';
    const bodyOk = Boolean(document.body && document.documentElement);
    const shellMarker = ${serialized([...SELECTORS.sidebar, ...SELECTORS.composerInput, ...SELECTORS.suggestion])}.some(s => document.querySelector(s));
    // Settings uses a dedicated renderer without the home/task composer. Multiple native switch
    // controls are its stable structural identity inside the already verified official process.
    const settingsMarker = document.querySelectorAll(${serialized(SELECTORS.settingsControl.join(','))}).length >= 2;
    const marker = shellMarker || settingsMarker;
    return { ok: urlOk && bodyOk && Boolean(marker), protocol: location.protocol, marker: Boolean(marker) };
  })()`;
}

export function injectionExpression(theme, { demoMode = false } = {}) {
  const payload = imagePayload(theme);
  const settings = {
    id: theme.id,
    name: theme.name,
    appearance: theme.appearance,
    colors: theme.colors,
    art: theme.art,
    effects: theme.effects,
    fingerprint: theme.fingerprint,
    image: payload,
    demoMode,
    selectors: SELECTORS,
  };
  const css = themeCss(theme, '__CTS_IMAGE_URL__');
  return `(() => {
    const next = ${serialized(settings)};
    window.__CODEX_THEME_STUDIO__?.destroy?.();
    const binary = atob(next.image.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const imageUrl = URL.createObjectURL(new Blob([bytes], { type: next.image.mime }));
    delete next.image;
    const tagged = new Set();
    let dirty = false;
    let decoratedOnce = false;
    let frameId = 0;
    let timerId = 0;
    let lastDecoratedAt = 0;
    const root = document.documentElement;
    const background = document.createElement('div');
    background.id = 'codex-theme-studio-background';
    background.setAttribute('aria-hidden', 'true');
    const style = document.createElement('style');
    style.id = 'codex-theme-studio-style';
    style.textContent = ${serialized(css)}.replace('__CTS_IMAGE_URL__', imageUrl);
    root.append(style);
    document.body.prepend(background);
    root.classList.add('cts-theme');
    root.dataset.ctsTheme = next.id;
    root.dataset.ctsHomeMode = next.art.homeMode;
    root.dataset.ctsTaskMode = next.art.taskMode;
    root.dataset.ctsMotion = String(Boolean(next.effects?.motion && next.effects?.intensity > 0));
    root.dataset.ctsPaused = String(document.hidden || !document.hasFocus());
    root.dataset.ctsDemo = String(Boolean(next.demoMode));

    const visible = node => {
      if (!node?.isConnected) return false;
      const rect = node.getBoundingClientRect();
      const computed = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && computed.display !== 'none' && computed.visibility !== 'hidden';
    };
    const tag = (node, role) => {
      if (!node) return;
      node.dataset.ctsRole = role;
      tagged.add(node);
    };
    const composerContainer = input => {
      // Theme the native outer surface instead of the inner editor root. Styling the editor
      // itself adds a second rounded panel that can clip placeholder text and attachments.
      const explicit = input.closest('.composer-surface-chrome,[data-testid*="composer"],form');
      if (explicit) return explicit;
      let node = input.parentElement;
      for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
        const rect = node.getBoundingClientRect();
        if (rect.width >= 320 && rect.height >= 48 && rect.height <= 260) return node;
      }
      return input.parentElement;
    };
    const decorate = () => {
      for (const node of tagged) if (node.isConnected) delete node.dataset.ctsRole;
      tagged.clear();
      const sidebar = next.selectors.sidebar.map(selector => document.querySelector(selector)).find(visible);
      const settingsControls = [
        ...document.querySelectorAll(next.selectors.settingsControl.join(',')),
      ].filter(visible);
      const isSettings = settingsControls.length >= 2;
      const main = [...document.querySelectorAll('main,[role="main"]')].find(visible)
        || (isSettings ? document.body : null);
      const inputs = [...document.querySelectorAll(next.selectors.composerInput.join(','))].filter(visible);
      const input = inputs.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
      const composer = input ? composerContainer(input) : null;
      tag(sidebar, 'sidebar');
      tag(main, 'main');
      tag(composer, 'composer');

      const explicitSuggestions = [...document.querySelectorAll(next.selectors.suggestion.join(','))].filter(visible);
      const taskMarkers = document.querySelectorAll(next.selectors.taskContent.join(','));
      let suggestions = explicitSuggestions;
      if (!suggestions.length && main && composer && !taskMarkers.length) {
        const composerTop = composer.getBoundingClientRect().top;
        suggestions = [...main.querySelectorAll('button,[role="button"]')].filter(node => {
          if (!visible(node) || composer.contains(node)) return false;
          const rect = node.getBoundingClientRect();
          return rect.width >= 150 && rect.height >= 54 && rect.height <= 220 && rect.bottom < composerTop - 8;
        }).slice(0, 8);
      }
      for (const suggestion of suggestions) tag(suggestion, 'suggestion');
      const isTask = !isSettings && taskMarkers.length > 0 && suggestions.length < 2;
      root.dataset.ctsRoute = isSettings ? 'settings' : (isTask ? 'task' : 'home');

      if (main && composer) {
        const composerRect = composer.getBoundingClientRect();
        for (const button of main.querySelectorAll('button,[role="button"]')) {
          if (!visible(button) || composer.contains(button) || suggestions.includes(button)) continue;
          const rect = button.getBoundingClientRect();
          if (rect.bottom <= composerRect.top && rect.bottom >= composerRect.top - 150 && rect.width >= 70) tag(button, 'utility');
        }
      }
    };

    const demo = () => {
      if (!next.demoMode) return;
      for (const selector of next.selectors.privateText) {
        for (const node of document.querySelectorAll(selector)) {
          node.dataset.ctsDemoPrivate = '1';
        }
      }
    };
    const ensure = () => {
      frameId = 0;
      timerId = 0;
      // A newly discovered page can already be hidden behind another app window. It still needs
      // one structural decoration pass so verification does not mistake visibility throttling for
      // adapter incompatibility. Only later updates are deferred until the page becomes visible.
      if (!dirty || (document.hidden && decoratedOnce)) return;
      dirty = false;
      lastDecoratedAt = performance.now();
      decorate();
      demo();
      decoratedOnce = true;
    };
    const schedule = () => {
      dirty = true;
      if (document.hidden || timerId || frameId) return;
      const delay = Math.max(0, 250 - (performance.now() - lastDecoratedAt));
      timerId = window.setTimeout(() => {
        timerId = 0;
        frameId = requestAnimationFrame(ensure);
      }, delay);
    };
    const appRoot = next.selectors.shell.map(selector => document.querySelector(selector)).find(Boolean) || document.body;
    const structuralSelector = [
      'main',
      '[role="main"]',
      ...next.selectors.sidebar,
      ...next.selectors.composerInput,
      ...next.selectors.suggestion,
      ...next.selectors.taskContent,
    ].join(',');
    const touchesStructure = node => {
      if (![Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE].includes(node?.nodeType)) return false;
      return Boolean(node.matches?.(structuralSelector) || node.querySelector?.(structuralSelector));
    };
    // Streaming output creates many text and inline nodes. Ignore those mutations unless they add
    // or remove an adapter-relevant shell, route marker, suggestion or composer structure.
    const structuralMutation = records => records.some(record => (
      record.type === 'attributes'
      || [...record.addedNodes, ...record.removedNodes].some(touchesStructure)
    ));
    const observer = new MutationObserver(records => {
      if (structuralMutation(records)) schedule();
    });
    observer.observe(appRoot, { childList: true, subtree: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-appearance'] });
    const syncPaused = () => {
      root.dataset.ctsPaused = String(document.hidden || !document.hasFocus());
    };
    const resume = () => {
      syncPaused();
      if (root.dataset.ctsPaused === 'false') schedule();
    };
    const pause = () => { root.dataset.ctsPaused = 'true'; };
    const visibility = () => { document.hidden ? pause() : resume(); };
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('blur', pause, { passive: true });
    window.addEventListener('focus', resume, { passive: true });
    document.addEventListener('visibilitychange', visibility, { passive: true });
    dirty = true;
    ensure();

    const destroy = () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visibility);
      if (timerId) clearTimeout(timerId);
      if (frameId) cancelAnimationFrame(frameId);
      for (const node of tagged) if (node.isConnected) delete node.dataset.ctsRole;
      for (const node of document.querySelectorAll('[data-cts-demo-private]')) delete node.dataset.ctsDemoPrivate;
      document.querySelector('#codex-theme-studio-demo-badge')?.remove();
      background.remove();
      style.remove();
      URL.revokeObjectURL(imageUrl);
      root.classList.remove('cts-theme');
      delete root.dataset.ctsTheme;
      delete root.dataset.ctsRoute;
      delete root.dataset.ctsHomeMode;
      delete root.dataset.ctsTaskMode;
      delete root.dataset.ctsMotion;
      delete root.dataset.ctsPaused;
      delete root.dataset.ctsDemo;
      delete window.__CODEX_THEME_STUDIO__;
      return true;
    };
    window.__CODEX_THEME_STUDIO__ = {
      version: ${ADAPTER_VERSION},
      themeId: next.id,
      fingerprint: next.fingerprint,
      demoMode: next.demoMode,
      route: () => root.dataset.ctsRoute,
      destroy,
    };
    return { ok: true, themeId: next.id, adapterVersion: ${ADAPTER_VERSION}, route: root.dataset.ctsRoute, demoMode: next.demoMode };
  })()`;
}

export function restoreExpression() {
  return `(() => window.__CODEX_THEME_STUDIO__?.destroy?.() ?? true)()`;
}

export function verifyExpression(themeId = null, fingerprint = null, demoMode = null) {
  return `(() => {
    const runtime = window.__CODEX_THEME_STUDIO__;
    const root = document.documentElement;
    const backgroundCount = document.querySelectorAll('#codex-theme-studio-background').length;
    const styleCount = document.querySelectorAll('#codex-theme-studio-style').length;
    const bg = document.querySelector('#codex-theme-studio-background');
    const mainTagged = Boolean(document.querySelector('[data-cts-role="main"]'));
    const visible = node => {
      if (!node?.isConnected) return false;
      const rect = node.getBoundingClientRect();
      const computed = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && computed.display !== 'none' && computed.visibility !== 'hidden';
    };
    const inputs = [...document.querySelectorAll(${serialized(SELECTORS.composerInput.join(','))})].filter(visible);
    const composerTagged = inputs.length > 0 && inputs.some(input => input.closest('[data-cts-role="composer"]'));
    const settingsControlCount = [...document.querySelectorAll(${serialized(SELECTORS.settingsControl.join(','))})]
      .filter(visible).length;
    const pointerSafe = Boolean(bg) && getComputedStyle(bg).pointerEvents === 'none';
    const route = document.documentElement.dataset.ctsRoute || null;
    const routeSupported = route === 'home' || route === 'task' || route === 'settings';
    const interactive = route === 'settings'
      ? mainTagged && settingsControlCount >= 2
      : mainTagged && composerTagged;
    const semanticReady = Boolean(getComputedStyle(document.body).getPropertyValue('--color-token-text-primary').trim());
    const privateTextSelector = ${serialized(SELECTORS.privateText.join(','))};
    const privateTextReady = [...document.querySelectorAll(privateTextSelector)]
      .filter(visible)
      .every(node => node.dataset.ctsDemoPrivate === '1');
    const privacyReady = ${demoMode === true
      ? `root.dataset.ctsDemo === 'true' && privateTextReady`
      : 'true'};
    const fingerprintMatched = ${fingerprint
      ? `runtime?.fingerprint === ${serialized(fingerprint)}`
      : 'Boolean(runtime?.fingerprint)'};
    const expectedRuntime = Boolean(
      runtime
      && runtime.version === ${ADAPTER_VERSION}
      ${themeId ? `&& runtime.themeId === ${serialized(themeId)}` : ''}
      && fingerprintMatched
      ${demoMode !== null ? `&& runtime.demoMode === ${serialized(Boolean(demoMode))}` : ''}
    );
    return {
      ok: Boolean(
        expectedRuntime
        && backgroundCount === 1
        && styleCount === 1
        && interactive
        && pointerSafe
        && routeSupported
        && semanticReady
        && privacyReady
      ),
      themeId: runtime?.themeId || null,
      adapterVersion: runtime?.version || null,
      fingerprintMatched,
      demoMode: runtime?.demoMode ?? null,
      route,
      backgroundCount,
      styleCount,
      mainTagged,
      composerTagged,
      settingsControlCount,
      interactive,
      pointerSafe,
      routeSupported,
      semanticReady,
      privacyReady,
    };
  })()`;
}

export async function assertPageIdentity(session) {
  const identity = await session.evaluate(identityExpression());
  if (!identity?.ok) fail('TARGET_IDENTITY_FAILED', 'The target did not match a supported ChatGPT/Codex page adapter.');
  return identity;
}
