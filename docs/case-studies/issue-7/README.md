# Issue 7 Case Study: Correct Project License to The Unlicense

Date: 2026-05-01

Issue: https://github.com/linksplatform/doublets-web/issues/7
Pull request: https://github.com/linksplatform/doublets-web/pull/8

## Goal

Correct every repository-owned license surface from the previous MIT OR Apache-2.0 metadata to The Unlicense, preserve the supporting evidence under `docs/case-studies/issue-7`, and add a regression check that keeps the public metadata aligned.

## Evidence Collected

- Issue 7 metadata and comments are saved under `evidence/issue-7.json` and `evidence/issue-7-comments.json`.
- Pull request 8 metadata, comments, reviews, and review comments are saved under `evidence/pr-8*.json`.
- The SPDX record for `Unlicense` is saved in `evidence/spdx-unlicense.json`.
- The canonical Unlicense text is saved in `evidence/UNLICENSE.txt`.
- npm package metadata guidance was saved in `evidence/npm-package-json.html`.

## Timeline

- 2021-12-09: `linksplatform/doublets-web` was created. GitHub API metadata reported the repository license as Apache-2.0 before this fix.
- 2026-05-01 05:28 UTC: PR 6 merged the CI/CD revival and left the crate metadata, README badge, README license section, and test app metadata on MIT OR Apache-2.0.
- 2026-05-01 09:01 UTC: Issue 7 was opened requesting that the license be corrected to Unlicense/Public Domain in all places.
- 2026-05-01 09:01 UTC: Draft PR 8 was created for the issue.
- 2026-05-01: This investigation found no issue comments, PR comments, reviews, or review comments requiring additional constraints.

## Requirements

- Change the main crate metadata to the SPDX identifier `Unlicense`.
- Replace root MIT/Apache license files with the Unlicense text.
- Update README badge and license section.
- Update the `testapp` metadata and license files because they are tracked repository content.
- Preserve raw issue/PR/evidence data under `docs/case-studies/issue-7`.
- Include a repeatable check that fails when old license markers come back.
- Bump the package version so the release workflow has a new npm package version to publish.

## Root Cause

The repository still contained the dual-license setup from earlier project scaffolding and CI modernization work:

- `Cargo.toml` declared `license = "MIT OR Apache-2.0"`.
- `README.md` advertised an MIT/Apache badge and linked `LICENSE_MIT` and `LICENSE_APACHE`.
- Root and `testapp` license files contained MIT and Apache-2.0 texts.
- `testapp/package.json` and `testapp/package-lock.json` declared `(MIT OR Apache-2.0)`.

Because these surfaces are maintained independently, changing only one file would leave package metadata, GitHub license detection, or documentation inconsistent.

## External Facts

SPDX lists the short license identifier as `Unlicense`, with the full name "The Unlicense"; its metadata marks the license as OSI approved and FSF libre. npm package metadata uses SPDX license expressions in the `license` field, so `Unlicense` is the appropriate package string.

## Implemented

- Added root `LICENSE` with the canonical Unlicense text.
- Added `testapp/LICENSE` with the same text.
- Removed root `LICENSE_MIT` and `LICENSE_APACHE`.
- Removed `testapp/LICENSE-MIT` and `testapp/LICENSE-APACHE`.
- Updated `Cargo.toml` to `license = "Unlicense"` and version `0.1.2`.
- Updated `Cargo.lock` for the new crate version.
- Updated README license badge and license section.
- Updated `testapp/package.json` and `testapp/package-lock.json` to `Unlicense`.
- Added `tests/license_metadata.rs` to assert the expected license metadata and absence of old license markers.
- Removed the auto-generated `.gitkeep` placeholder from the draft PR.

## Solution Plan for Similar Repositories

- Treat license changes as release metadata changes, not only documentation edits.
- Use the SPDX identifier in package manager metadata.
- Keep one canonical license file at the package root whenever possible.
- Add a lightweight test or lint that scans maintained metadata files for expected license values.
- Verify generated package output with `wasm-pack build` and `npm pack --dry-run` so published artifacts include the corrected license.

## Verification

Local verification completed successfully:

- `cargo fmt --all -- --check`
- `cargo check --locked --tests --all-features`
- `cargo test --locked --lib --target "$(rustc -vV | sed -n 's/^host: //p')"`
- `cargo test --locked --test license_metadata`
- `cargo clippy --locked --tests --all-features -- -D warnings`
- `wasm-pack build --release --target bundler --out-dir pkg`
- `wasm-pack test --node`
- `npm pack --dry-run` from `pkg/`

The generated npm package metadata was confirmed as `doublets-web@0.1.2` with `license: Unlicense`, and the dry-run tarball includes a single `LICENSE` file. Logs are saved under `logs/`.
