# フレームワークごとの組み込み例

`<mailmason-editor>` は標準のカスタム要素なので、どのフレームワークでも使えます。共通の注意は次の 3 つです。

- オブジェクト・配列・関数（`mergeTags`・`onImageUpload` など）は**プロパティ**で渡す（属性にすると文字列になる）。
- イベント名はハイフン入り（`mm-change`）。フレームワークの記法で直接購読できなければ `addEventListener` を使う。
- ブラウザ専用。SSR するフレームワークではクライアント側だけで `import('@hidemikimura/mailmason')` する。

## script タグだけ（ビルドなし）

Lit を同梱した単一バンドルを CDN から読み込みます。

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@hidemikimura/mailmason@0.9/dist/mailmason.bundle.js"
></script>
<mailmason-editor id="editor" style="height: 100vh"></mailmason-editor>
<script type="module">
  const editor = document.getElementById('editor');
  await customElements.whenDefined('mailmason-editor');
  editor.mergeTags = [{ key: 'name', label: '氏名', sample: '山田 太郎' }];
</script>
```

モジュールを使えない環境では `dist/mailmason.iife.js` を読み込むと、グローバル変数 `Mailmason` に core の関数（`renderHtml` など）が入ります。

`mailmason.bundle.js` は、プレビュー・表の編集・テキストパートの設定欄などを、使うときに同じ場所の `chunks/` から読み込みます。CDN を使わず自分のサーバーに置くときは、`dist/mailmason.bundle.js` と `dist/chunks/` を同じフォルダに置いてください（`mailmason.iife.js` は 1 ファイルで完結します）。

## React

React 18 / 19 のどちらでも動くよう、ref でプロパティとイベントを扱います。

```jsx
import { useEffect, useRef } from 'react';
import '@hidemikimura/mailmason';

export function MailEditor({ initial, onSave, uploadImage }) {
  const ref = useRef(null);

  useEffect(() => {
    const editor = ref.current;
    editor.mergeTags = [{ key: 'name', label: '氏名', sample: '山田 太郎' }];
    editor.onImageUpload = uploadImage; // (file) => Promise<string>
    if (initial) editor.loadJson(initial);
    const onChange = (e) => onSave(e.detail.template);
    editor.addEventListener('mm-change', onChange);
    return () => editor.removeEventListener('mm-change', onChange);
  }, []); // 読み込みは最初の 1 回だけ（再描画のたびに loadJson しない）

  return <mailmason-editor ref={ref} style={{ height: '100vh' }} />;
}
```

- TypeScript で `<mailmason-editor>` の JSX 型が無いと言われたら、`declare global { namespace JSX { interface IntrinsicElements { 'mailmason-editor': any } } }`（React 19 は `React.JSX`）を追加する（`ref` の型は `useRef<MailmasonEditor>(null)`）。
- Next.js の App Router では `'use client'` のコンポーネントにし、`import '@hidemikimura/mailmason'` を `useEffect` 内の `await import(...)` にするか、`next/dynamic` の `ssr: false` で読み込む。

### 件名の欄（`<mm-text-input>`）

エディタの外の欄も、同じ差し込み変数の候補と表示名で入力できます。値（キーで書いたもの）は `mm-value-input` で受け取ります。React の `value` / `onChange` は使えないので、ref で扱います。

```jsx
import { useEffect, useRef } from 'react';
import '@hidemikimura/mailmason';

export function SubjectField({ mergeTags, value, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    const field = ref.current;
    field.tags = mergeTags;
    const onInput = (e) => onChange(e.detail.value); // {{order.id}} のようにキーで届く
    field.addEventListener('mm-value-input', onInput);
    return () => field.removeEventListener('mm-value-input', onInput);
  }, [mergeTags, onChange]);

  useEffect(() => {
    // 入力中の値と同じなら欄は書き換わらない（カーソルが飛ばない）
    ref.current.value = value;
  }, [value]);

  return (
    <>
      <label htmlFor="subject">件名</label>
      <mm-text-input ref={ref} input-id="subject" display-labels="" />
    </>
  );
}
```

- `display-labels` を付けると、欄の中は `{{注文番号}}` のように表示名で見え、届く値はキーのまま。
- `<form>` の中に置けば `name` の値が送られ、`required` も効く（form-associated custom element）。

## Vue 3

カスタム要素として扱うよう設定します（Vite の場合）。

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
export default {
  plugins: [
    vue({
      template: { compilerOptions: { isCustomElement: (tag) => tag === 'mailmason-editor' } },
    }),
  ],
};
```

```vue
<script setup>
import { onMounted, ref } from 'vue';
import '@hidemikimura/mailmason';

const props = defineProps({ initial: Object });
const emit = defineEmits(['save']);
const editor = ref(null);
const mergeTags = [{ key: 'name', label: '氏名', sample: '山田 太郎' }];
async function upload(file) {
  /* サーバーに送って URL を返す */
}
onMounted(() => {
  if (props.initial) editor.value.loadJson(props.initial);
});
</script>

<template>
  <mailmason-editor
    ref="editor"
    style="height: 100vh"
    :mergeTags.prop="mergeTags"
    :onImageUpload.prop="upload"
    @mm-change="(e) => emit('save', e.detail.template)"
  />
</template>
```

Nuxt では `<ClientOnly>` で囲み、import はクライアント用のプラグイン（`*.client.js`）で行います。

## Svelte

```svelte
<script>
  import { onMount } from 'svelte';
  let editor;
  onMount(async () => {
    await import('@hidemikimura/mailmason');
    editor.mergeTags = [{ key: 'name', label: '氏名' }];
  });
</script>

<mailmason-editor bind:this={editor} on:mm-change={(e) => save(e.detail.template)} style="height: 100vh" />
```

## TypeScript

型定義を同梱しています（`@hidemikimura/mailmason` と `@hidemikimura/mailmason/core` のどちらからも import できます）。

- `document.querySelector('mailmason-editor')` は `MailmasonEditor` 型になり、`addEventListener('mm-change', (e) => e.detail.template)` の `detail` にも型が付きます。
- ブロックは `block.type` で絞り込むと `values` の型が決まります。`createBlock('table', { … })` の値も検査します。

```ts
import { createBlock, type Block, type Template } from '@hidemikimura/mailmason';

const editor = document.querySelector('mailmason-editor')!;
editor.addEventListener('mm-change', (e) => save(e.detail.template));

function titleOf(block: Block): string {
  switch (block.type) {
    case 'text':
      return block.values.html;
    case 'table':
      return `${block.values.cells.length} 行の表`;
    case 'video':
      return block.values.url;
    default:
      return block.type; // カスタムブロック（type にハイフンを含む）や、新しいバージョンのブロック
  }
}

const table = createBlock('table', {
  cells: [
    ['サイズ', '着丈'],
    ['S', '64 cm'],
  ],
});
```

カスタムブロック（`defineBlock()`）の `values` は `Record<string, any>` です。

## 保存の間隔

`mm-change` は入力中も 1 フレームごとに届きます。サーバーに毎回送らず、利用側でまとめてください。

```js
let timer;
editor.addEventListener('mm-change', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => save(e.detail.template), 1000);
});
```

## サーバーで書き出して送る（Node）

エディタが無くても、保存したテンプレートから HTML とテキストを作れます。

```js
// mail-options.js（ブラウザのエディタとサーバーの両方から読む）
export const textOptions = {
  textVariant: 'desktop', // PC 用・スマホ用で分けたブロックは PC 側だけをテキストパートに出す
  textTemplates: { button: '{@label}：{@href}' }, // 種類ごとの既定の書き方（任意）
};
```

```js
// エディタ側
import { textOptions } from './mail-options.js';
editor.textOptions = textOptions;
```

```js
// サーバー側
import { renderHtml, resolveTextPart, validate } from '@hidemikimura/mailmason/core';
import nodemailer from 'nodemailer';
import { textOptions } from './mail-options.js';

const template = JSON.parse(await readTemplate(id));
const { error } = validate(template);
if (error) throw error;

const values = { name: user.name, unsubscribe_url: unsubscribeUrl(user) };
const html = renderHtml(template, { minify: true, mergeValues: values });
// テキストパートはエディタと同じ textOptions で作る（違うとテキストが変わり、手直しが「古い」と判定される）
const { text, stale } = resolveTextPart(template, { ...textOptions, mergeValues: values });
if (stale) console.warn('テキストパートが本文より古い', id); // 送る前に利用者に確認してもらうなど

await transport.sendMail({ to: user.email, subject, html, text }); // multipart/alternative になる
```

カスタムブロックを使うなら、`renderHtml` と `resolveTextPart` の両方に `blocks` も渡します。エディタとサーバーの `@hidemikimura/mailmason` は同じ版にしてください（新しい版で保存したテンプレートは、古い版では読み込めません）。

配信システム（SendGrid・Amazon SES など）の差し込み機能を使う場合は、`mergeValues` を渡さずにタグのまま書き出し、区切りを配信システムに合わせます（例: `mergeTagDelimiters: { open: '%%', close: '%%' }` をエディタと書き出しの両方に指定）。
