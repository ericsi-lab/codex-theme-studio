# Performance and memory acceptance

Theme Studio for Codex treats performance as a release gate, not a marketing claim.

## Runtime design

- Theme lists read manifests and bounded image headers; they do not retain compressed image buffers.
- The installed watcher keeps only a lightweight `/bin/sh` supervisor resident. Every 30 seconds it
  starts one bounded Node reconciliation cycle and lets the full V8/CDP process exit immediately.
  This trades a short periodic check for substantially lower idle RSS.
- A reconciliation that sees a transient route transition waits up to two seconds for ChatGPT's
  main and composer structure to stabilize. If verification still fails, the watcher restores the
  page, clears the active theme, and stops instead of repeatedly restoring and reapplying it.
- A reconciliation cycle reads theme metadata only. It loads image bytes only when a new page,
  adapter version, theme fingerprint or demo-mode value actually requires reinjection.
- Deep code-signature verification runs once for each unchanged desktop-app build. The local cache
  is keyed by version, build, CDHash, executable metadata, and CodeResources metadata, and stores
  both a successful result and a stable rejection. A desktop update or signed-file change
  invalidates the entry automatically. Ordinary commands and 30-second watcher health checks do
  not repeat `codesign --deep`.
- Renderer images use Blob URLs. Switch and restore revoke the old URL, disconnect observers, cancel timers and animation frames, and remove all decoration nodes.
- DOM changes are coalesced to at most one decoration pass per 250 ms. Streaming text-only
  mutations are ignored; only shell, route, suggestion and composer structure changes schedule a
  pass. Work and motion pause while the page is hidden or the window is unfocused.
- Optional effects use one CSS pseudo-element and one low-frequency transform. Reduced-motion and hidden-page states disable motion.
- Runtime logs are capped at 256 KiB and contain stable event codes only.

Run the loader micro-benchmark with:

```sh
npm run benchmark:loader
```

This benchmark proves only the Node theme-loading path. It must never be presented as renderer CPU or memory evidence.

Run the reversible official-app A/B measurement with:

```sh
npm run benchmark:app -- \
  --confirmed \
  --theme fortune-guardian \
  --warmup 120 \
  --seconds 600 \
  --switches 30
```

The explicit confirmation is required because the benchmark temporarily restores the original
appearance, reapplies the selected theme without the watcher, performs the switch/restore retention
check, and finally restores the user's previous theme and demo-mode state.

## Release measurement

Measure the official signed ChatGPT desktop build in home and task views, with both narrow and wide windows:

1. Record a restored baseline after a two-minute warm-up.
2. Apply each theme and wait two minutes.
3. Record CPU once per second for ten minutes and renderer RSS once every ten seconds.
4. Switch themes 30 times, restore, force no manual process termination, and record retained RSS.
5. Repeat with a streaming task, a backgrounded window, reduced motion, and demo mode.

Release thresholds:

- Theme-attributable ten-minute idle CPU average below 1%.
- Theme-attributable idle CPU P95 below 3%.
- Additional renderer RSS below 100 MB.
- Retained RSS growth after 30 switches below 20 MB.
- Restore leaves no theme node, Blob URL, observer, timer, animation frame, or watcher process.

Store sanitized raw measurements and the tested app/plugin versions under `marketing/video/assets/proof/`. Do not publish numbers until the signed-app run passes.
