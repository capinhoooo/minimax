import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const agentApiUrl = env.VITE_AGENT_API_URL || 'http://localhost:3001'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Fix @mysten/dapp-kit <-> @mysten/sui version mismatch (LI.FI dep)
        '@mysten/sui/jsonRpc': path.resolve(__dirname, 'src/shims/sui-jsonrpc.ts'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: agentApiUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'INVALID_ANNOTATION') return;
          warn(warning);
        },
      },
    },
  }
})
