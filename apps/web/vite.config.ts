import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  const { WEARLY_DEV_API_TARGET } = loadEnv(mode, process.cwd(), 'WEARLY_DEV_API_TARGET')
  return {
    plugins: [uni()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: { '/api': { target: WEARLY_DEV_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: false } },
    },
  }
})
