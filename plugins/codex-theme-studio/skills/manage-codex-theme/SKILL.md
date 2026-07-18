---
name: manage-codex-theme
description: Manage and create Theme Studio for Codex themes on macOS. Use when the user asks to install themes, generate or import a custom background, list themes, preview or switch themes, check theme health, enable privacy-safe demo mode, update, restore the original Codex appearance, or uninstall the local theme runtime.
---

# Manage Codex Theme

Use the bundled deterministic command wrapper for every state-changing action. Do not edit `ChatGPT.app`, legacy `Codex.app`, Electron resources, model settings, or credentials.

## Workflow

1. Identify the requested operation and confirm macOS support. Windows is not supported in v0.1.0.
2. For first use, run `scripts/cts install`, then `scripts/cts doctor`. The runtime
   recognizes the official Codex-to-ChatGPT migration automatically and caches the identity result
   for that unchanged desktop-app build; do not ask the user to run codesign or reinstall on every
   command.
3. If doctor reports `CDP_UNAVAILABLE`, `CDP_PROCESS_MISMATCH`, or `APP_NOT_RUNNING`, explain that
   ChatGPT needs one theme-mode restart and obtain explicit user confirmation. After confirmation,
   run `scripts/cts enable --confirmed`, then continue the requested preview or apply. Do not
   make the user type a Terminal command. Never bind CDP to a non-loopback address.
4. Run the closest command below. Report the theme name, result, and recovery status in plain language.
5. After apply, switch, or preview, run `scripts/cts verify`. If verification fails, immediately run `scripts/cts restore` and report the failure without retry loops.

## Commands

```sh
scripts/cts install
scripts/cts enable --confirmed
scripts/cts doctor
scripts/cts compatibility
scripts/cts list
scripts/cts import /absolute/path/to/theme-or-image
scripts/cts preview THEME_ID --seconds 30
scripts/cts apply THEME_ID
scripts/cts switch THEME_ID
scripts/cts verify
scripts/cts restore
scripts/cts update
scripts/cts demo-mode on
scripts/cts demo-mode off
scripts/cts uninstall
```

Resolve a Chinese display name with `list` before passing its stable ID. Quote paths. Import accepts either a theme directory or one local PNG, JPEG, or WebP image; the runtime validates size, dimensions, symlinks, and path containment.

For a custom image, pass analyzed metadata instead of editing user data directly:

```sh
scripts/cts import /absolute/path/to/background.png \
  --name "我的主题" \
  --accent "#72D6C9" \
  --surface "#101820CC" \
  --text "#F4F7F6" \
  --muted-text "#C2CECB" \
  --overlay "#07110E66" \
  --focus-x 0.8 \
  --focus-y 0.5 \
  --safe-area 0.55 \
  --safe-side left \
  --effect mist \
  --effect-intensity 0.18 \
  --motion
```

## Generate a custom background

1. Turn the user's request into a static background prompt. Keep the content-safe side calm and move the focal subject away from it.
2. If an image-generation tool is available, generate one original PNG or JPEG without UI, text, logos, watermarks, or recognizable commercial characters. Do not require or retain an API key.
3. If no image-generation tool is available, ask for one local PNG, JPEG, or still WebP image and continue with import.
4. Inspect the result and derive a readable accent, dark translucent surface, light text colors, focus point, safe side, and one restrained effect. Keep effect intensity at or below `0.25`.
5. Run `import` with the metadata flags above. Never write directly into the runtime data directory.
6. Run `preview THEME_ID --seconds 30`, then `verify`. Apply only after the user confirms the preview.
7. If generation, import, preview, or verification fails, preserve the source image, restore the original page, and report the exact stable error code without retry loops.

## Safety and consent

- A preview defaults to 30 seconds and restores automatically. Keep it between 5 and 120 seconds.
- Never run `enable --confirmed` until the user approves closing and reopening ChatGPT. Switching
  themes while theme mode is active does not require another restart.
- Accept only still images up to 16 MiB, 8,192 pixels per side, and 12 megapixels. Reject animated PNG/WebP files before renderer injection.
- Use only `none`, `mist`, `stars`, `embers`, `petals`, or `glow` effects. Themes never carry executable JavaScript.
- `uninstall` preserves user themes. Only use `uninstall --delete-user-data` after the user explicitly asks to delete their images and confirms the irreversible action.
- Do not expose task content in logs or screenshots. Turn on demo mode before capture and turn it off afterward.
- Never bypass signature, process, page-identity, or loopback checks. Use [troubleshooting](references/troubleshooting.md) for failures.
- After an official ChatGPT/Codex desktop update, run `compatibility` before reporting the active
  theme healthy. It validates the new signed build and structural adapter contract without reading
  page text, prompts, project names, usernames or local task paths.
- `list`, image generation, and `import` remain available when the desktop build cannot pass
  injection checks. Do not imply that a non-injection operation requires a healthy CDP session.
- Read [theme schema](references/theme-schema.md) when creating or diagnosing a custom theme.
