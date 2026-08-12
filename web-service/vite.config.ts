import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dev server proxies /api to the Traefik gateway, so the browser always takslks to the same origin- identical to prod (Traefik routes /api)
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on the current 'mode' (development, production, etc.)
  // process.cwd() tells Vite to look for the file in the project root
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Set the local development server port (fallback to 5173 if not defined)
      port: parseInt(env.VITE_PORT || '5173'),

      // Configure the proxy for backend API calls
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    }
  }
});
