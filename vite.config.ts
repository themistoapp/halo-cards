import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "halo-cards.js" },
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    minify: true,
    copyPublicDir: false,
  },
  test: { environment: "happy-dom", include: ["tests/**/*.test.ts"] },
});
