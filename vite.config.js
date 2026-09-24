import { defineConfig } from 'vite';

// 開発時は demo/ を開き、build では Lit を同梱した単一バンドルを dist/ に出力する。
// npm の ESM 版は src/ をそのまま配布するため、ここではビルドしない。
export default defineConfig({
  server: {
    open: '/demo/',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/index.js',
      name: 'Mailmason',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'mailmason.bundle.js' : 'mailmason.iife.js'),
    },
  },
});
