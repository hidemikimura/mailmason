// ドキュメントサイト（VitePress）。GitHub Pages の https://hidemikimura.github.io/mailmason/ で公開する
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const src = (path) => fileURLToPath(new URL(`../../src/${path}`, import.meta.url));
const repo = 'https://github.com/hidemikimura/mailmason';

export default defineConfig({
  lang: 'ja',
  title: 'Mailmason',
  description:
    'Lit ベースのノーコード HTML メールエディタ。Outlook でも崩れにくい HTML とマルチパート用テキストを出力します。',
  base: '/mailmason/',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/mailmason/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#2f6fed' }],
  ],
  markdown: {
    config(md) {
      // 本文の `{{name}}` を Vue の埋め込みとして解釈させない
      const inline = md.renderer.rules.code_inline;
      md.renderer.rules.code_inline = (...args) =>
        /** @type {any} */ (inline)(...args).replace(/^<code/, '<code v-pre');
    },
  },
  vue: {
    template: {
      compilerOptions: { isCustomElement: (tag) => tag === 'mailmason-editor' },
    },
  },
  vite: {
    resolve: {
      // デモはリポジトリのソースをそのまま使う
      alias: [
        { find: /^@hidemikimura\/mailmason\/core$/, replacement: src('core/index.js') },
        { find: /^@hidemikimura\/mailmason$/, replacement: src('index.js') },
      ],
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'ガイド', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'リファレンス', link: '/reference/editor', activeMatch: '/reference/' },
      { text: 'デモ', link: '/demo' },
      { text: 'AI 向け', link: '/ai' },
      {
        text: 'v0.6',
        items: [
          { text: '変更履歴', link: '/changelog' },
          { text: 'npm', link: 'https://www.npmjs.com/package/@hidemikimura/mailmason' },
        ],
      },
    ],
    sidebar: {
      '/': [
        {
          text: 'はじめに',
          items: [
            { text: 'Mailmason とは', link: '/guide/what-is-mailmason' },
            { text: 'はじめる', link: '/guide/getting-started' },
            { text: 'フレームワークで使う', link: '/guide/frameworks' },
          ],
        },
        {
          text: 'ガイド',
          items: [
            { text: 'エディタの操作', link: '/guide/editing' },
            { text: 'ブロック', link: '/guide/blocks' },
            { text: '画像', link: '/guide/images' },
            { text: '背景画像', link: '/guide/backgrounds' },
            { text: 'スマホでの表示', link: '/guide/mobile' },
            { text: 'フォント', link: '/guide/fonts' },
            { text: 'コンポーネント', link: '/guide/components' },
            { text: 'カスタムブロック', link: '/guide/custom-blocks' },
            { text: '差し込み変数', link: '/guide/merge-tags' },
            { text: 'プレビューとテキストパート', link: '/guide/preview-and-text' },
            { text: '書き出しと配信', link: '/guide/export' },
            { text: '見た目と言語', link: '/guide/customization' },
            { text: 'メールソフトでの確認', link: '/client-checklist' },
          ],
        },
        {
          text: 'リファレンス',
          items: [
            { text: 'エディタ API', link: '/reference/editor' },
            { text: 'テンプレート JSON', link: '/reference/template' },
          ],
        },
        {
          text: 'その他',
          items: [
            { text: 'デモ', link: '/demo' },
            { text: 'AI 向け（skills / llms.txt）', link: '/ai' },
            { text: '変更履歴', link: '/changelog' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'このページを GitHub で編集' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '検索', buttonAriaLabel: '検索' },
          modal: {
            displayDetails: '詳しく表示',
            resetButtonTitle: 'リセット',
            backButtonTitle: '戻る',
            noResultsText: '見つかりませんでした',
            footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' },
          },
        },
      },
    },
    outline: { label: 'このページの内容', level: [2, 3] },
    docFooter: { prev: '前へ', next: '次へ' },
    darkModeSwitchLabel: '外観',
    lightModeSwitchTitle: 'ライトモードにする',
    darkModeSwitchTitle: 'ダークモードにする',
    sidebarMenuLabel: 'メニュー',
    returnToTopLabel: 'ページの先頭へ',
    footer: {
      message: 'MIT License',
      copyright: 'Copyright © 2026 Hidemi Kimura',
    },
  },
});
