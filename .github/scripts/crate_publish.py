"""Decide whether the root Rust crate needs publishing; fail closed on errors."""

import json
from pathlib import Path
import sys
import tomllib
from urllib.error import HTTPError
from urllib.request import urlopen


INDEX_URL = "https://index.crates.io/do/ub/doublets-web"


def needs_publish(version):
    try:
        with urlopen(INDEX_URL, timeout=30) as response:
            releases = [json.loads(line) for line in response if line.strip()]
    except HTTPError as error:
        if error.code == 404:
            raise RuntimeError(
                "doublets-web is absent from crates.io. An owner must bootstrap the "
                "crate and configure linksplatform/doublets-web / release.yml as "
                "its trusted publisher; see docs/issue-34/README.md."
            ) from error
        raise

    if not releases or any(release["name"] != "doublets-web" for release in releases):
        raise ValueError("Unexpected crates.io index response")
    for release in releases:
        if release["vers"] == version:
            if release["yanked"]:
                raise RuntimeError(f"doublets-web@{version} is yanked; choose a new version")
            print(f"doublets-web@{version} is already published; skipping upload.", file=sys.stderr)
            return False
    return True


def main():
    root = Path(__file__).resolve().parents[2]
    package = tomllib.loads((root / "Cargo.toml").read_text())["package"]
    if package["name"] != "doublets-web":
        raise ValueError("Only the root doublets-web Rust crate may be published")
    print(f"publish={str(needs_publish(package['version'])).lower()}")


if __name__ == "__main__":
    main()
