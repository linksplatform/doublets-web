use std::{fs, path::Path};

#[test]
fn github_pages_demo_is_documented_and_buildable() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));

    let readme = read(root.join("README.md"));
    assert!(readme.contains("https://linksplatform.github.io/doublets-web/"));

    let pages_workflow = read(root.join(".github/workflows/pages.yml"));
    assert!(pages_workflow.contains("actions/deploy-pages"));
    assert!(pages_workflow.contains("wasm-pack build --release --target web"));
    assert!(pages_workflow.contains("--out-dir site/public/pkg"));
    assert!(pages_workflow.contains("npm run build --prefix site"));

    let package_json = read(root.join("site/package.json"));
    assert!(package_json.contains("\"monaco-editor\""));
    assert!(package_json.contains("\"vite\""));

    let index_html = read(root.join("site/index.html"));
    assert!(index_html.contains("doublets-web"));
    assert!(index_html.contains("id=\"app\""));

    let main = read(root.join("site/src/main.ts"));
    assert!(main.contains("monaco.editor.create"));
    assert!(main.contains("new Worker"));
    assert!(main.contains("renderConsole"));
    assert!(main.contains("renderGraph"));

    let worker = read(root.join("site/src/playground-worker.ts"));
    assert!(worker.contains("UnitedLinks"));
    assert!(worker.contains("LinksConstants"));
    assert!(worker.contains("postMessage"));
}

fn read(path: impl AsRef<Path>) -> String {
    let path = path.as_ref();
    fs::read_to_string(path)
        .unwrap_or_else(|err| panic!("failed to read {}: {err}", path.display()))
}
