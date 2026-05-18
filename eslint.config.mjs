import js from '@eslint/js';
import globals from 'globals';

const legacyOff = {
  'no-undef': 'off',
  'no-unused-vars': 'off',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'target/**',
      'uploads/**',
      'src/main/resources/trash/**',
      'src/main/resources/video service/**',
      'src/main/resources/static/css/**',
    ],
  },
  {
    files: [
      'src/main/resources/static/**/*.js',
      'src/main/resources/static/templates/template-1/js/**/*.js',
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...legacyOff,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },
  {
    files: [
      'playwright.config.js',
      'tests/**/*.js',
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  {
    files: [
      'src/main/resources/static/js/auth.js',
      'src/main/resources/static/js/video/**/*.js',
    ],
    languageOptions: {
      sourceType: 'module',
    },
  },
];
