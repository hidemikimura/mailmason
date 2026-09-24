---
layout: page
pageClass: mm-demo-page
title: デモ
sidebar: false
aside: false
---

<div class="vp-doc" style="padding: 32px 24px 0; max-width: 1440px; margin: 0 auto">

# デモ

実際のエディタです。行やブロックをドラッグしたり、テキストをクリックして編集したり、ツールバーの「プレビュー」で PC・スマホの表示とテキストパートを確かめたりできます。下の欄には、今のテンプレート JSON と書き出した HTML・テキストが出ます。

<ClientOnly>
  <MailmasonDemo height="calc(100vh - 220px)" />
</ClientOnly>

デモの差し込み変数は `{{name}}`・`{{unsubscribe_url}}`・`{{coupon}}` です。画像のアップロードは送信せずにブラウザ内で読み込むだけなので、実際の配信には使えません（[画像](/guide/images)を参照）。

</div>
