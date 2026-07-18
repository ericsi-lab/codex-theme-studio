# Contributing

Thank you for helping improve Theme Studio for Codex.

## Principles

- Keep the implementation independent and clean-room. Do not submit copied code, images, interface layouts, documentation, or repository structures.
- Prefer small, readable modules and platform APIs over heavy dependencies.
- Preserve the safety checks and automatic restore path.
- Never include private Codex content in fixtures, screenshots, recordings, or bug reports.

## Development workflow

1. Create `codex/<topic>` from `develop`; do not commit feature work directly to `main`.
2. Open a pull request into `develop` and describe the user-facing reason for the change.
3. Run `npm test` and `npm run validate:themes`.
4. Exercise `doctor`, `preview`, `verify`, and `restore` against a disposable Codex task.
5. If the Plugin changes, run the official plugin validator, reinstall with the cachebuster flow, and test the Skill in a new task.
6. Update `CHANGELOG.md` for user-visible changes.

Release preparation is merged from `develop` into `main`. See
[Branching and repository rules](docs/BRANCHING.md) for the complete protection model.

New bundled artwork must be original, have source information in its theme `LICENSE.txt`, and pass both light/dark readability checks.
