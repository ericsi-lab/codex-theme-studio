import { CDP_ORIGIN } from './config.mjs';
import { fail } from './errors.mjs';

const LOOPBACK = new Set(['127.0.0.1', '::1', '[::1]']);

export function validateLoopbackUrl(input, protocols = ['http:', 'ws:']) {
  let url;
  try { url = new URL(input); }
  catch { fail('CDP_INVALID_URL', 'CDP endpoint is not a valid URL.'); }
  if (!protocols.includes(url.protocol)) fail('CDP_INVALID_URL', `Unsupported CDP protocol: ${url.protocol}`);
  if (!LOOPBACK.has(url.hostname)) fail('CDP_NOT_LOOPBACK', 'CDP must be bound to a loopback address.');
  if (url.username || url.password) fail('CDP_INVALID_URL', 'CDP endpoint may not contain credentials.');
  return url;
}

async function getJson(pathname) {
  const origin = validateLoopbackUrl(CDP_ORIGIN, ['http:']);
  const response = await fetch(new URL(pathname, origin), { signal: AbortSignal.timeout(2_500) }).catch(() => null);
  if (!response?.ok) fail('CDP_UNAVAILABLE', `Codex CDP is not available at ${origin.origin}.`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) fail('CDP_INVALID_RESPONSE', 'CDP returned an unexpected response type.');
  return response.json();
}

export async function getVersion() {
  const version = await getJson('/json/version');
  if (!version.webSocketDebuggerUrl) fail('CDP_INVALID_RESPONSE', 'CDP browser endpoint is missing.');
  validateLoopbackUrl(version.webSocketDebuggerUrl, ['ws:']);
  return version;
}

export async function getTargets() {
  const targets = await getJson('/json/list');
  if (!Array.isArray(targets)) fail('CDP_INVALID_RESPONSE', 'CDP target list is invalid.');
  return targets.filter(target => {
    if (target.type !== 'page' || typeof target.webSocketDebuggerUrl !== 'string') return false;
    try {
      validateLoopbackUrl(target.webSocketDebuggerUrl, ['ws:']);
      const page = new URL(target.url);
      return page.protocol === 'app:' || page.protocol === 'codex:';
    } catch {
      return false;
    }
  });
}

export class CdpSession {
  #socket;
  #nextId = 1;
  #pending = new Map();

  static async connect(endpoint) {
    validateLoopbackUrl(endpoint, ['ws:']);
    const session = new CdpSession();
    await session.#open(endpoint);
    return session;
  }

  async #open(endpoint) {
    this.#socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket timed out.')), 2_500);
      this.#socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.#socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP WebSocket failed.')); }, { once: true });
    }).catch(error => fail('CDP_UNAVAILABLE', error.message));
    this.#socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message.id) return;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    this.#socket.addEventListener('close', () => {
      for (const pending of this.#pending.values()) pending.reject(new Error('CDP session closed.'));
      this.#pending.clear();
    });
  }

  request(method, params = {}) {
    if (this.#socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP session is not open.'));
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`CDP method timed out: ${method}`));
      }, 4_000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, { awaitPromise = true, returnByValue = true } = {}) {
    const result = await this.request('Runtime.evaluate', { expression, awaitPromise, returnByValue });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Page evaluation failed.');
    return result.result?.value;
  }

  close() {
    this.#socket?.close();
  }
}

/**
 * Runs one operation across page targets while allowing known non-app helper targets to be ignored.
 *
 * ChatGPT can expose internal `app:` pages alongside the actual home and task pages. Those helper
 * pages are still valid CDP targets, but they do not contain the Codex shell and must not prevent an
 * eligible page from receiving a theme.
 *
 * @param {object[]} targets CDP page targets returned by the loopback-only target endpoint.
 * @param {(target: object) => Promise<{close: () => void}>} connect Opens an isolated CDP session.
 * @param {(session: object, target: object) => Promise<unknown>} operation Page-scoped operation.
 * @param {{ignoredErrorCodes?: string[]}} options Stable page errors that identify skippable targets.
 * @returns {Promise<unknown[]>} Results from eligible targets; never includes skipped helper pages.
 */
export async function runTargetOperations(
  targets,
  connect,
  operation,
  { ignoredErrorCodes = [] } = {},
) {
  const ignored = new Set(ignoredErrorCodes);
  const results = [];
  let skipped = 0;
  for (const target of targets) {
    const session = await connect(target);
    try {
      results.push(await operation(session, target));
    } catch (error) {
      if (!ignored.has(error?.code)) throw error;
      skipped += 1;
    } finally {
      session.close();
    }
  }
  if (!results.length && skipped) {
    fail('TARGET_IDENTITY_FAILED', 'No eligible ChatGPT/Codex app page passed validation.');
  }
  return results;
}

export async function withCodexPages(operation) {
  const targets = await getTargets();
  if (!targets.length) fail('TARGET_IDENTITY_FAILED', 'No eligible Codex app page was found.');
  return runTargetOperations(
    targets,
    target => CdpSession.connect(target.webSocketDebuggerUrl),
    operation,
    { ignoredErrorCodes: ['TARGET_IDENTITY_FAILED'] },
  );
}
