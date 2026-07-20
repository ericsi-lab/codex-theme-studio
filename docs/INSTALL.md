# Install Theme Studio for Codex

The simplest installation is to ask a new Codex task to add the Marketplace explicitly:

```text
Add the main branch of https://github.com/ericsi-lab/codex-theme-studio as a
Codex Plugin Marketplace, then install codex-theme-studio from that Marketplace.
This is a Marketplace repository; do not treat the repository root as a direct
plugin directory. Do not ask me to use Terminal. Ask before restarting ChatGPT,
then report installation status, launcher location, whether it is required, and
whether the featured default theme is active.
```

When local commands, GitHub access and plugin installation are allowed, Codex can add the
marketplace and install the Plugin, runtime and launcher. It still asks before restarting the
desktop app. This is an agent-assisted flow, not a silent-install protocol, and managed workspace
policy can restrict it.

If the assisted flow does not recognize the Marketplace correctly, use the official Codex CLI
fallback:

```sh
codex plugin marketplace add ericsi-lab/codex-theme-studio --ref main
codex plugin add codex-theme-studio@codex-theme-studio
```

Then start a new task and say “install themes.” The repository root contains
`.agents/plugins/marketplace.json`; the actual plugin manifest is
`plugins/codex-theme-studio/.codex-plugin/plugin.json`, so a root-level
`.codex-plugin/plugin.json` is not expected.

For manual installation, add this repository's marketplace in the ChatGPT desktop Plugins page,
install **Theme Studio for Codex**, then start a new task and say “install themes”. Legacy
`Codex.app` is also supported.

The Skill installs the runtime in `~/.codex/codex-theme-studio/` and stores themes under `~/Library/Application Support/CodexThemeStudio/themes/`. It does not require administrator access.

The installation result reports runtime status, the launcher path, whether it is required, the
featured first theme and the next action. Installation also creates
`~/Applications/Theme Studio for Codex.app`. This optional, non-resident launcher opens ChatGPT in
loopback-only theme mode without showing a Terminal command. Its first successful activation
applies **万妖图录·龙渊灵姬** unless the user already requested another theme. Later opens preserve
the active theme and never override an explicit restore. The Skill can perform the same consented
restart, so opening the launcher is not required.
The launcher uses the project's original icon. During an upgrade, the installer removes the former
`Codex Theme Studio.app` only when its private managed marker is present. Unrelated applications are
never replaced or deleted.
The launcher resolves either a verified current `ChatGPT.app` or a verified legacy `Codex.app` and
does not remain resident. After an official desktop update, ask the Skill to check upgrade
compatibility; this validates the new build and structural adapter contract without reading task
text, prompts, project names, or usernames.

Users install the Plugin; they do not install the Skill separately. The Skill interprets requests such as “create an original Nezha theme” or “use this local image”, then delegates validation and packaging to the deterministic local CLI. Generated themes preview for 30 seconds by default and are applied only after confirmation.

The theme engine recognizes the official Codex-to-ChatGPT desktop migration, detects current
`ChatGPT.app` and legacy `Codex.app`, and only accepts a loopback CDP endpoint. It requires the exact
Bundle ID, OpenAI Team ID, Apple Developer ID chain and macOS dynamic validity of the running
process before connecting. Static deep resource-envelope verification remains diagnostic so a
transient false negative during an official update cannot block a first-time user. Users are not
expected to reinstall the app or run manual signature commands.

If the initial doctor check reports that CDP is unavailable, approve the one-click theme-mode
restart shown by the Skill. Never expose the debugging port on `0.0.0.0` or forward it to another
machine.

Updates preserve user themes. Uninstall also preserves them by default; deleting user media requires a separate explicit confirmation.

Imported images are limited to 16 MiB, 12 megapixels and 8192 px per side. Animated images, symbolic links, forged extensions and unsafe paths are rejected before full decoding.
