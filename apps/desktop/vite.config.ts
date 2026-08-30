import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
  },
  // Strip console.* and debugger from production builds only.
  // Dev keeps them for local debugging.
  esbuild: {
    drop: command === 'build' ? ['console', 'debugger'] : [],
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'https://phantom-api-production-e27f.up.railway.app',
        changeOrigin: true,
        secure: true,
        ws: true,  // WebSocket endpoint is /api/v1/ws — needs upgrade support here
      },
    },
  },
}))
