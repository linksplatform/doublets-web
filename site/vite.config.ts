import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/doublets-web/" : "/",
  build: {
    assetsDir: "assets",
    chunkSizeWarningLimit: 8000,
    emptyOutDir: true,
    outDir: "dist",
    sourcemap: true
  },
  preview: {
    host: "0.0.0.0"
  },
  server: {
    host: "0.0.0.0"
  }
});
