import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// core: Node で実行（DOM に依存しないことの保証も兼ねる）
// editor: 実ブラウザ（Chromium）で実行
// MM_CHROMIUM_PATH を指定すると、インストール済みの Chromium を使う（CI やサンドボックス向け）
const executablePath = process.env.MM_CHROMIUM_PATH || undefined;
// エディタのテストを動かすブラウザ。例: MM_BROWSERS=chromium,webkit,firefox npm run test:editor
// （webkit / firefox は先に `npx playwright install webkit firefox` が必要）
const browsers = (process.env.MM_BROWSERS || 'chromium').split(',').map((name) => name.trim());

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          include: ['test/core/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        // 初回実行時の依存の最適化でテストが再読み込みされないよう、先に指定しておく
        optimizeDeps: {
          include: [
            'lit',
            'lit/directives/repeat.js',
            'lit/directives/style-map.js',
            'lit/directives/unsafe-html.js',
            'lit/directives/unsafe-svg.js',
            'qrcode-generator',
            'jsqr',
          ],
        },
        test: {
          name: 'editor',
          include: ['test/editor/**/*.test.js'],
          browser: {
            enabled: true,
            headless: true,
            viewport: { width: 1280, height: 900 },
            // MM_CHROMIUM_PATH は Chromium だけで動かすときに使う
            provider: playwright({
              launchOptions: browsers.join() === 'chromium' ? { executablePath } : {},
            }),
            instances: browsers.map((browser) => ({
              browser: /** @type {'chromium' | 'webkit' | 'firefox'} */ (browser),
            })),
          },
        },
      },
    ],
  },
});
