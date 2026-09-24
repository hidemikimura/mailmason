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
  src="https://cdn.jsdelivr.net/npm/@hidemikimura/mailmason@0/dist/mailmason.bundle.js"
></script>
<mailmason-editor id="editor" style="height: 100vh"></mailmason-editor>
<script type="module">
  const editor = document.getElementById('editor');
  await customElements.whenDefined('mailmason-editor');
  editor.mergeTags = [{ key: 'name', label: '氏名', sample: '山田 太郎' }];
</script>
```

モジュールを使えない環境では `dist/mailmason.iife.js` を読み込むと、グローバル変数 `Mailmason` に core の関数（`renderHtml` など）が入ります。

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

- TypeScript で `<mailmason-editor>` の JSX 型が無いと言われたら、`declare global { namespace JSX { interface IntrinsicElements { 'mailmason-editor': any } } }`（React 19 は `React.JSX`）を追加する。
- Next.js の App Router では `'use client'` のコンポーネントにし、`import '@hidemikimura/mailmason'` を `useEffect` 内の `await import(...)` にするか、`next/dynamic` の `ssr: false` で読み込む。

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
import { renderHtml, resolveTextPart, validate } from '@hidemikimura/mailmason/core';
import nodemailer from 'nodemailer';

const template = JSON.parse(await readTemplate(id));
const { error } = validate(template);
if (error) throw error;

const values = { name: user.name, unsubscribe_url: unsubscribeUrl(user) };
const html = renderHtml(template, { minify: true, mergeValues: values });
const { text } = resolveTextPart(template, { mergeValues: values });

await transport.sendMail({ to: user.email, subject, html, text }); // multipart/alternative になる
```

配信システム（SendGrid・Amazon SES など）の差し込み機能を使う場合は、`mergeValues` を渡さずにタグのまま書き出し、区切りを配信システムに合わせます（例: `mergeTagDelimiters: { open: '%%', close: '%%' }` をエディタと書き出しの両方に指定）。
