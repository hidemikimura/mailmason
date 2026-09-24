---
layout: home

hero:
  name: Mailmason
  text: ノーコード HTML メールエディタ
  tagline: 行とカラムをドラッグ&ドロップしてメールを作り、Outlook でも崩れにくい HTML とマルチパート用のテキストを書き出す、Lit 製の Web Components
  image:
    src: /logo.svg
    alt: Mailmason
  actions:
    - theme: brand
      text: はじめる
      link: /guide/getting-started
    - theme: alt
      text: デモを触る
      link: /demo
    - theme: alt
      text: GitHub
      link: https://github.com/hidemikimura/mailmason

features:
  - icon: 🧱
    title: 行 × カラムで組み立てる
    details: 1〜4 カラムのレイアウトに、テキスト・画像・ボタン・SNS など 8 種類のブロックを置くだけ。テキストはキャンバス上でそのまま編集できます。
  - icon: 📨
    title: 崩れにくい HTML
    details: テーブル＋インライン CSS、Outlook 用の条件付きコメントと VML ボタン。スマホではカラムが縦に並びます。出力の互換性は自動テストで検査しています。
  - icon: 📝
    title: テキストパートも自動で
    details: マルチパート配信用のテキストを同じテンプレートから生成。全角文字を考慮した折り返しや、利用者による手直しにも対応します。
  - icon: 🔌
    title: どこにでも組み込める
    details: 標準のカスタム要素 <mailmason-editor>。React・Vue・素の HTML で使え、差し込み変数・画像のアップロード・保存の仕組みはアプリ側で自由に決められます。
---

<div class="vp-doc" style="max-width: 1152px; margin: 48px auto 0; padding: 0 24px">

## 5 行で始める

```html
<script type="module">
  import '@hidemikimura/mailmason';
</script>
<mailmason-editor style="height: 100vh"></mailmason-editor>
```

```js
const { html, text } = document
  .querySelector('mailmason-editor')
  .export({ html: { minify: true } });
```

保存するのはテンプレート JSON だけ。HTML とテキストは、送るときにいつでも書き出せます。詳しくは[はじめる](/guide/getting-started)へ。

</div>
