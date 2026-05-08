declare module "monaco-editor/esm/vs/language/typescript/monaco.contribution.js" {
  export const ScriptTarget: {
    ESNext: number;
    Latest: number;
  };

  export const javascriptDefaults: {
    addExtraLib(content: string, filePath?: string): { dispose(): void };
    setCompilerOptions(options: Record<string, unknown>): void;
  };
}
