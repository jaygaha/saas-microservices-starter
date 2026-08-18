import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dev server proxies /api to the Traefik gateway, so the browser always talks to the same origin; identical to prod (where Traefik routes /api directly).
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on the current 'mode' (development, production, etc.)
  // process.cwd() tells Vite to look for the file in the project root
  const env = loadEnv(mode, process.cwd(), '');

  // Real env vars (Docker/compose) win over .env files, then fall back to defaults.
  const val = (k: string, d = '') => process.env[k] ?? env[k] ?? d

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true, // listen on 0.0.0.0 - required inside a container
      // Set the local development server port (fallback to 5173 if not defined)
      port: parseInt(val('VITE_PORT', '5173')),
      // macOS docker bind-mounts don't emit relaible FS events; poll when asked.
      watch: val('VITE_USE_POLLING') ? { usePolling: true } : undefined,
      // Configure the proxy for backend API calls
      proxy: {
        '/api': {
          target: val('VITE_PROXY_TARGET', 'http://localhost:8000'),
          changeOrigin: true,
        },
      },
    }
  }
});
