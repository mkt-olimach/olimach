import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    testTimeout: 30000,
  },
});
