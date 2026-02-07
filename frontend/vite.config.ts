import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fix @mysten/dapp-kit <-> @mysten/sui version mismatch (LI.FI dep)
      '@mysten/sui/jsonRpc': path.resolve(__dirname, 'src/shims/sui-jsonrpc.ts'),
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
})
