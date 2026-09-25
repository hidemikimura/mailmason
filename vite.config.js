import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const chunks = fileURLToPath(new URL('./src/editor/chunks.js', import.meta.url));
const chunksInline = fileURLToPath(new URL('./src/editor/chunks-inline.js', import.meta.url));

// 開発時は demo/ を開き、build では Lit を同梱したバンドルを dist/ に出力する。
// npm の ESM 版は src/ をそのまま配布するため、ここではビルドしない。
// - ESM 版（mailmason.bundle.js）: 後から読み込む部品（プレビュー・表の編集・QR・英語の文言）を dist/chunks/ に分ける
// - iife 版（mailmason.iife.js、`vite build --mode iife`）: <script> で読むため、すべて 1 ファイルに入れる
export default defineConfig(({ mode }) => {
  const iife = mode === 'iife';
  return {
    server: {
      open: '/demo/',
    },
    // iife 版は後から読み込む部品もはじめから入れる（動的 import の包みを出さない）
    plugins: iife
      ? [
          {
            name: 'mailmason-inline-chunks',
            enforce: 'pre',
            async resolveId(source, importer, options) {
              const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
              return resolved?.id === chunks ? chunksInline : null;
            },
          },
        ]
      : [],
    build: {
      outDir: 'dist',
      // ESM 版を先に作り、iife 版はその後に同じフォルダへ足す
      emptyOutDir: !iife,
      sourcemap: true,
      lib: {
        entry: 'src/index.js',
        name: 'Mailmason',
        formats: [iife ? 'iife' : 'es'],
        fileName: () => (iife ? 'mailmason.iife.js' : 'mailmason.bundle.js'),
      },
      rollupOptions: {
        // 後から読み込む部品が使う共通のコードを、別のファイルに分けずに本体に残す（本体が内部の関数も export してよい）
        preserveEntrySignatures: 'allow-extension',
        output: iife
          ? {}
          : {
              chunkFileNames: 'chunks/[name]-[hash].js',
              // ESM 版もブラウザで直接読むので空白まで圧縮する（ライブラリの ESM 出力は既定では空白を残す）
              minify: true,
            },
      },
    },
  };
});
