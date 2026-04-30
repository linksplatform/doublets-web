# doublets-web

[![CI/CD Pipeline](https://github.com/linksplatform/doublets-web/actions/workflows/release.yml/badge.svg?branch=master)](https://github.com/linksplatform/doublets-web/actions/workflows/release.yml?query=branch%3Amaster)
[![npm package](https://img.shields.io/npm/v/doublets-web.svg)](https://www.npmjs.com/package/doublets-web)
[![GitHub Release](https://img.shields.io/github/v/release/linksplatform/doublets-web.svg)](https://github.com/linksplatform/doublets-web/releases)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue.svg)](https://github.com/linksplatform/doublets-web#license)

WebAssembly bindings for the LinksPlatform [doublets](https://github.com/linksplatform/doublets-rs) associative storage library.

## Installation

```sh
npm install doublets-web
```

## Usage

```js
import { Link, LinksConstants, UnitedLinks } from "doublets-web";

const constants = new LinksConstants();
const links = new UnitedLinks(constants);

const link = links.create();
links.update(link, link, link);

const any = links.constants.any;
const count = links.count(new Link(any, link, link));

console.log(`Stored links: ${count}`);
```

## Development

This package is built with stable Rust and `wasm-pack`.

```sh
rustup target add wasm32-unknown-unknown
cargo check --locked --tests --all-features
cargo clippy --locked --tests --all-features -- -D warnings
wasm-pack build --release --target bundler --out-dir pkg
wasm-pack test --node
```

## Publishing

The release workflow publishes the generated `pkg` package to npm from `.github/workflows/release.yml` using npm trusted publishing.

The npm package trusted publisher should be configured with:

- Organization/user: `linksplatform`
- Repository: `doublets-web`
- Workflow filename: `release.yml`

The workflow uses GitHub Actions OIDC (`id-token: write`) and `npm publish` from the generated package directory. npm trusted publishing automatically adds provenance for supported public packages.

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE_APACHE](LICENSE_APACHE))
- MIT license ([LICENSE_MIT](LICENSE_MIT))
