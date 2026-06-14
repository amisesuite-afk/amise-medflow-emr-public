import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/amise-medflow-emr-public/',
  server: { host: '0.0.0.0' },
  build: { outDir: 'dist' },
})
