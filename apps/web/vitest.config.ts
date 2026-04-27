import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    server: {
      deps: {
        inline: ["@noble/ed25519"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
