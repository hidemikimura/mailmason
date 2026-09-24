import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'dist/',
      'types/',
      'coverage/',
      'node_modules/',
      'docs/.vitepress/cache/',
      'docs/.vitepress/dist/',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // ブラウザで動くコード
  {
    files: ['src/index.js', 'src/editor/**/*.js', 'demo/**/*.js', 'test/editor/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  // ドキュメントサイト（設定は Node、テーマはブラウザ）
  {
    files: ['docs/.vitepress/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  // Node で動くコード
  {
    files: ['*.config.js', 'test/core/**/*.js', 'scripts/**/*.js', 'skills/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  // core は DOM・Lit・editor に依存しない（Node でもそのまま動かすため）
  {
    files: ['src/core/**/*.js'],
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['lit', 'lit/*', '@lit/*'],
              message: 'src/core は Lit に依存してはいけません。',
            },
            {
              group: ['**/editor/**'],
              message: 'src/core から editor を import してはいけません。',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core では DOM を使えません。' },
        { name: 'document', message: 'src/core では DOM を使えません。' },
        { name: 'navigator', message: 'src/core では DOM を使えません。' },
        { name: 'customElements', message: 'src/core では DOM を使えません。' },
        { name: 'HTMLElement', message: 'src/core では DOM を使えません。' },
        { name: 'DOMParser', message: 'src/core では DOM を使えません。' },
      ],
    },
  },
  prettier,
];
