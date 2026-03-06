import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': target,
        '/health': target,
        '/ready': target,
      },
    },
  }
})
