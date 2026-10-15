import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { reportPlugin } from './vite-report.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), reportPlugin()],
  server: {
    port: 15173,
    strictPort: true,
  },
})
