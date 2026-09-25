// AI 向けの llms.txt と llms-full.txt を docs/public に書き出す（ドキュメントのビルド前に実行）。
// llms.txt は各ページへの案内、llms-full.txt はガイド・リファレンス・スキルの本文をまとめたもの
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://hidemikimura.github.io/mailmason';
const REPO = 'https://github.com/hidemikimura/mailmason';

/** @type {{ title: string, path: string, source: string, summary: string, section: string }[]} */
const PAGES = [
  {
    section: 'ガイド',
    title: 'Mailmason とは',
    path: '/guide/what-is-mailmason',
    source: 'docs/guide/what-is-mailmason.md',
    summary: 'できること、考え方（テンプレート JSON が唯一の正）、対象外のもの',
  },
  {
    section: 'ガイド',
    title: 'はじめる',
    path: '/guide/getting-started',
    source: 'docs/guide/getting-started.md',
    summary: 'インストール、最小構成、保存と読み込み、書き出し',
  },
  {
    section: 'ガイド',
    title: 'フレームワークで使う',
    path: '/guide/frameworks',
    source: 'skills/mailmason-integration/references/frameworks.md',
    summary: 'React・Vue・Svelte・script タグ、Node での書き出しと送信',
  },
  {
    section: 'ガイド',
    title: 'エディタの操作',
    path: '/guide/editing',
    source: 'docs/guide/editing.md',
    summary: '画面の構成、追加・移動・テキストと表の編集、キーボード',
  },
  {
    section: 'ガイド',
    title: 'ブロック',
    path: '/guide/blocks',
    source: 'docs/guide/blocks.md',
    summary: '14 種類のブロックの用途と、表・動画・ギャラリーなどのメールソフトでの表示',
  },
  {
    section: 'ガイド',
    title: '画像',
    path: '/guide/images',
    source: 'docs/guide/images.md',
    summary: 'onImageUpload / onImageSelect、受け付ける形式、SNS アイコン',
  },
  {
    section: 'ガイド',
    title: '背景画像',
    path: '/guide/backgrounds',
    source: 'docs/guide/backgrounds.md',
    summary: 'メール全体・本文・行・カラムの背景画像、Outlook（VML）での表示と制限',
  },
  {
    section: 'ガイド',
    title: '差し込み変数',
    path: '/guide/merge-tags',
    source: 'docs/guide/merge-tags.md',
    summary: 'mergeTags（sample / fallback）、書き出し時の差し込み、区切りの変更',
  },
  {
    section: 'ガイド',
    title: 'プレビューとテキストパート',
    path: '/guide/preview-and-text',
    source: 'docs/guide/preview-and-text.md',
    summary: 'PC / スマホのプレビュー、テキストパートの生成規則と手直し',
  },
  {
    section: 'ガイド',
    title: '書き出しと配信',
    path: '/guide/export',
    source: 'docs/guide/export.md',
    summary: 'minify、サーバーでの書き出し、multipart で送るときの注意',
  },
  {
    section: 'ガイド',
    title: '見た目と言語',
    path: '/guide/customization',
    source: 'docs/guide/customization.md',
    summary: 'theme、CSS カスタムプロパティ、::part、slot、locale / messages',
  },
  {
    section: 'リファレンス',
    title: 'エディタ API',
    path: '/reference/editor',
    source: 'skills/mailmason-integration/references/api.md',
    summary: 'プロパティ・メソッド・イベント・警告コード・core の関数',
  },
  {
    section: 'リファレンス',
    title: 'テンプレート JSON',
    path: '/reference/template',
    source: 'docs/reference/template.md',
    summary: '全項目の型・既定値・範囲（スキーマから自動生成）',
  },
];

const SKILLS = [
  {
    title: 'mailmason-integration',
    source: 'skills/mailmason-integration/SKILL.md',
    summary: 'エディタをアプリに組み込むときの手順と注意',
  },
  {
    title: 'mailmason-templates',
    source: 'skills/mailmason-templates/SKILL.md',
    summary: 'テンプレート JSON を作る・直す・検査するときの手順',
  },
];

/** @param {string} path */
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

/**
 * サイト用の記法（Vue のコンポーネント、frontmatter、コメント）を取り除く
 * @param {string} markdown
 */
function plain(markdown) {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<!--[\s\S]*?-->\n?/g, '')
    .replace(/^<\/?ClientOnly>\n/gm, '')
    .replace(/^\s*<MailmasonDemo[^>]*\/>\n/gm, '')
    .replace(/\]\(\/(?!\/)/g, `](${SITE}/`)
    .replace(/\]\(\.\/([\w-]+)\)/g, `](${SITE}/guide/$1)`)
    .trim();
}

const index = `# Mailmason

> Lit 製のノーコード HTML メールエディタ（Web Components の \`<mailmason-editor>\`）。行 × カラムのドラッグ&ドロップでメールを作り、Outlook でも崩れにくいテーブル＋インライン CSS の HTML と、マルチパート配信用のテキストパートを書き出す。npm パッケージは \`@hidemikimura/mailmason\`、DOM に依存しない書き出し用の関数は \`@hidemikimura/mailmason/core\`。

保存する形式はテンプレート JSON だけで、HTML とテキストはそこから作る。画像は保存しないので、アップロードはアプリが \`onImageUpload\` で受け取って公開 URL を返す。本文をまとめたものは ${SITE}/llms-full.txt にある。

${['ガイド', 'リファレンス']
  .map(
    (section) =>
      `## ${section}\n\n${PAGES.filter((p) => p.section === section)
        .map((p) => `- [${p.title}](${SITE}${p.path}): ${p.summary}`)
        .join('\n')}`,
  )
  .join('\n\n')}

## AI 用スキル

${SKILLS.map((s) => `- [${s.title}](${REPO}/blob/main/${s.source}): ${s.summary}`).join('\n')}

## その他

- [デモ](${SITE}/demo): ブラウザで動くエディタ
- [変更履歴](${SITE}/changelog)
- [GitHub](${REPO})
`;

const full = [
  index,
  ...PAGES.map((p) => `\n---\n\n<!-- ${SITE}${p.path} -->\n\n${plain(read(p.source))}\n`),
  ...SKILLS.map(
    (s) => `\n---\n\n<!-- ${REPO}/blob/main/${s.source} -->\n\n${plain(read(s.source))}\n`,
  ),
].join('');

mkdirSync(`${root}/docs/public`, { recursive: true });
writeFileSync(`${root}/docs/public/llms.txt`, index);
writeFileSync(`${root}/docs/public/llms-full.txt`, full);
console.log(
  `wrote docs/public/llms.txt (${index.length} chars), llms-full.txt (${full.length} chars)`,
);
