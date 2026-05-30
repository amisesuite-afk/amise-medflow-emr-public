import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f172a',
        panel: '#1e293b',
        border: '#374151',
        teal: { DEFAULT: '#0d9488', light: '#5eead4' },
      },
    },
  },
  plugins: [],
};
export default config;
