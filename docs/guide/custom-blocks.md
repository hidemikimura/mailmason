# カスタムブロック

商品カードやクーポンなど、アプリ独自のブロックを追加できます。`defineBlock()` で「設定項目」と「出力の作り方」を定義し、エディタとサーバーの両方に同じ定義を渡します。

[デモ](/demo)のパレットにある「クーポン」と「商品リスト」がカスタムブロックの例です。

## 定義する

```js
import { defineBlock } from '@hidemikimura/mailmason/core';

export const couponBlock = defineBlock({
  type: 'acme-coupon', // 英小文字・数字・ハイフン。ハイフンを 1 つ以上含む
  label: { ja: 'クーポン', en: 'Coupon' }, // 文字列だけでもよい
  icon: '<svg viewBox="0 0 24 24" …>…</svg>', // パレットのアイコン（省略可）
  fields: [
    { key: 'title', kind: 'text', label: '見出し', default: '期間限定クーポン', mergeTags: true },
    { key: 'code', kind: 'text', label: 'コード', default: '{{coupon}}', mergeTags: true },
    { key: 'color', kind: 'color', label: '色', default: '#b45309' },
    { key: 'url', kind: 'url', label: 'リンク先', mergeTags: true },
  ],
  renderHtml(v, ctx) {
    if (!v.code) return ''; // 空なら出力しない
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:2px dashed ${v.color};">
        <tr><td align="center" style="padding:16px;font-family:${ctx.body.fontFamily};">
          <p style="margin:0;">${ctx.escape(v.title)}</p>
          <p style="margin:0;font-size:24px;font-weight:bold;">${ctx.escape(v.code)}</p>
          ${v.url ? ctx.button({ label: '使う', href: v.url, backgroundColor: v.color }) : ''}
        </td></tr>
      </table>`;
  },
  renderText: (v) => `${v.title}: ${v.code}`,
});
```

設定項目から値のスキーマと既定値が作られます。読み込み時は、ほかのブロックと同じように不正な値を直して警告します。

## 登録する

カスタムブロックはグローバルには登録しません。エディタと書き出しのそれぞれに、定義の配列を渡します。

```js
// エディタ（loadJson より前に設定する）
editor.blocks = [couponBlock, productListBlock];
editor.loadJson(saved);

// サーバーで書き出す
import { renderHtml, resolveTextPart } from '@hidemikimura/mailmason/core';
const html = renderHtml(template, { minify: true, blocks: [couponBlock, productListBlock] });
const { text } = resolveTextPart(template, { blocks: [couponBlock, productListBlock] });
```

`migrate` / `validate` / `renderText` / `findMergeTags` / `createBlock` / `createStore` も `blocks` オプションを受け取ります。

::: warning
定義を渡し忘れると、そのブロックは未知の種類として扱われ（`unknown-block-type`）、出力されません。データは残るので、定義を渡して読み込み直せば元に戻ります。エディタは、読み込んだ後に `blocks` を設定した場合も値を整え直します。
:::

同じ定義ファイルをブラウザとサーバーの両方から import できるよう、定義は `@hidemikimura/mailmason/core`（DOM に依存しない）だけで書いてください。

## 設定項目（`fields`）

| `kind`     | 値                                                      | 主なオプション                                      |
| ---------- | ------------------------------------------------------- | --------------------------------------------------- |
| `text`     | 文字列                                                  | `mergeTags`, `placeholder`                          |
| `textarea` | 文字列（改行あり）                                      | `mergeTags`                                         |
| `url`      | 文字列                                                  | `mergeTags`                                         |
| `number`   | 数値                                                    | `min`, `max`, `step`, `unit`, `integer`, `nullable` |
| `color`    | `#rrggbb`                                               | `nullable`                                          |
| `select`   | 選択肢の `value`                                        | `choices: [{ value, label }]`（必須）               |
| `align`    | 選択肢の `value`（ボタンで選ぶ）                        | `choices`（省略時は `left` / `center` / `right`）   |
| `toggle`   | 真偽値                                                  |                                                     |
| `image`    | `{ src, alt, naturalWidth, naturalHeight, uploadData }` | `mergeTags`（代替テキスト）                         |
| `list`     | 項目の配列                                              | `fields`（必須）, `min`, `max`, `itemLabel`         |
| `action`   | （値を持たない）ボタン                                  | `run`（必須）                                       |
| `element`  | 任意（JSON で表せる値）                                 | `tagName`（必須）                                   |

すべての項目に `key`（`action` 以外）、`label`、`help`（説明）、`default`（既定値）、`visible(values)`（条件付きで表示）を指定できます。`label` と `help` は文字列か `{ ja, en }` です。

`image` は画像ブロックと同じ入力欄になり、`onImageUpload` があればアップロードもできます。

## 出力を作る（`renderHtml`）

`renderHtml(values, ctx)` は、配信用の HTML（テーブル＋インライン CSS）を文字列か文字列の配列で返します。空文字・`null` なら出力しません。キャンバスとプレビューにも同じ HTML を表示します。

| `ctx` の道具                                                           | 内容                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `width`                                                                | ブロックの内容幅（px。ブロックの余白を除く）                              |
| `body`                                                                 | メール全体の設定（`fontFamily`・`textColor`・`linkColor` など）           |
| `escape(text)` / `escapeAttr(text)`                                    | HTML / 属性値用のエスケープ                                               |
| `text(text)`                                                           | エスケープして改行を `<br />` にする                                      |
| `image({ src, alt, href, width, naturalWidth, naturalHeight, align })` | メール向けの `<img>`（リンク付きなら `<a>` で包む）。`src` が空なら空文字 |
| `button({ label, href, backgroundColor, color, … })`                   | メール向けのボタン（Outlook では VML の角丸ボタン）                       |
| `blockId` / `locale`                                                   | ブロックの ID / 言語                                                      |

- 利用者が入力した値は、必ず `ctx.escape` などでエスケープしてください。出力はエディタが加工せずにそのまま入れます。
- メールで使えない CSS（`display:flex` や `position` など）は避け、テーブルで組んでください。スマホで縦に並べたいセルには `class="mm-col"` を付けると、標準のカラムと同じく縦積みになります。
- 差し込み変数（`{{name}}` など）は、出力した HTML の中でそのまま置き換わります。
- `renderText(values, ctx)` を書くと、テキストパートにも出します（省略時は出さない）。
- `align(values)` でブロックを包むセルの横位置を、`defaultStyle: { padding, backgroundColor }` で共通スタイルの既定値を決められます。

`renderHtml` が例外を投げたときは、キャンバスに「表示できません」と出し、エディタは止めません（書き出しの `exportHtml` や `renderHtml` では例外がそのまま伝わります）。

## 繰り返しの項目（`list`）

件数が変わる項目は `list` にします。設定パネルでは、項目ごとに見出しと並べ替え・削除のボタン、「＋ 追加」ボタンが出ます。

```js
{
  key: 'items',
  kind: 'list',
  label: '商品',
  min: 1,
  max: 6,
  itemLabel: (item, i) => item.name || `商品 ${i + 1}`,
  fields: [
    { key: 'image', kind: 'image', label: '画像' },
    { key: 'name', kind: 'text', label: '商品名', mergeTags: true },
    { key: 'price', kind: 'number', label: '価格', min: 0, unit: '円' },
  ],
}
```

リストの中に `list` や `action` は置けません。

## 外部のデータを入れる（`action`）

`action` は設定パネルにボタンを出し、押すと `run({ values, blockId, locale })` を呼びます。返したオブジェクトをブロックの値に入れます（`null` なら何もしない）。自社の商品 DB から選ぶ画面を開く、API から最新の価格を読み込む、などに使います。

```js
{
  kind: 'action',
  label: '商品を選ぶ…',
  run: async ({ values }) => {
    const product = await openProductPicker(); // アプリの画面。取り消しなら null
    if (!product) return null;
    return {
      items: [...values.items, { name: product.name, price: product.price, image: { src: product.imageUrl, alt: product.name } }],
    };
  },
}
```

実行中はボタンを押せなくなり、例外を投げると設定欄に理由を出して `mm-warning`（`block-action-failed`）を発火します。

## 独自の入力欄（`element`）

標準の部品に無い入力欄は、カスタム要素で作れます。エディタはその要素を設定欄に置き、次のプロパティを渡します。値を変えたら `mm-field-change` イベント（`detail.value`）を発火してください。フレームワークは問いません。

| プロパティ | 内容             |
| ---------- | ---------------- |
| `value`    | この項目の今の値 |
| `values`   | ブロックの値全体 |
| `locale`   | 言語             |
| `blockId`  | ブロックの ID    |

```js
class ProductPicker extends HTMLElement {
  set value(v) {
    this.textContent = v ? `選択中: ${v.name}` : '未選択';
  }
  connectedCallback() {
    this.addEventListener('click', async () => {
      const product = await openProductPicker();
      if (product) {
        this.dispatchEvent(new CustomEvent('mm-field-change', { detail: { value: product } }));
      }
    });
  }
}
customElements.define('acme-product-picker', ProductPicker);

// 定義: { key: 'product', kind: 'element', label: '商品', tagName: 'acme-product-picker' }
```

値は JSON で表せるものにしてください（テンプレートに保存されます）。

## テンプレートを検査する

AI 用スキルの `validate.mjs` に `--blocks` で定義のモジュールを渡すと、カスタムブロックも検査・書き出しできます。

```sh
node validate.mjs template.json --blocks ./blocks.mjs --html out.html
```

```js
// blocks.mjs（定義の配列を default か blocks で export する）
import { couponBlock, productListBlock } from './blocks.js';
export default [couponBlock, productListBlock];
```
