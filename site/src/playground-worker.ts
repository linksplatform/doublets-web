type WasmModule = {
  default: () => Promise<unknown>;
  Link: new (id: number, fromId: number, toId: number) => unknown;
  LinksConstants: new () => unknown;
  UnitedLinks: new (constants?: unknown) => unknown;
};

type Serializable =
  | null
  | string
  | number
  | boolean
  | Serializable[]
  | { [key: string]: Serializable };

type LinkRecord = {
  id: number;
  from_id: number;
  to_id: number;
};

type RunMessage = {
  type: "run";
  code: string;
};

type RuntimeApi = {
  metric(label: string, value: unknown): void;
  visualize(records: unknown): void;
};

const wasmModule = loadWasm();

addEventListener("message", (event: MessageEvent<RunMessage>) => {
  if (event.data.type !== "run") {
    return;
  }

  void run(event.data.code);
});

void wasmModule
  .then(() => {
    postMessage({ type: "ready" });
  })
  .catch((error: unknown) => {
    postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  });

async function loadWasm(): Promise<WasmModule> {
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const moduleUrl = new URL(`${baseUrl}pkg/doublets_web.js`, self.location.origin);
  const module = (await import(/* @vite-ignore */ moduleUrl.href)) as WasmModule;
  await module.default();
  return module;
}

async function run(code: string): Promise<void> {
  const started = performance.now();

  try {
    const wasm = await wasmModule;
    const runtimeConsole = createConsole();
    const api = createApi();
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const execute = new AsyncFunction(
      "Link",
      "LinksConstants",
      "UnitedLinks",
      "console",
      "api",
      "sleep",
      `"use strict";\n${code}`
    ) as (
      Link: WasmModule["Link"],
      LinksConstants: WasmModule["LinksConstants"],
      UnitedLinks: WasmModule["UnitedLinks"],
      console: Console,
      api: RuntimeApi,
      sleep: (milliseconds: number) => Promise<void>
    ) => Promise<unknown>;

    const result = await execute(
      wasm.Link,
      wasm.LinksConstants,
      wasm.UnitedLinks,
      runtimeConsole,
      api,
      sleep
    );

    postMessage({
      type: "result",
      durationMs: Math.round(performance.now() - started),
      value: serialize(result)
    });
  } catch (error: unknown) {
    postMessage({
      type: "error",
      durationMs: Math.round(performance.now() - started),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

function createApi(): RuntimeApi {
  return {
    metric(label: string, value: unknown) {
      postMessage({
        type: "metric",
        label,
        value: serialize(value)
      });
    },
    visualize(records: unknown) {
      postMessage({
        type: "visualize",
        records: normalizeLinks(records)
      });
    }
  };
}

function createConsole(): Console {
  const send = (level: string, args: unknown[]) => {
    postMessage({
      type: "console",
      level,
      values: args.map((value) => serialize(value))
    });
  };

  return {
    ...console,
    assert(condition?: boolean, ...args: unknown[]) {
      if (!condition) {
        send("error", args.length > 0 ? args : ["Assertion failed"]);
      }
    },
    clear() {
      postMessage({ type: "clear" });
    },
    debug(...args: unknown[]) {
      send("debug", args);
    },
    error(...args: unknown[]) {
      send("error", args);
    },
    info(...args: unknown[]) {
      send("info", args);
    },
    log(...args: unknown[]) {
      send("log", args);
    },
    table(data?: unknown) {
      const table = toTable(data);
      postMessage({
        type: "table",
        columns: table.columns,
        rows: table.rows
      });
    },
    warn(...args: unknown[]) {
      send("warn", args);
    }
  };
}

function normalizeLinks(value: unknown): LinkRecord[] {
  const rows = Array.isArray(value) ? value : [value];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const record = row as Record<string, unknown>;
      const id = toNumber(record.id);
      const fromId = toNumber(record.from_id ?? record.from ?? record.source);
      const toId = toNumber(record.to_id ?? record.to ?? record.target);
      if (id === null || fromId === null || toId === null) {
        return null;
      }
      return { id, from_id: fromId, to_id: toId };
    })
    .filter((row): row is LinkRecord => row !== null);
}

function toTable(value: unknown): { columns: string[]; rows: Record<string, Serializable>[] } {
  const rows = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const serializedRows = rows.map((row) => serialize(row));
  const objectRows = serializedRows.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return row as Record<string, Serializable>;
    }
    return { value: row };
  });
  const columns = Array.from(
    objectRows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>())
  );

  return {
    columns: columns.length > 0 ? columns : ["value"],
    rows: objectRows
  };
}

function serialize(value: unknown, seen = new WeakSet<object>()): Serializable {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null
    };
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item, seen));
  }

  const source = value as Record<string, unknown>;
  const entries = new Map<string, Serializable>();
  Object.keys(source).forEach((key) => {
    entries.set(key, serialize(source[key], seen));
  });

  for (const key of ["id", "from_id", "to_id"]) {
    if (!entries.has(key) && key in source) {
      entries.set(key, serialize(source[key], seen));
    }
  }

  return Object.fromEntries(entries);
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
