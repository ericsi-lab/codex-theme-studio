# Security Policy

## Supported versions

Security fixes are provided for the latest published release.

## Trust boundaries

Theme Studio for Codex:

- connects only to a CDP endpoint bound to `127.0.0.1` or `::1`;
- checks the Codex bundle identifier, OpenAI Team ID, Apple Developer ID requirement, running
  process, target URL, and expected page markers before injecting a theme;
- requires macOS dynamic validity and the OpenAI Developer ID authority chain for the live PID
  before connecting to CDP; static deep resource-envelope verification remains diagnostic because
  it can report transient false negatives during an official desktop update;
- recognizes the official Codex-to-ChatGPT migration and caches only stable bundle identity for
  the matching version, build, CDHash, executable metadata, and CodeResources metadata;
- never modifies `ChatGPT.app`, legacy `Codex.app`, `app.asar`, code signatures, model settings, API keys, or credentials;
- rejects theme path traversal, symbolic links, unsupported image formats, files over 16 MiB,
  images over 8,192 pixels per side, and images over 12 megapixels;
- removes the preview automatically after timeout or failed verification.

The runtime deliberately refuses remote CDP endpoints and generic browser pages. Do not weaken these checks in a contribution.

## Reporting a vulnerability

Please use GitHub's private security advisory feature. Do not include private task content, credentials, or full local paths in a public issue. We aim to acknowledge valid reports within seven days.
