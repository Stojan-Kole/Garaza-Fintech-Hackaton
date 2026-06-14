import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/screen':   'http://localhost:8000',
      '/analyze':  'http://localhost:8000',
      '/health':   'http://localhost:8000',
      '/graph':    'http://localhost:8000',
      '/temporal': 'http://localhost:8000',
    },
  },
})
