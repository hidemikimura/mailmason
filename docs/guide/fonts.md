# フォント

メールのフォントは、全体設定の「フォント」と、テキストブロックの「フォント」で選びます。端末に入っているフォントのほか、Google Fonts などの Web フォントも使えます。

## 端末のフォント

「端末のフォント」の候補（ゴシック体・明朝体・Helvetica / Arial・Georgia・Verdana）は、受信する端末に入っているフォントを名前で指定します。どのメールソフトでも使えます。候補の中身は CSS の `font-family` で、先頭から順に、端末にあるフォントを使います。

「直接入力…」を選ぶと、`font-family` の値をそのまま書けます（例: `'Hiragino Sans', Meiryo, sans-serif`）。

## Web フォント

1. 全体設定の「Web フォント」で「Web フォントを追加…」を開き、候補から選びます。候補に無いフォントは「URL を指定…」で、フォント名と CSS の URL（`https://` で始まるもの）を入れて追加します。
2. 全体設定またはテキストブロックの「フォント」で、追加した Web フォントを選びます。

追加しただけのフォントは読み込みません。どこかの「フォント」で選んだものだけを、出力 HTML の `<head>` で読み込みます。エディタのキャンバスでも、追加したフォントで表示します。

### 表示されるメールソフト

Web フォントを表示するメールソフトは限られます。表示しないメールソフトでは、「フォント」の Web フォントの後ろに並べた端末のフォントで表示します。

| 表示される                                          | 表示されない（端末のフォントになる）                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| Apple Mail（Mac）、iOS メール、Outlook for Mac など | Gmail（Web・アプリ）、Outlook（Windows・Outlook.com）、Yahoo!メールなど |

- Web フォントを選ぶと、後ろには候補ごとに決めた端末のフォント（日本語のゴシック体なら `'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif`）が付きます。設定欄にも、表示されないメールソフトで使うフォントを出します。
- Outlook（Windows）では、Outlook 用のフォント（`outlookFontFamily`、既定は `Arial, sans-serif`）で表示します（[見た目と言語](./customization)）。
- プレビューの「Web フォント」をオフにすると、Web フォントを読み込まないメールソフトでの見え方を確かめられます（パソコンに同じフォントが入っていると、そのフォントで表示されます）。

::: tip
日本語の Web フォントは、使う文字の分だけ読み込まれます（Google Fonts は文字の範囲ごとにファイルを分けています）。それでも表示までに時間がかかることがあるので、本文より見出しに使うのがおすすめです。
:::

### 候補を変える

エディタの `webFontOptions` プロパティで、「Web フォントを追加…」の候補を変えられます。既定は Google Fonts の日本語（ゴシック体・明朝体）と欧文のフォントです。

```js
const editor = document.querySelector('mailmason-editor');

// 自社で配信しているフォントを候補に足す
editor.webFontOptions = [
  ...editor.webFontOptions,
  {
    family: 'Acme Sans',
    url: 'https://cdn.example.com/fonts/acme-sans.css',
    fallback: "'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
    group: { ja: '自社フォント', en: 'Our fonts' },
  },
];

// Google Fonts を候補に出さない（URL の指定だけにする）
editor.webFontOptions = [];
```

| 項目       | 内容                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| `family`   | フォント名（`font-family` に書く名前）                                       |
| `url`      | CSS の URL（`https://` のみ）。`@font-face` を書いた CSS を指す              |
| `fallback` | 表示されないメールソフトで使う端末のフォント（省略すると日本語のゴシック体） |
| `group`    | 候補の一覧での見出し（文字列か `{ ja, en }`。省略すると「その他」）          |

### テンプレート JSON と出力

追加した Web フォントは `body.settings.webFonts` に入ります。

```json
{
  "body": {
    "settings": {
      "fontFamily": "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif",
      "webFonts": [
        {
          "family": "Noto Sans JP",
          "url": "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap"
        }
      ]
    }
  }
}
```

出力 HTML では、ボディとブロックの `fontFamily` で名前を使っている Web フォントだけを、`<link>` と `@import` の両方で読み込みます（Outlook（Windows）には出さないよう、条件付きコメントで囲みます）。`renderHtml(template, { webFonts: false })` で読み込みを出さないこともできます。

```html
<!--[if !mso]><!-->
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&amp;display=swap"
  rel="stylesheet"
  type="text/css"
/>
<style type="text/css">
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
</style>
<!--<![endif]-->
```

::: warning
Google Fonts などの外部の CSS を読み込むと、メールを開いた人の端末がフォントの配信元に接続します。配信のポリシーで外部への接続を避けている場合は、自社のサーバーでフォントを配信するか、端末のフォントを使ってください。
:::
