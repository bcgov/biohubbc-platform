import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0',
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      // Tiles are same origin in deployed environments, where an OpenShift route serves /tiles on the app's own
      // hostname. Proxying here gives local development the same relative URL, so the tile URL template the API
      // returns works unchanged in both.
      '/tiles': {
        target: process.env.VITE_TILE_PROXY_TARGET || 'http://localhost:6300',
        changeOrigin: true
      }
    }
  },
  plugins: [
    tsconfigPaths(),
    react(),
    mode !== 'test' &&
      checker({
        typescript: true,
        eslint: {
          useFlatConfig: true,
          lintCommand: 'eslint .'
        }
      })
  ].filter(Boolean),
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    transformIgnorePatterns: ['**/*.css']
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      // Exclude test files from the bundle
      external: ['**/*.test.ts', '**/*.test.tsx']
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  logLevel: 'info'
}));
