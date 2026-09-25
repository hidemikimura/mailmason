# 差し込み変数

宛名や配信停止 URL のように、受信者ごとに変わる値は **差し込み変数（マージタグ）** で書きます。既定の書式は `{{name}}` です。

## 候補を渡す

```js
editor.mergeTags = [
  { key: 'name', label: '氏名', group: '会員', sample: '山田 太郎', fallback: 'お客様' },
  { key: 'points', label: '保有ポイント', group: '会員', sample: '1,250' },
  { key: 'coupon', label: 'クーポンコード', group: 'クーポン', sample: 'AUTUMN2026' },
  { key: 'unsubscribe_url', label: '配信停止 URL', group: '配信', sample: 'https://example.com/u' },
];
```

| キー       | 内容                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `key`      | タグに書く名前（英数字・`_`・`.`・`-`）                                  |
| `label`    | 候補の一覧に出る名前                                                     |
| `group`    | グループ名（省略可）。一覧でグループごとにまとめる。無い候補は「その他」 |
| `sample`   | プレビューで差し込む値                                                   |
| `fallback` | 書き出し時に値が無いときの既定値                                         |

グループは最初に出てきた順に並びます。キャンバスではタグを色付きで表示します。

## 候補から入れる

候補は、テキストの書式ツールバーと、設定欄（ボタンの文字・リンク先・画像の URL と代替テキストなど）の「差し込み…」ボタンから選べます。一覧の上の欄に文字を入れると、**グループ名・名前・キー** で絞り込みます（空白で区切ると、すべての語を含む候補だけ）。上下キーで選び、`Enter` で入れます。

### 入力中に候補を出す

本文や設定欄で区切り開始文字（既定は `{{`）を入力すると、その場に候補の一覧を出します。続けて入力した文字（`{{クーポン` の「クーポン」）で絞り込み、上下キーと `Enter`（または `Tab`）で選ぶと、入力中の文字ごとタグ（`{{coupon}}`）に置き換えます。`Esc` で一覧だけを閉じます。表のセルでも使えます。

この動作は `mergeTagTrigger` で止められます（既定は有効）。

```js
editor.mergeTagTrigger = false;
```

```html
<mailmason-editor merge-tag-trigger="false"></mailmason-editor>
```

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
