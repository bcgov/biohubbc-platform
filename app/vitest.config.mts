import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  // Load environment variabless from the root directory, one level up
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '');

  // Prefix variables with VITE_
  const viteEnvVars = {
    'import.meta.env.VITE_NODE_OPTIONS': JSON.stringify(env.VITE_NODE_OPTIONS),
    'import.meta.env.VITE_CHANGE_VERSION': JSON.stringify(env.VITE_CHANGE_VERSION),
    'import.meta.env.VITE_NODE_ENV': JSON.stringify(env.VITE_NODE_ENV),
    'import.meta.env.VITE_PORT': JSON.stringify(env.VITE_PORT),
    'import.meta.env.VITE_API_HOST': JSON.stringify(env.VITE_API_HOST),
    'import.meta.env.VITE_API_PORT': JSON.stringify(env.VITE_API_PORT),
    'import.meta.env.VITE_MAX_UPLOAD_NUM_FILES': JSON.stringify(env.VITE_MAX_UPLOAD_NUM_FILES),
    'import.meta.env.VITE_MAX_UPLOAD_FILE_SIZE': JSON.stringify(env.VITE_MAX_UPLOAD_FILE_SIZE),
    'import.meta.env.VITE_SITEMINDER_LOGOUT_URL': JSON.stringify(env.VITE_SITEMINDER_LOGOUT_URL),
    'import.meta.env.VITE_KEYCLOAK_HOST': JSON.stringify(env.VITE_KEYCLOAK_HOST),
    'import.meta.env.VITE_KEYCLOAK_REALM': JSON.stringify(env.VITE_KEYCLOAK_REALM),
    'import.meta.env.VITE_KEYCLOAK_CLIENT_ID': JSON.stringify(env.VITE_KEYCLOAK_CLIENT_ID)
  };

  return {
    plugins: [tsconfigPaths()],
    define: {
      ...viteEnvVars
    },
    test: {
      globals: true,
      environment: 'jsdom',
      server: {
        // Fixes an error caused by Vite trying to load .css required for x-data-grid
        // See https://stackoverflow.com/questions/79592526/testing-error-after-upgrading-mui-x-data-grid-to-v8-1-0-unknown-file-extensio
        deps: {
          inline: ['@mui/x-data-grid']
        }
      },
      setupFiles: './setupTests.ts',
      reporters: ['verbose', ['vitest-sonar-reporter', { outputFile: 'coverage/sonar-report.xml' }]],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.d.ts', 'src/**/*.test.{ts,tsx}']
      },
      include: ['src/**/*.{test,spec}.{ts,tsx}']
    }
  };
});
