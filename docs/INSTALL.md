# Install Theme Studio for Codex

1. Add this repository's marketplace in the ChatGPT desktop Plugins page. Legacy `Codex.app` is also supported.
2. Install **Theme Studio for Codex**.
3. Start a new task and say “install themes”.

The Skill installs the runtime in `~/.codex/codex-theme-studio/` and stores themes under `~/Library/Application Support/CodexThemeStudio/themes/`. It does not require administrator access.

Installation also creates `~/Applications/Theme Studio for Codex.app`. This optional launcher opens
ChatGPT in loopback-only theme mode without showing a Terminal command. If ChatGPT was opened
normally, the Skill asks for explicit consent and then performs the same safe restart itself.
Switching themes while theme mode is active does not restart the app.
The launcher uses the project's original icon. During an upgrade, the installer removes the former
`Codex Theme Studio.app` only when its private managed marker is present. Unrelated applications are
never replaced or deleted.
The launcher resolves either a verified current `ChatGPT.app` or a verified legacy `Codex.app` and
does not remain resident. After an official desktop update, ask the Skill to check upgrade
compatibility; this validates the new build and structural adapter contract without reading task
text, prompts, project names, or usernames.

Users install the Plugin; they do not install the Skill separately. The Skill interprets requests such as “create an original Nezha theme” or “use this local image”, then delegates validation and packaging to the deterministic local CLI. Generated themes preview for 30 seconds by default and are applied only after confirmation.

The theme engine recognizes the official Codex-to-ChatGPT desktop migration, detects current
`ChatGPT.app` and legacy `Codex.app`, and only accepts a loopback CDP endpoint. A deep signature
check runs once per unchanged desktop-app build; its result is cached and automatically invalidated
when the app build or signed files change. Users are not expected to download the app or run manual
signature commands for every theme operation.

If the initial doctor check reports that CDP is unavailable, approve the one-click theme-mode
restart shown by the Skill. If it reports `APP_SIGNATURE_INCOMPATIBLE`, non-injection
features such as listing, generating, and importing themes remain available, but preview/apply stay
disabled until an official app build passes macOS verification. Never expose the debugging port on
`0.0.0.0` or forward it to another machine.

Updates preserve user themes. Uninstall also preserves them by default; deleting user media requires a separate explicit confirmation.

Imported images are limited to 16 MiB, 12 megapixels and 8192 px per side. Animated images, symbolic links, forged extensions and unsafe paths are rejected before full decoding.
