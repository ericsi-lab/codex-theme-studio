# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [Unreleased]

### Changed

- Added a full English README with reciprocal language navigation and release-audit coverage.
- README gallery now uses a reproducible compact 18-theme layout with larger exact labels.
- First-time installation docs now lead with the verified “paste the GitHub URL into a Codex task”
  flow and retain Marketplace installation as the manual alternative.
- The optional launcher now belongs to the `ericsi-lab` bundle namespace and applies
  万妖图录·龙渊灵姬 once on a fresh installation's first consented theme-mode activation.
- Installation returns structured onboarding feedback while preserving existing users' active or
  restored appearance during upgrades.

### Fixed

- Official ChatGPT builds are no longer blocked by a transient static resource-envelope false
  negative. Bundle identity remains required, and macOS must validate the running PID plus its
  OpenAI Developer ID chain before the runtime connects to loopback CDP.

## [0.1.0] - 2026-07-18

### Added

- macOS Plugin and `manage-codex-theme` Skill.
- Local CDP theme runtime with doctor, preview, apply, verify, restore, and uninstall flows.
- Safe theme package validator and the initial six original presets.
- Six project-owner-authorized “万妖图录” themes with their original 1672×941 PNG backgrounds:
  Liuli Lotus Dream, Longyuan Spirit, Moon-Wheel Sovereign, Ember-Night Sovereign,
  Moonfall Umbrella Spirit, and Crimson-Gate Celestial.
- Six original character-led themes: Fortune Guardian, Moonlit Erlang, Dawn Monkey King, Lotus Fire Nezha, Star River Spirit, and Clockwork Fox Spirit.
- Optional safe `effects` metadata with bounded mist, star, ember, petal and glow presets.
- Natural-language custom background workflow and deterministic import metadata flags.
- Reproducible 28-second HyperFrames launch-video source, story, script and QA snapshots.
- Plan Control Deck keynote design system and capture guide for later launch-video production.
- User-level `Theme Studio for Codex.app` launcher and consent-gated one-click theme-mode restart.
- Loader benchmark and signed-app performance acceptance guide.
- Deterministic real-screenshot workflow for all eighteen themes, limited to full-window new-task
  and official settings views with screenshot-time identity redaction.

### Changed

- Theme listing now loads metadata without reading every image buffer.
- The official Codex-to-ChatGPT migration is recognized automatically. Stable bundle identity is
  cached per unchanged app-build fingerprint, and candidate discovery can fall back from a
  rejected current ChatGPT app to a valid legacy Codex app.
- Renderer injection now uses revocable Blob URLs, scoped observers, coalesced updates, visibility throttling and deterministic cleanup.
- Image limits are enforced from bounded headers before full decoding: 16 MiB, 12 MP and 8192 px per side.
- Runtime logs are bounded and store only sanitized event codes.
- The resident watcher is now a lightweight shell supervisor; full Node/CDP reconciliation runs
  as a bounded short-lived process every 30 seconds.
- Watcher reconciliation now waits for transient route structure to settle. A persistent
  post-injection verification failure restores the page, clears the active theme, and stops
  automatic retries instead of repeatedly removing and reapplying the theme.
- Desktop-upgrade compatibility checks now validate adapter version, theme fingerprint, route,
  semantic tokens, main/composer roles and deterministic decoration-node counts.
- Renderer observation now ignores streaming text-only mutations, pauses motion when the window
  loses focus and uses lower-cost blur levels for primary glass surfaces.

### Fixed

- Preview and apply failures now restore the prior appearance before returning an error.
- First-use activation no longer requires the user to type a Terminal command.
- Theme injection now skips internal ChatGPT helper targets and continues across eligible home and
  task pages instead of failing the whole switch with `TARGET_IDENTITY_FAILED`.
- ChatGPT semantic text, input, menu, dialog and editor color tokens now follow the active theme,
  preventing dark text on dark artwork and unthemed white elevated surfaces.
- Semantic tokens are also applied at ChatGPT's body scope, so Settings panels and the
  “Open in Cursor” control no longer fall back to white surfaces.
- Composer decoration now targets the native outer surface instead of the inner editor, preventing
  duplicate rounded backgrounds from covering placeholder text and attachments.
- Docked bottom and right terminal surfaces now override their nested light-mode VS Code variables,
  keeping terminal backgrounds and default text aligned with the active theme.
- Terminal default input text and cursor colors now override xterm's late-generated light-theme
  owner rules, while preserving ANSI prompt and command colors.
- The optional launcher now uses accurate ChatGPT/Codex-neutral copy while retaining automatic
  current-app preference and verified legacy fallback.
- Current ChatGPT task pages are detected through stable thread markers, so task-mode contrast and
  background dimming no longer fall back to the brighter home treatment.
- Animated PNG/WebP files and compressed oversized-dimension images are rejected before renderer decode.
- The independent settings renderer is now identified through stable switch controls and receives
  the same theme, semantic token, pointer-safety and verification contract as home/task pages.
- Privacy-safe demo mode and deterministic launch-art templates.
