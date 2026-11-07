import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // Generated from the contract (CODE_QUALITY.md §3).
        "src/api/generated/**",
        // Async server components and their config run only in Next.js: covered by Playwright (e2e/).
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/i18n/request.ts",
      ],
      // CODE_QUALITY.md §3: 60 % for the code of a component.
      thresholds: { lines: 60, branches: 60, functions: 60, statements: 60 },
    },
  },
});
