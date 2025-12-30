import eslintJs from '@eslint/js';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'src/**/*.d.ts',
      'coverage/**/*',
      'build/**/*',
      'dist/**/*',
      '.pipeline/**/*',
      '.docker/**/*',
      'node_modules/**/*'
    ]
  },
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.tsx'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
      prettier: eslintPluginPrettier,
      'react-hooks': eslintPluginReactHooks
    },
    rules: {
      ...eslintJs.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...eslintPluginReactHooks.configs.recommended.rules,
      'prettier/prettier': 'warn',
      indent: 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': false,
          'ts-ignore': false,
          'ts-nocheck': false,
          'ts-check': false
        }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-redeclare': 'error',
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-var': 'error',
      'no-lonely-if': 'error',
      curly: 'error'
    }
  },
  {
    files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  }
];