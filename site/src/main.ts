import "./styles.css";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import {
  javascriptDefaults,
  ScriptTarget
} from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

type ConsoleLevel = "debug" | "error" | "info" | "log" | "result" | "status" | "warn";

type Serializable =
  | null
  | string
  | number
  | boolean
  | Serializable[]
  | { [key: string]: Serializable };

type ConsoleEntry =
  | {
      id: number;
      kind: "line";
      level: ConsoleLevel;
      values: Serializable[];
    }
  | {
      id: number;
      kind: "table";
      columns: string[];
      rows: Record<string, Serializable>[];
    };

type LinkRecord = {
  id: number;
  from_id: number;
  to_id: number;
};

type Metric = {
  label: string;
  value: Serializable;
};

type WorkerResponse =
  | { type: "ready" }
  | { type: "clear" }
  | { type: "console"; level: ConsoleLevel; values: Serializable[] }
  | { type: "table"; columns: string[]; rows: Record<string, Serializable>[] }
  | { type: "metric"; label: string; value: Serializable }
  | { type: "visualize"; records: LinkRecord[] }
  | { type: "result"; durationMs: number; value: Serializable }
  | { type: "error"; durationMs?: number; message: string; stack?: string };

const WORKER_TIMEOUT_MS = 5000;

const examples = {
  hero: `const links = new UnitedLinks(new LinksConstants());
const constants = links.constants;

const alpha = links.create();
const beta = links.create();
const gamma = links.create();

links.update(alpha, alpha, beta);
links.update(beta, beta, gamma);
links.update(gamma, gamma, alpha);

const rows = [];
links.each((link) => {
  rows.push({
    id: link.id,
    from_id: link.from_id,
    to_id: link.to_id
  });
  return constants._continue;
}, new Link(constants.any, constants.any, constants.any));

console.log("doublets-web ready");
console.table(rows);
api.metric("Stored links", links.count());
api.metric("First link", alpha);
api.visualize(rows);`,
  query: `const links = new UnitedLinks(new LinksConstants());
const constants = links.constants;

const root = links.create();
const childA = links.create();
const childB = links.create();
links.update(root, root, root);
links.update(childA, root, childA);
links.update(childB, root, childB);

const children = [];
links.each((link) => {
  children.push({
    id: link.id,
    from_id: link.from_id,
    to_id: link.to_id
  });
  return constants._continue;
}, new Link(constants.any, root, constants.any));

console.info("Links with source = root", root);
console.table(children);
api.metric("Children found", children.length);
api.visualize(children);`,
  delete: `const links = new UnitedLinks(new LinksConstants());
const constants = links.constants;

const first = links.create();
const second = links.create();
links.update(first, first, second);
links.update(second, second, first);

console.warn("Before delete", links.count());
links.delete(first);
console.warn("After delete", links.count());

const remaining = [];
links.each((link) => {
  remaining.push({
    id: link.id,
    from_id: link.from_id,
    to_id: link.to_id
  });
  return constants._continue;
}, new Link(constants.any, constants.any, constants.any));

console.table(remaining);
api.metric("Remaining links", remaining.length);
api.visualize(remaining);`
};

(self as unknown as { MonacoEnvironment: { getWorker(_: string, label: string): Worker } })
  .MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  }
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#playground" aria-label="doublets-web playground">
      <span class="brand-mark">dw</span>
      <span>
        <strong>doublets-web</strong>
        <small>WebAssembly associative storage</small>
      </span>
    </a>
    <nav class="topnav" aria-label="Documentation">
      <a href="#api">API</a>
      <a href="#patterns">Patterns</a>
      <a href="#deploy">Pages</a>
      <a href="https://github.com/linksplatform/doublets-web">GitHub</a>
    </nav>
  </header>

  <main>
    <section class="workspace" id="playground" aria-labelledby="playground-title">
      <div class="workspace-header">
        <div>
          <p class="eyebrow">Browser playground</p>
          <h1 id="playground-title">Run doublets-web in JavaScript</h1>
        </div>
        <div class="actions" aria-label="Playground actions">
          <button class="secondary" id="reset-button" type="button">Reset</button>
          <button class="secondary" id="clear-button" type="button">Clear</button>
          <button class="primary" id="run-button" type="button">Run</button>
        </div>
      </div>

      <div class="example-tabs" aria-label="Examples">
        <button class="tab is-active" data-example="hero" type="button">Round trip</button>
        <button class="tab" data-example="query" type="button">Query</button>
        <button class="tab" data-example="delete" type="button">Delete</button>
      </div>

      <div class="tool-grid">
        <section class="editor-pane" aria-label="JavaScript editor">
          <div id="editor" class="editor"></div>
        </section>
        <section class="output-pane" aria-label="Playground output">
          <div class="statusbar">
            <span id="runtime-status">Loading WebAssembly runtime</span>
            <span id="runtime-duration"></span>
          </div>
          <div class="metrics" id="metrics"></div>
          <div class="graph-shell">
            <div class="section-label">Links graph</div>
            <div class="graph" id="graph"></div>
          </div>
          <div class="console-shell">
            <div class="section-label">Console</div>
            <div class="console" id="console"></div>
          </div>
        </section>
      </div>
    </section>

    <section class="doc-band" id="api">
      <div class="doc-copy">
        <p class="eyebrow">API surface</p>
        <h2>Small primitives, direct WebAssembly calls</h2>
        <p>
          <code>LinksConstants</code> defines reserved values such as <code>any</code>,
          <code>_continue</code>, and <code>itself</code>. <code>UnitedLinks</code> owns
          the in-memory store. <code>Link</code> is the query and callback record shape:
          <code>{ id, from_id, to_id }</code>.
        </p>
      </div>
      <div class="reference-grid">
        <article>
          <h3>Create</h3>
          <code>const id = links.create();</code>
        </article>
        <article>
          <h3>Update</h3>
          <code>links.update(id, source, target);</code>
        </article>
        <article>
          <h3>Query</h3>
          <code>links.each(callback, new Link(any, source, any));</code>
        </article>
        <article>
          <h3>Count</h3>
          <code>links.count(new Link(any, any, any));</code>
        </article>
      </div>
    </section>

    <section class="doc-band" id="patterns">
      <div class="doc-copy">
        <p class="eyebrow">Modeling patterns</p>
        <h2>Every fact is a directed doublet</h2>
        <p>
          A link can point to values, other links, or itself. That lets JavaScript code build
          graph-shaped structures, indexes, and relation records while keeping one uniform storage
          operation set.
        </p>
      </div>
      <div class="pattern-list">
        <article>
          <h3>Identity</h3>
          <p>Use a created id as a stable address for a record, entity, or relation.</p>
        </article>
        <article>
          <h3>Search</h3>
          <p>Use <code>constants.any</code> in a <code>Link</code> query to match any id, source, or target part.</p>
        </article>
        <article>
          <h3>Traversal</h3>
          <p>Return <code>constants._continue</code> from <code>each</code> callbacks to stream every matching link.</p>
        </article>
      </div>
    </section>

    <section class="doc-band" id="deploy">
      <div class="doc-copy">
        <p class="eyebrow">GitHub Pages</p>
        <h2>Static docs, generated wasm package</h2>
        <p>
          The Pages workflow builds <code>doublets-web</code> with
          <code>wasm-pack --target web</code>, bundles the documentation app with Vite,
          and publishes the static artifact to GitHub Pages.
        </p>
      </div>
      <div class="deploy-steps">
        <code>wasm-pack build --release --target web --out-dir site/public/pkg --out-name doublets_web</code>
        <code>npm ci --prefix site</code>
        <code>npm run build --prefix site</code>
      </div>
    </section>
  </main>
`;

const editorElement = getElement<HTMLDivElement>("editor");
const consoleElement = getElement<HTMLDivElement>("console");
const graphElement = getElement<HTMLDivElement>("graph");
const metricsElement = getElement<HTMLDivElement>("metrics");
const statusElement = getElement<HTMLSpanElement>("runtime-status");
const durationElement = getElement<HTMLSpanElement>("runtime-duration");
const runButton = getElement<HTMLButtonElement>("run-button");
const resetButton = getElement<HTMLButtonElement>("reset-button");
const clearButton = getElement<HTMLButtonElement>("clear-button");
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-example]"));

const consoleEntries: ConsoleEntry[] = [];
let metrics: Metric[] = [];
let links: LinkRecord[] = [];
let entryId = 0;
let activeExample: keyof typeof examples = "hero";
let runner: Worker | null = null;
let timeoutId = 0;

monaco.editor.defineTheme("doublets-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "7dd3fc" },
    { token: "number", foreground: "f8d66d" },
    { token: "string", foreground: "a7f3d0" }
  ],
  colors: {
    "editor.background": "#151716",
    "editor.foreground": "#e7ece9",
    "editor.lineHighlightBackground": "#202522",
    "editorLineNumber.foreground": "#68736d",
    "editorCursor.foreground": "#f8d66d",
    "editor.selectionBackground": "#335846"
  }
});

javascriptDefaults.setCompilerOptions({
  allowJs: true,
  allowNonTsExtensions: true,
  checkJs: true,
  target: ScriptTarget.ESNext
});

javascriptDefaults.addExtraLib(
  `
declare class Link {
  constructor(id: number, from_id: number, to_id: number);
  id: number;
  from_id: number;
  to_id: number;
}
declare class LinksConstants {
  any: number;
  itself: number;
  _continue: number;
  _break: number;
  _null: number;
}
declare class UnitedLinks {
  constructor(constants?: LinksConstants);
  readonly constants: LinksConstants;
  create(): number;
  update(id: number, from_id: number, to_id: number): number;
  delete(id: number): number;
  count(query?: Link): number;
  each(callback: (link: Link) => number, query?: Link): number;
}
declare const api: {
  metric(label: string, value: unknown): void;
  visualize(records: Array<{ id: number; from_id: number; to_id: number }>): void;
};
declare function sleep(milliseconds: number): Promise<void>;
`,
  "file:///doublets-web-runtime.d.ts"
);

const editor = monaco.editor.create(editorElement, {
  automaticLayout: true,
  fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  fontSize: 14,
  language: "javascript",
  minimap: { enabled: false },
  padding: { bottom: 16, top: 16 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  tabSize: 2,
  theme: "doublets-dark",
  value: examples.hero,
  wordWrap: "on"
});

runButton.addEventListener("click", () => {
  runCode();
});

resetButton.addEventListener("click", () => {
  editor.setValue(examples[activeExample]);
  runCode();
});

clearButton.addEventListener("click", () => {
  clearOutput();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const exampleName = button.dataset.example as keyof typeof examples;
    activeExample = exampleName;
    tabButtons.forEach((tab) => tab.classList.toggle("is-active", tab === button));
    editor.setValue(examples[exampleName]);
    runCode();
  });
});

addEntry("status", ["Loading generated WebAssembly package from /pkg"]);
renderAll();
runCode();

function runCode(): void {
  clearOutput();
  terminateRunner();
  setStatus("Starting worker runtime");

  runner = new Worker(new URL("./playground-worker.ts", import.meta.url), { type: "module" });
  runner.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    handleWorkerMessage(event.data);
  });
  runner.addEventListener("error", (event) => {
    addEntry("error", [event.message]);
    setStatus("Runtime error");
    renderAll();
    terminateRunner();
  });

  timeoutId = window.setTimeout(() => {
    addEntry("error", [`Execution exceeded ${WORKER_TIMEOUT_MS} ms and was stopped.`]);
    setStatus("Stopped after timeout");
    renderAll();
    terminateRunner();
  }, WORKER_TIMEOUT_MS);

  runner.postMessage({
    type: "run",
    code: editor.getValue()
  });
}

function handleWorkerMessage(message: WorkerResponse): void {
  switch (message.type) {
    case "ready":
      setStatus("Runtime ready");
      break;
    case "clear":
      clearOutput();
      break;
    case "console":
      addEntry(message.level, message.values);
      break;
    case "table":
      consoleEntries.push({
        id: entryId++,
        kind: "table",
        columns: message.columns,
        rows: message.rows
      });
      break;
    case "metric":
      metrics = upsertMetric(metrics, { label: message.label, value: message.value });
      break;
    case "visualize":
      links = message.records;
      break;
    case "result":
      window.clearTimeout(timeoutId);
      setStatus("Completed");
      durationElement.textContent = `${message.durationMs} ms`;
      if (message.value !== null) {
        addEntry("result", [message.value]);
      }
      terminateRunner();
      break;
    case "error":
      window.clearTimeout(timeoutId);
      setStatus("Failed");
      durationElement.textContent = message.durationMs ? `${message.durationMs} ms` : "";
      addEntry("error", [message.stack ?? message.message]);
      terminateRunner();
      break;
  }

  renderAll();
}

function clearOutput(): void {
  consoleEntries.splice(0, consoleEntries.length);
  metrics = [];
  links = [];
  durationElement.textContent = "";
  renderAll();
}

function terminateRunner(): void {
  if (runner) {
    runner.terminate();
    runner = null;
  }
  window.clearTimeout(timeoutId);
}

function addEntry(level: ConsoleLevel, values: Serializable[]): void {
  consoleEntries.push({
    id: entryId++,
    kind: "line",
    level,
    values
  });
}

function setStatus(status: string): void {
  statusElement.textContent = status;
}

function renderAll(): void {
  renderConsole();
  renderGraph();
  renderMetrics();
}

function renderConsole(): void {
  if (consoleEntries.length === 0) {
    consoleElement.innerHTML = `<p class="empty">Console output appears here.</p>`;
    return;
  }

  consoleElement.innerHTML = consoleEntries
    .map((entry) => {
      if (entry.kind === "table") {
        return renderTable(entry);
      }
      const values = entry.values.map((value) => escapeHtml(formatValue(value))).join(" ");
      return `<div class="console-line ${entry.level}" data-entry="${entry.id}"><span>${entry.level}</span><pre>${values}</pre></div>`;
    })
    .join("");
  consoleElement.scrollTop = consoleElement.scrollHeight;
}

function renderTable(entry: Extract<ConsoleEntry, { kind: "table" }>): string {
  const head = entry.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = entry.rows
    .map((row) => {
      const cells = entry.columns
        .map((column) => `<td>${escapeHtml(formatValue(row[column] ?? null))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<div class="console-table" data-entry="${entry.id}"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderMetrics(): void {
  if (metrics.length === 0) {
    metricsElement.innerHTML = "";
    return;
  }

  metricsElement.innerHTML = metrics
    .map(
      (metric) => `
        <div class="metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(formatValue(metric.value))}</strong>
        </div>
      `
    )
    .join("");
}

function renderGraph(): void {
  if (links.length === 0) {
    graphElement.innerHTML = `<p class="empty">Run code with api.visualize(rows) to render links.</p>`;
    return;
  }

  const nodes = Array.from(
    links.reduce((set, link) => {
      set.add(link.id);
      set.add(link.from_id);
      set.add(link.to_id);
      return set;
    }, new Set<number>())
  ).sort((left, right) => left - right);
  const width = 520;
  const height = 280;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34;
  const positions = new Map(
    nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1) - Math.PI / 2;
      return [
        node,
        {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        }
      ];
    })
  );
  const edges = links
    .map((link) => {
      const from = positions.get(link.from_id);
      const to = positions.get(link.to_id);
      if (!from || !to) {
        return "";
      }
      if (link.from_id === link.to_id) {
        return `<path class="edge" d="M ${from.x - 2} ${from.y - 18} c 34 -38 72 2 36 36" marker-end="url(#arrow)" /><text class="edge-label" x="${from.x + 28}" y="${from.y - 26}">${link.id}</text>`;
      }
      return `<line class="edge" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" marker-end="url(#arrow)" /><text class="edge-label" x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 8}">${link.id}</text>`;
    })
    .join("");
  const nodeMarkup = nodes
    .map((node) => {
      const position = positions.get(node);
      if (!position) {
        return "";
      }
      return `<g class="node"><circle cx="${position.x}" cy="${position.y}" r="18" /><text x="${position.x}" y="${position.y + 5}">${node}</text></g>`;
    })
    .join("");

  graphElement.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Directed doublets graph">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      ${edges}
      ${nodeMarkup}
    </svg>
  `;
}

function upsertMetric(items: Metric[], metric: Metric): Metric[] {
  const next = items.filter((item) => item.label !== metric.label);
  next.push(metric);
  return next;
}

function formatValue(value: Serializable): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}
