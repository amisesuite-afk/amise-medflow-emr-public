import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure clinical-logic modules (no DOM; components only via react-dom/server). Kept separate from
// vite.config.ts so tests don't load the PWA / Tailwind / Replit plugins.
export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → "./src/*" path alias.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // tsconfig keeps JSX as "preserve" (the app build uses @vitejs/plugin-react); component tests
  // render .tsx to static markup, so compile JSX with the automatic runtime here.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
