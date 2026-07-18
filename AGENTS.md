# Repository guide for coding agents

## Product boundary

This is an independent, open-source Codex theme manager. Never describe it as a replica and never copy third-party code, assets, copy, screenshots, or structure.

## Engineering rules

- Keep production code dependency-light, concise, and readable.
- Do not modify the official Codex application, signature, model configuration, or credentials.
- CDP must be loopback-only and every target must pass identity checks.
- Any failed or timed-out preview must restore the original page.
- Decoration layers must use `pointer-events: none`.
- Unknown theme fields are forward-compatible; unsafe paths, symbolic links, and oversized images are rejected.
- User themes and media must survive upgrades and default uninstall.
- No telemetry. Never log page text, prompts, task names, usernames, or absolute user paths.

## Required checks

Run `npm test` and `npm run validate:themes`. For visual changes, verify light/dark mode, home/task views, narrow/wide windows, pointer interaction, and demo-mode privacy.

