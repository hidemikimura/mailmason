# 差し込み変数

宛名や配信停止 URL のように、受信者ごとに変わる値は **差し込み変数（マージタグ）** で書きます。既定の書式は `{{name}}` です。

## 候補を渡す

```js
editor.mergeTags = [
  { key: 'name', label: '氏名', sample: '山田 太郎', fallback: 'お客様' },
  { key: 'unsubscribe_url', label: '配信停止 URL', sample: 'https://example.com/u' },
];
```

| キー       | 内容                                    |
| ---------- | --------------------------------------- |
| `key`      | タグに書く名前（英数字・`_`・`.`・`-`） |
| `label`    | エディタのメニューに出る名前            |
| `sample`   | プレビューで差し込む値                  |
| `fallback` | 書き出し時に値が無いときの既定値        |

候補は、テキストの書式ツールバーと、設定欄（ボタンの文字・リンク先・画像の URL と代替テキストなど）の「差し込み…」メニューに出ます。キャンバスではタグを色付きで表示します。

## 書ける場所

テキスト（本文）、画像の URL・代替テキスト・リンク先、ボタンの文字・リンク先、SNS の URL、HTML ブロック、ボディ設定のタイトルとプリヘッダーです。リンク先（`href`）には `{{unsubscribe_url}}` のようにタグだけを書くこともできます。

`mergeTags` に無いキーを使っていると、書き出し時に `mm-warning`（`unknown-merge-tag`）で知らせます（候補を 1 つも渡していなければ知らせません）。

## 書き出すとき

- **タグのまま**（既定）: 配信システムの差し込み機能に任せます。

  ```js
  const html = editor.exportHtml({ minify: true });
  ```

- **値を入れて**: `mergeValues` を渡します。値の無いキーは候補の `fallback` を使い、それも無ければタグのまま残します。HTML では値をエスケープします。

  ```js
  const html = editor.exportHtml({ minify: true, mergeValues: { name: '佐藤 花子' } });
  ```

サーバーで書き出すときは `@hidemikimura/mailmason/core` の `renderHtml(template, { mergeValues })` を使います（こちらは `fallback` を補わないので、必要なら値に含めてください）。

## 区切りを変える

配信システムの書式に合わせて区切りを変えられます。エディタと書き出しの両方に同じ値を指定してください。

```js
editor.mergeTagDelimiters = { open: '%%', close: '%%' }; // %%name%%
```

```js
renderHtml(template, { mergeTagDelimiters: { open: '%%', close: '%%' } });
```

## テンプレートから探す・置き換える

```js
import { findMergeTags, replaceMergeTags } from '@hidemikimura/mailmason/core';

findMergeTags(template); // [{ key: 'name', blockId: 'b_...', field: 'html' }, ...]
replaceMergeTags('こんにちは {{name}} 様', { name: '山田' }); // 'こんにちは 山田 様'
```
