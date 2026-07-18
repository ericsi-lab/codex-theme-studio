# Branching and repository rules

Theme Studio for Codex separates stable releases from active development.

## Branches

- `main`: stable, publicly installable source. Release tags are created only from this branch.
- `develop`: integration branch for the next version.
- `codex/<topic>`: short-lived implementation branches created from `develop`.

Changes normally flow as follows:

```text
codex/<topic> -> develop -> main -> vX.Y.Z
```

Urgent release fixes branch from `main` as `codex/hotfix-<topic>`, merge into `main`, and are then
merged back into `develop`.

## GitHub rulesets

Apply these rules after the repository is created:

### `main`

- Require a pull request before merging.
- Require the `test` status check from `.github/workflows/ci.yml`.
- Require branches to be up to date and use linear history.
- Block force pushes and branch deletion.
- Do not require an approving review while the repository has only one maintainer; otherwise the
  maintainer cannot merge their own release PR. Enable one required approval after adding a second
  trusted maintainer.

### `develop`

- Require a pull request from `codex/*` branches.
- Require the `test` status check and linear history.
- Block force pushes and branch deletion.
- Allow the maintainer to merge after CI passes without an external approval.

### Release tags

- Protect tags matching `v*` from deletion or force updates.
- Create tags only from commits already merged into `main`.
