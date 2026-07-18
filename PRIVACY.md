# Privacy

Theme Studio for Codex is local-first and has no product telemetry by default.

- Themes, logs, and state are stored under `~/Library/Application Support/CodexThemeStudio/`.
- The installed runtime is stored under `~/.codex/codex-theme-studio/`.
- The project does not upload prompts, task history, usernames, file paths, images, or usage events.
- Logs contain operation names and error codes, not page text or task content.
- Demo mode masks account and username labels without disabling the sidebar, composer, terminal, or
  other interactive controls.
- The release screenshot tool accepts only new-task and settings views. Before a new-task image is
  persisted, it adds a temporary `pointer-events: none` mask over rendered sidebar text and
  workspace/branch labels, captures the full window, and removes the mask immediately.
- Task work pages, conversation bodies and terminal output are not included in public examples.

Installing from GitHub or using optional voice-generation services is governed by those services' privacy policies. Hyperframes telemetry is disabled in the supplied video workflow.
