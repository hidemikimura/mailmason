# 見た目と言語

## 新しいメールの既定デザイン（`theme`）

白紙から作るときのボディ設定（幅・色・フォントなど）を、アプリのブランドに合わせられます。読み込んだテンプレートには適用しません。

```js
editor.theme = {
  width: 640,
  backgroundColor: '#f5f1ea',
  fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
  textColor: '#2b2b2b',
  linkColor: '#b3541e',
};
```

設定できる項目は[テンプレート JSON](/reference/template)の「ボディ設定」と同じです。Web フォントを既定にするときは `webFonts` も入れます（[フォント](./fonts#web-フォント)）。

```js
editor.theme = {
  fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
  webFonts: [
    {
      family: 'Noto Sans JP',
      url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap',
    },
  ],
};
```

## エディタの見た目

エディタ自身（メールではなく操作画面）の色や寸法は、CSS カスタムプロパティで変えられます。

```css
mailmason-editor {
  --mm-color-accent: #0f766e;
  --mm-color-accent-soft: rgba(15, 118, 110, 0.12);
  --mm-font-family: 'Noto Sans JP', sans-serif;
  --mm-palette-width: 200px;
  --mm-panel-width: 320px;
}
```

| プロパティ                                                                         | 内容                       |
| ---------------------------------------------------------------------------------- | -------------------------- |
| `--mm-color-accent` / `--mm-color-accent-soft` / `--mm-color-accent-text`          | 選択枠・ボタンなどの強調色 |
| `--mm-color-bg` / `--mm-color-surface` / `--mm-color-surface-2`                    | 背景・パネル               |
| `--mm-color-text` / `--mm-color-muted` / `--mm-color-border` / `--mm-color-danger` | 文字・補足・枠線・エラー   |
| `--mm-radius` / `--mm-font-family` / `--mm-font-size`                              | 角丸・フォント・文字サイズ |
| `--mm-palette-width` / `--mm-panel-width`                                          | パレットと設定パネルの幅   |

さらに細かく変えたいときは `::part()` を使います（`toolbar` `palette` `canvas` `settings` `preview`）。

```css
mailmason-editor::part(toolbar) {
  background: #f8fafc;
}
```

### エディタのダークモード

`color-mode` 属性で `light`（既定）・`dark`・`auto`（OS の設定に合わせる）を選べます。エディタの画面の配色で、メールの色は変わりません（受信側のダークモードでの見え方は[書き出しと送信](./export#受信側のダークモード)を参照）。

```html
<mailmason-editor color-mode="auto"></mailmason-editor>
```

## ツールバーにボタンを置く

`slot="toolbar"` の要素は、ツールバーの右端に表示されます。

```html
<mailmason-editor>
  <button slot="toolbar" id="save">保存</button>
  <button slot="toolbar" id="send">テスト送信</button>
</mailmason-editor>
```

## 言語と文言

`locale` で UI の言語を `ja`（既定）か `en` にします。個別の文言は `messages` で上書きできます（キーの一覧はリポジトリの `src/editor/i18n.js` にあります）。

```js
editor.locale = 'ja';
editor.messages = {
  'toolbar.preview': '確認',
  'palette.hint': 'ドラッグして配置してください',
};
```

## Outlook のフォント

Outlook（Windows）は、指定したフォントの先頭が無いと明朝体で表示します。そのため Outlook にだけ別のフォントを指定します（既定 `Arial, sans-serif`）。

```html
<mailmason-editor outlook-font-family="'Meiryo UI', Meiryo, Arial, sans-serif"></mailmason-editor>
```
