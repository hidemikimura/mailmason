# はじめる

## インストール

```sh
npm install @hidemikimura/mailmason lit
```

Lit（3.3 以上）は peer dependency です。バンドラーを使わない場合は、Lit を同梱した単一バンドルを CDN から読み込めます。

```html
<!-- ES モジュール版 -->
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@hidemikimura/mailmason@0.2/dist/mailmason.bundle.js"
></script>
<!-- 従来の script タグ版（グローバル変数 Mailmason） -->
<script src="https://cdn.jsdelivr.net/npm/@hidemikimura/mailmason@0.2/dist/mailmason.iife.js"></script>
```

## エディタを置く

`import` するとカスタム要素 `<mailmason-editor>` が登録されます。高さを指定してください（`height: 100%` で親いっぱいに広がります）。

```html
<mailmason-editor id="editor" style="height: 100vh"></mailmason-editor>
<script type="module">
  import '@hidemikimura/mailmason';

  const editor = document.getElementById('editor');
  editor.mergeTags = [{ key: 'name', label: '氏名', sample: '山田 太郎' }];
</script>
```

オブジェクト・配列・関数（`mergeTags` など）は属性ではなく**プロパティ**で渡します。React や Vue での書き方は[フレームワークで使う](./frameworks)を参照してください。

## 保存と読み込み

保存するのはテンプレート JSON です。編集のたびに `mm-change` が届きます（1 フレームに 1 回まで）。

```js
editor.addEventListener('mm-change', (event) => {
  saveTemplate(event.detail.template); // 変更しないこと（そのまま JSON にして保存）
});

const warnings = editor.loadJson(savedTemplate); // 直した箇所があれば警告を返す
```

`loadJson` は欠けた項目を既定値で補い、不正な値は既定値に置き換えます（直した箇所は戻り値と `mm-warning` で分かります）。テンプレートとして読めないときは `MailmasonError` を投げます。

## 書き出す

```js
const { html, text } = editor.export({ html: { minify: true } });
```

`html` と `text` をマルチパート（`text/html` と `text/plain`）で送ります。本番配信は `minify: true` がおすすめです（Gmail は約 102KB を超えると本文を省略します）。詳しくは[書き出しと配信](./export)を参照してください。

## サーバーで書き出す

`@hidemikimura/mailmason/core` は DOM に依存しないので、Node でも同じ HTML を作れます。

```js
import { renderHtml, resolveTextPart } from '@hidemikimura/mailmason/core';

const html = renderHtml(template, { minify: true });
const { text } = resolveTextPart(template); // 利用者の手直しがあればそれを使う
```

## 次に読む

- [エディタの操作](./editing) — 利用者に案内する操作とキーボード
- [画像](./images) — 画像のアップロードの組み込み
- [差し込み変数](./merge-tags) — `{{name}}` の候補と差し込み
- [エディタ API](/reference/editor) — すべてのプロパティ・メソッド・イベント
