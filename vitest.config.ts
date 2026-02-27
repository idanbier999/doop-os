import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [
      ["src/app/api/**/*.test.ts", "node"],
      ["src/lib/**/*.test.ts", "node"],
      ["src/middleware.test.ts", "node"],
      ["src/app/dashboard/**/*.test.ts", "node"],
    ],
  },
});
