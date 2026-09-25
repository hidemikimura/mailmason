// 後から読み込む部品の読み込み口。ESM 版・npm 版では別ファイルに分かれる。
// iife 版のビルドでは chunks-inline.js に差し替えて、すべて 1 ファイルに入れる（vite.config.js）
export const importQr = () => import('./qr.js');
export const importPreview = () => import('./components/mm-preview.js');
export const importTableEditor = () => import('./components/mm-table-editor.js');
export const importEnglish = () => import('./i18n-en.js');
