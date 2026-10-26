import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Under Bun the externalized zod namespace import resolves to undefined; inlining works on Node too.
    server: { deps: { inline: ["zod"] } },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
