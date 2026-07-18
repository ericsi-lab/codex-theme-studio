# Troubleshooting

- `UNSUPPORTED_PLATFORM`: v0.1.0 supports macOS only.
- `APP_NOT_RUNNING`, `CDP_UNAVAILABLE`, or `CDP_PROCESS_MISMATCH`: ask for explicit restart consent,
  then run `enable --confirmed`. The user should not need Terminal. Installation also creates
  `~/Applications/Theme Studio for Codex.app` as an optional one-click launcher.
- `CDP_NOT_LOOPBACK`: stop immediately. Do not connect to the endpoint.
- `APP_IDENTITY_FAILED`: no acceptable OpenAI-signed app identity was found. The runtime checks both
  the migrated `ChatGPT.app` and legacy `Codex.app`, and may fall back to a valid legacy app.
- `APP_SIGNATURE_INCOMPATIBLE`: the migrated ChatGPT app was recognized, but macOS rejected the
  local signature for this exact build. Do not bypass the check and do not ask the user to run
  manual signature commands. Theme injection stays unavailable, while `list`, image generation,
  and `import` still work. Retry after the official desktop app updates; reinstall is an optional
  repair, not a recurring requirement.
- `TARGET_IDENTITY_FAILED`: open a normal Codex home or task page inside the app. Never inject into an arbitrary browser target.
- `THEME_INVALID`: fix the field or image issue reported by the validator; do not weaken limits.
- `PREVIEW_TIMEOUT`: expected automatic restore. Apply only after the user chooses the theme.
- `VERIFY_FAILED`: run `restore`, leave the app usable, and report the failing interaction check.
  The background watcher also deactivates the theme after a persistent verification failure; it
  must not restore and then silently reapply the same incompatible theme on the next cycle.
