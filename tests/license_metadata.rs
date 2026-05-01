use std::{fs, path::Path};

const OLD_LICENSE_MARKERS: &[&str] = &[
    "MIT OR Apache-2.0",
    "LICENSE_MIT",
    "LICENSE_APACHE",
    "License, Version 2.0",
];

#[test]
fn public_license_metadata_uses_unlicense() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));

    let cargo_toml = read(root.join("Cargo.toml"));
    assert!(cargo_toml.contains("license = \"Unlicense\""));

    let readme = read(root.join("README.md"));
    assert!(readme.contains("license-Unlicense"));
    assert!(readme.contains("[The Unlicense](LICENSE)"));

    let testapp_package_json = read(root.join("testapp/package.json"));
    assert!(testapp_package_json.contains("\"license\": \"Unlicense\""));

    let testapp_package_lock = read(root.join("testapp/package-lock.json"));
    assert!(testapp_package_lock.contains("\"license\": \"Unlicense\""));

    assert_unlicense_text(root.join("LICENSE"));
    assert_unlicense_text(root.join("testapp/LICENSE"));

    for (name, contents) in [
        ("Cargo.toml", cargo_toml),
        ("README.md", readme),
        ("testapp/package.json", testapp_package_json),
        ("testapp/package-lock.json", testapp_package_lock),
    ] {
        for marker in OLD_LICENSE_MARKERS {
            assert!(
                !contents.contains(marker),
                "{name} still contains old license marker {marker:?}"
            );
        }
    }

    assert!(!root.join("LICENSE_MIT").exists());
    assert!(!root.join("LICENSE_APACHE").exists());
    assert!(!root.join("testapp/LICENSE-MIT").exists());
    assert!(!root.join("testapp/LICENSE-APACHE").exists());
}

fn assert_unlicense_text(path: impl AsRef<Path>) {
    let contents = read(path);
    assert!(contents.contains("released into the public domain"));
    assert!(contents.contains("https://unlicense.org/"));
}

fn read(path: impl AsRef<Path>) -> String {
    let path = path.as_ref();
    fs::read_to_string(path)
        .unwrap_or_else(|err| panic!("failed to read {}: {err}", path.display()))
}
