import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0',
    port: Number(process.env.VITE_PORT) || 5173
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
    include: ['src/**/*.test.{ts,tsx}']
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      external: ['**/*.test.ts', '**/*.test.tsx']
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  logLevel: 'info'
}));
