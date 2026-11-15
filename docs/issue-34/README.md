# Issue 34: crates.io trusted publishing

## Requirements and verification plan

Issue: https://github.com/linksplatform/doublets-web/issues/34
PR: https://github.com/linksplatform/doublets-web/pull/36

The issue has no comments or required sub-issues; PR conversation comments, inline
comments, and reviews were empty when implementation began (2026-11-15).

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Add crates.io OIDC publishing to release.yml | Independent `publish-crate` job, job-scoped `id-token: write`, pinned official auth action, temporary token only | Review workflow, credential-free packaging CI, offline preflight regression tests; actual OIDC requires a master run |
| First release is exactly 0.1.3 | Keep Cargo.toml/Cargo.lock version; skip existing versions | Registry index and version API already list 0.1.3 as the first version |
| 0.1.3 published by the release workflow | Cannot be achieved retroactively | Existing immutable release has `trustpub_data: null`; see evidence below |
| Later versions publish without CARGO_TOKEN | Read root version, fail closed on registry errors, publish absent versions with OIDC output | Mocked existing/new/yanked versions, 404 bootstrap, outage, malformed response, and CLI output tests; live publication remains unverified |
| Publisher lists repository and workflow | Required settings documented below; authenticate even if version already exists | Owner-authenticated crates.io access and a master workflow run still required |
| Preserve wasm demo and Pages deployment | Existing wasm/npm jobs and pages.yml build/deploy steps unchanged | Existing wasm-package CI still builds bundler and browser wasm, runs Node wasm tests, and builds site; Pages deployment requires master |
| Do not publish testapp/site npm packages | Rust publish explicitly selects doublets-web; npm still publishes from pkg | Review publish commands; cargo dry-run validates Rust crate |

## Setup and release operation

1. As a crate owner, open https://crates.io/crates/doublets-web/settings and add
   a GitHub trusted publisher:
   - Repository owner: `linksplatform`
   - Repository name: `doublets-web`
   - Workflow filename: `release.yml`
   - Environment: leave empty (the job does not use an environment).
2. Merge PR 36 through the normal review process. Publishing is restricted to
   pushes or manual dispatch on `master`; a PR cannot publish or request a registry
   token. No new version is required merely to add the workflow: the issue
   explicitly requests retaining the first version `0.1.3`.
3. The crates.io job waits for all three Rust verification platforms, wasm/npm/demo
   verification, and the Rust package dry run. It authenticates on every master
   release, including existing-version no-ops, so missing publisher configuration
   produces a failing master job. It does not depend on npm publication succeeding.
4. Future releases change both Cargo.toml and Cargo.lock through a PR. A registry
   lookup distinguishes published versions from new versions. Outages, invalid
   responses, a missing crate, and yanked versions fail rather than pretend to be
   successful releases. A failed run can be retried with workflow_dispatch on
   master. Only the new crates.io job also publishes on manual dispatch; existing
   npm release conditions are unchanged.
5. No `CARGO_TOKEN` or long-lived token secret is used. The official auth action
   exchanges GitHub OIDC for a temporary `CARGO_REGISTRY_TOKEN` and revokes it in
   its post step. Workflow cancellation is disabled and crates.io publishes are
   serialized to avoid cancelling an upload or racing dispatches.

Official setup: https://crates.io/docs/trusted-publishing
Action: https://github.com/rust-lang/crates-io-auth-action

## Evidence and external limits

On 2026-11-15, the registry index at
https://index.crates.io/do/ub/doublets-web contained exactly one release: `0.1.3`,
published at `2026-11-15T18:30:20Z`. The version API response is preserved in
[crates-io-0.1.3.json](crates-io-0.1.3.json): publisher `konard`,
`trustpub_data: null`. This publication predates PR 36, and crates.io versions
cannot be overwritten. The requirement that this exact first version be
published by this new release workflow is therefore blocked, even though the
version is already available. Do not bump the version to hide this discrepancy.

The registry's current official docs state that the crate must exist before
configuring trusted publishing (the initial publish requires an API token).
That bootstrap is already satisfied here. The trusted publisher configuration
API requires owner authentication: the unauthenticated request to
`/api/v1/trusted_publishing/github_configs?crate=doublets-web` returns HTTP 403.
This workspace has GitHub credentials, but no crates.io token/session or browser
session that can manage those settings. Thus publisher registration cannot be
confirmed or changed here. No credentials are copied between services.

An actual OIDC exchange and a publication from this workflow cannot be verified
on a PR branch. They require the configured publisher and a master workflow run;
this task works only on the PR branch and does not merge it. These acceptance
criteria remain unfinished. The PR must remain unmerged until they are resolved
or the immutable-publication discrepancy is explicitly addressed by the owner.

## Verification commands

```sh
python3 -m unittest discover -s tests -p 'test_crate_publish.py' -v
python3 .github/scripts/crate_publish.py
cargo publish --dry-run --locked --package doublets-web --registry crates-io
```

The Python tests use mocks and no network. The live preflight prints
`publish=false` for 0.1.3. CI runs the package dry run on every PR without
credentials, alongside existing Rust and wasm/demo checks.

Initial CI run 43769926212 failed all three Rust platforms because Rust 1.100
Clippy now flags `Clone::clone(self)` for the `Copy` LinksConstants type at
src/lib.rs:132. The preserved local log `ci-logs/release-43769926212.log` lines
580–589 shows the diagnostic and `*self` suggestion (Windows lines 1191–1200,
macOS lines 1804–1813). The one-line equivalent copy fixes the lint while keeping
the exported JavaScript clone method. Full initial logs remain downloadable at:
https://github.com/linksplatform/doublets-web/actions/runs/43769926212
