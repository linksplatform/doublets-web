# Issue 5 Case Study: CI/CD and npm Publishing Revival

Date: 2026-04-30

Issue: https://github.com/linksplatform/doublets-web/issues/5
Pull request: https://github.com/linksplatform/doublets-web/pull/6

## Goal

Revive `doublets-web` CI/CD so the package builds on stable Rust, verifies the wasm npm package, publishes `doublets-web` automatically to npm with trusted publishing, and documents the package/release status.

## Evidence Collected

- Issue, PR, comment, review, and pre-push CI metadata are saved under `evidence/`.
- The branch had no recent CI runs before this work: `evidence/ci-runs-before-push.json`.
- The previous local failure is saved in `logs/cargo-check-before.log`.
- Successful local verification logs are saved in `logs/`.
- npm package metadata is saved in `evidence/npm-doublets-web.json`; the latest npm dist-tag was `0.1.0-beta.3` before this PR.
- Upstream `doublets-rs` release metadata is saved in `evidence/doublets-rs-v0.3.0-release.json`; the stable release used here is `v0.3.0`.

## Root Cause

The package still depended on the old `https://github.com/linksplatform/Data.Doublets` Git repository, which no longer resolves as a usable Cargo package. `cargo check` failed before any CI modernization could run.

The project also used obsolete CI providers (`.travis.yml` and `.appveyor.yml`) and nightly-only Rust setup. Current `doublets` is published as the stable crate `doublets = "0.3.0"`, but its API differs from the old dependency, so the wasm wrapper needed a small migration.

During migration, `doublets` 0.3.0 also exposed a wrapper compatibility point: the upstream `delete` helper reports the post-delete null link index, while `doublets-web` should keep returning the deleted id to JavaScript callers. The new tests cover that behavior.

## Implemented

- Replaced legacy Travis/AppVeyor configuration with `.github/workflows/release.yml`.
- Added stable Rust CI on Ubuntu, macOS, and Windows.
- Added wasm package build, `wasm-pack test --node`, and `npm pack --dry-run`.
- Added release-only npm publishing with GitHub OIDC trusted publishing (`id-token: write`) and npm 11.
- Added GitHub release creation/update with npm badge and package link.
- Updated `Cargo.toml` to `doublets = "0.3.0"`, stable Rust metadata, and version `0.1.1`.
- Committed `Cargo.lock` so CI can use `--locked`.
- Updated README badges, install/use instructions, and trusted publisher setup notes.
- Added regression tests for create/update/count/delete round trips.

## Trusted Publishing Notes

npm trusted publishing requires configuring the package settings on npmjs.com with:

- Organization/user: `linksplatform`
- Repository: `doublets-web`
- Workflow filename: `release.yml`

The workflow publishes from `pkg/` after `wasm-pack build --release --target bundler --out-dir pkg`. It skips `npm publish` if the exact version already exists.

Primary references:

- npm trusted publishing docs: https://docs.npmjs.com/trusted-publishers/
- GitHub OIDC docs: https://docs.github.com/en/actions/concepts/security/openid-connect
- npm package: https://www.npmjs.com/package/doublets-web
- upstream release: https://github.com/linksplatform/doublets-rs/releases/tag/v0.3.0

## Related Upstream Report

While confirming stable `doublets-rs`, I found that its README still mentions nightly Rust and old pre-release install guidance. I reported that separately:

https://github.com/linksplatform/doublets-rs/issues/55

## Verification

Local verification completed successfully:

- `cargo fmt --all`
- `cargo check --locked --tests --all-features`
- `cargo clippy --locked --tests --all-features -- -D warnings`
- `cargo test --locked --lib --target "$(rustc -vV | sed -n 's/^host: //p')"`
- `wasm-pack build --release --target bundler --out-dir pkg`
- `wasm-pack test --node`
- `npm pack --dry-run` from `pkg/`

The generated package dry-run produced `doublets-web-0.1.1.tgz`; see `logs/npm-pack-dry-run.log`.
