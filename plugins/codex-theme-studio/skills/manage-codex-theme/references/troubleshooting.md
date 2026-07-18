# Troubleshooting

- `UNSUPPORTED_PLATFORM`: v0.1.0 supports macOS only.
- `APP_NOT_RUNNING`, `CDP_UNAVAILABLE`, or `CDP_PROCESS_MISMATCH`: ask for explicit restart consent,
  then run `enable --confirmed`. The user should not need Terminal. Installation also creates
  `~/Applications/Theme Studio for Codex.app` as an optional one-click launcher. On a fresh
  installation its first successful activation applies 万妖图录·龙渊灵姬; later opens restore the
  user's active theme and do not override an explicit restore.
- `CDP_NOT_LOOPBACK`: stop immediately. Do not connect to the endpoint.
- `APP_IDENTITY_FAILED`: no acceptable OpenAI-signed app identity was found. The runtime checks both
  the migrated `ChatGPT.app` and legacy `Codex.app`, and may fall back to a valid legacy app. It
  requires the exact Bundle ID, OpenAI Team ID, Apple Developer ID chain and macOS dynamic validity
  for the running process. Do not ask the user to run manual signature commands.
- `TARGET_IDENTITY_FAILED`: open a normal Codex home or task page inside the app. Never inject into an arbitrary browser target.
- `THEME_INVALID`: fix the field or image issue reported by the validator; do not weaken limits.
- `PREVIEW_TIMEOUT`: expected automatic restore. Apply only after the user chooses the theme.
- `VERIFY_FAILED`: run `restore`, leave the app usable, and report the failing interaction check.
  The background watcher restores only incomplete targets, keeps the user's selected theme, and
  retries with bounded backoff. A healthy main page is not deactivated because an auxiliary or
  hidden renderer is temporarily incomplete.
