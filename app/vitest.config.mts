import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Global test configuration
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],
    // File handling
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{git,cache,output,temp}/**', '**/*.config.*'],
    // CSS and asset handling
    css: {
      modules: {
        classNameStrategy: 'stable'
      }
    },
    // Reporters and output
    reporters: [
      'default',
      [
        'vitest-sonar-reporter',
        {
          outputFile: 'coverage/sonar-report.xml'
        }
      ]
    ],
    // Coverage configuration
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
    // Performance and reliability
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true
      }
    },
    // Mock handling
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    // Watch mode configuration
    watch: false,
    // Retry flaky tests
    retry: process.env.CI ? 2 : 0,
    deps: {
      optimizer: {
        web: {
          include: ['@mui/**', 'lodash-es']
        }
      }
    }
  },
  // Vite-specific configuration for tests
  define: {
    __DEV__: true,
    'process.env.NODE_ENV': '"test"'
  },
  // Asset handling
  assetsInclude: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.webp'],
  // CSS processing
  css: {
    modules: {
      localsConvention: 'camelCaseOnly'
    }
  },
  // Resolve configuration
  resolve: {
    alias: {
      // Add any additional aliases if needed beyond tsconfig paths
    }
  }
});
