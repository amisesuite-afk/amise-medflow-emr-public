import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure clinical-logic modules (no DOM, no React rendering). Kept separate from
// vite.config.ts so tests don't load the PWA / Tailwind / Replit plugins.
export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → "./src/*" path alias.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
