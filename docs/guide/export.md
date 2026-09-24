# 書き出しと配信

## エディタから書き出す

```js
const html = editor.exportHtml({ minify: true });
const text = editor.exportText();
// まとめて
const { html, text } = editor.export({ html: { minify: true }, text: { wrapWidth: 70 } });
```

- **`minify: true`** — 改行とインデントを入れません。本番配信ではこちらを使ってください。Gmail は約 102KB を超えるメールを途中で省略するため、90KB を超えると `mm-warning`（`html-size`）で知らせます。
- **`mergeValues`** — 差し込み変数に値を入れます。値の無いキーは候補の `fallback` を使います（[差し込み変数](./merge-tags)）。
- **テキスト** — 利用者が手で直していればその内容を、無ければ自動生成を返します。直した後に本文が変わっていると `stale-text` の警告が出ます。

## サーバーで書き出す

保存したテンプレートから、Node で同じ HTML とテキストを作れます。一斉配信や予約配信のように、エディタを開かずに送るときに使います。

```js
import { renderHtml, resolveTextPart, validate } from '@hidemikimura/mailmason/core';

const { error, warnings } = validate(template);
if (error) throw error; // テンプレートとして読めない
if (warnings.length) console.warn(warnings); // 読み込み時に自動で直される箇所

const html = renderHtml(template, { minify: true, mergeValues: values });
const { text, stale } = resolveTextPart(template, { mergeValues: values });
```

## 送るとき

- HTML とテキストを **multipart/alternative** で送ります（多くのメール送信ライブラリは `html` と `text` を渡すと自動でこの形にします）。
- SMTP には 1 行 998 バイトの上限があります。HTML パートとテキストパートは **quoted-printable か base64** でエンコードしてください。多くの配信システムは自動で行います。
- 差し込みを配信システムに任せる場合は、タグのまま書き出し、区切りを配信システムの書式に合わせます（`mergeTagDelimiters`）。

## 実際のメールソフトで確かめる

出力 HTML の互換性は自動テストで検査していますが、メールソフトごとの表示は実機で確かめてください。リポジトリの `npm run samples` で、Outlook や Apple Mail で開ける `.eml` を書き出せます。手順と確認項目は[メールソフトでの確認](/client-checklist)にあります。
