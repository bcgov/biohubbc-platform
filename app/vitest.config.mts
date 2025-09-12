import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],

    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{git,cache,output,temp}/**', '**/*.config.*'],

    // CSS Modules config
    css: {
      modules: {
        classNameStrategy: 'stable'
      }
    },

    reporters: [
      'default',
      [
        'vitest-sonar-reporter',
        {
          outputFile: 'coverage/sonar-report.xml'
        }
      ]
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{ts,tsx,js,jsx}',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/**/types/**',
        'src/**/constants/**',
        'src/**/*.stories.{ts,tsx,js,jsx}',
        'src/**/*.config.{ts,js}',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      all: true,
      clean: true
    },

    testTimeout: 10000,
    hookTimeout: 10000,

    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true
      }
    },

    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,

    watch: false,
    retry: process.env.CI ? 2 : 0,

    deps: {
      optimizer: {
        web: {
          include: ['@mui/**', 'lodash-es']
        }
      }
    }
  },

  define: {
    __DEV__: true,
    'process.env.NODE_ENV': '"test"'
  },

  assetsInclude: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.webp']
});
