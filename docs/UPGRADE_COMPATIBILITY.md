# Desktop app upgrade compatibility

Theme Studio for Codex treats every official ChatGPT/Codex desktop update as a new compatibility
boundary. It never assumes a previously verified binary or page adapter is still safe.

## Automatic checks

When the application version, build, CDHash, executable metadata or signed resources change:

1. The previous identity-cache entry no longer matches.
2. Bundle ID, OpenAI Team ID and the Apple Developer ID requirement are checked for the build.
3. macOS must report the running desktop process as dynamically valid with the complete OpenAI
   Developer ID authority chain before CDP is touched.
4. Every eligible page must pass the `app:`/`codex:` identity marker check.
5. After theme injection, the adapter verifies exactly one background and style node, a supported
   home/task route, tagged main and composer surfaces, semantic theme tokens and pointer safety.
6. The runtime stores the adapter version, theme fingerprint and demo-mode state. A new page or
   stale runtime is reconciled by the next watcher cycle.
7. If post-injection verification fails, the watcher gives transient route structure a bounded
   stabilization window. A persistent failure restores the incomplete page, clears the active
   theme, stops automatic retries and records the error.

Run the sanitized check after an official desktop update:

```sh
npm run check:compatibility
```

The result includes only application version/build, adapter state and structural booleans. It does
not read or log task text, prompts, project names, usernames or local page paths.

## Supported application profiles

- Current `ChatGPT.app`, profile `chatgpt-current`.
- Legacy `Codex.app`, profile `codex-legacy`.

The resolver prefers a verified current ChatGPT build and can fall back to a verified legacy Codex
build. The optional `Theme Studio for Codex.app` launcher uses the same resolver and intentionally uses
generic ChatGPT/Codex copy. It does not remain resident after launching the verified official app.
The former `Codex Theme Studio.app` is removed only after the replacement launcher has been
compiled, branded, and ad-hoc signed successfully, and only when its private managed marker exists.
Theme data remains in the stable compatibility directory throughout the display-name migration.

## Expected safe failures

- `APP_IDENTITY_FAILED`: the Bundle ID, Team ID, Developer ID chain, executable path or running
  process validity no longer matches.
- `TARGET_IDENTITY_FAILED`: the current renderer is not a supported home/task page.
- `VERIFY_FAILED`: the page adapter contract changed after injection; the incomplete theme is
  restored and automatic retries stop until the user explicitly applies a compatible theme.
- `CDP_UNAVAILABLE`: the official app was not launched in loopback-only theme mode.

An upgrade never deletes user themes. If the official updater restarts the app without the local
theme-mode arguments, launch `Theme Studio for Codex.app` once or ask the Skill to enable theme mode
with explicit restart consent.
