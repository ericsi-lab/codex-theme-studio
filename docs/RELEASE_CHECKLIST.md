# Release checklist

## Code and package

- Run `npm test`, `npm run validate:themes`, `npm run benchmark:loader` and
  `npm run check:compatibility`.
- Run the confirmed official-app A/B benchmark documented in `docs/PERFORMANCE.md`; archive only
  sanitized measurements from a full warm-up and ten-minute sample.
- Run the official Plugin and Skill validators.
- Confirm no credentials, OAuth data, logs, private screenshots or absolute user paths are packaged.
- Generate the Release ZIP and SHA-256 with `npm run package`.
- Verify update and default uninstall preserve user themes and media.
- Confirm the launcher uses an original, non-OpenAI app icon and a name that cannot be mistaken for
  an official OpenAI application.

## Real app

- Use an official ChatGPT build that passes the macOS signature check.
- Verify `doctor → preview → verify → automatic restore`.
- Verify `apply → verify → restore`.
- Test home/task, light/dark, narrow/wide, streaming, modal and reduced-motion states.
- Confirm every decoration layer uses `pointer-events: none`.
- Record actual CPU/RSS evidence using `docs/PERFORMANCE.md`; never substitute loader-only benchmark data.

## Public media

- Enable account-only demo mode before capture; confirm the application remains fully interactive.
- Capture only the complete new-task view and official settings window. Do not publish task work
  pages, conversation bodies or terminal output.
- Confirm project names, workspace labels, the full sidebar and application structure remain
  visible, while account avatar, username and email are the only masked elements.
- Record source, license, date, SHA-256 and public permission in the video asset manifest.
- Replace every pending-proof placeholder only with real evidence.
- Use licensed narration, music, sound effects and fonts.
- Render 9:16, 1:1 and 16:9 variants; validate duration, dimensions, fps, codecs, audio and safe areas with `ffprobe`.
- Do not upload to GitHub, WeChat, Douyin or Xiaohongshu until the user confirms the account and final content.
