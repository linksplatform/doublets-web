# Template Comparison

Compared sources:

- JS template: https://github.com/link-foundation/js-ai-driven-development-pipeline-template
- Rust template: https://github.com/link-foundation/rust-ai-driven-development-pipeline-template
- Current upstream Rust project: https://github.com/linksplatform/doublets-rs

Raw copied workflow evidence is stored in `evidence/`.

## Findings

| Area | JS template | Rust template | doublets-rs | doublets-web decision |
| --- | --- | --- | --- | --- |
| Package publishing | npm-focused release workflow and package scripts | crates.io-focused publishing | Rust crate release workflow | Use npm publishing from generated `pkg/`, not crates.io publishing |
| Trusted publishing | Good model for npm OIDC flow | Not applicable to npm | Not applicable to npm | Use GitHub OIDC and npm trusted publishing |
| Rust toolchain | Not applicable | Stable Rust CI model | Stable `doublets` crate available as `0.3.0` | Use `dtolnay/rust-toolchain@stable` and `doublets = "0.3.0"` |
| Tests | JS package tests and release checks | `cargo fmt`, tests, clippy, version checks | Rust package checks | Use `cargo fmt`, locked checks, native unit tests, clippy, wasm-pack build/test, npm pack dry run |
| Version/release automation | Changesets and scripted npm releases | Changelog fragments and scripted crate releases | Rust release automation | Keep a simpler direct workflow because this repo builds one wasm npm package |
| Link checks/docs | Includes docs/link checking workflow | Includes docs and CI/CD troubleshooting | Project README still has stale nightly wording | Update doublets-web README and report upstream stale README separately |

## Adopted

- Trusted npm publishing with `id-token: write`.
- Modern GitHub Actions major versions confirmed in `evidence/github-action-versions.txt`.
- Stable Rust setup with `wasm32-unknown-unknown`.
- Locked dependency checks through committed `Cargo.lock`.
- A generated GitHub release with an npm badge and package link.

## Not Adopted

- Changesets and multi-script release orchestration from the JS template. This project does not need that overhead for a single generated wasm package.
- crates.io publishing from the Rust template. `doublets-web` is an npm package, not a Rust crate intended for publication.
- Link-check and policy-heavy workflows from the templates. They can be added later, but they are not required to restore build, test, and package deployment.

## Resulting Workflow Shape

The final workflow has three jobs:

- `verify`: stable Rust formatting, locked checks, native unit tests, and clippy on Ubuntu, macOS, and Windows.
- `wasm-package`: Ubuntu wasm build, node wasm test, and npm dry-run inspection.
- `release`: push-to-`master` only npm trusted publishing and GitHub release update.
