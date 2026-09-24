# `<mailmason-editor>` API リファレンス

## プロパティ / 属性

オブジェクト・配列・関数はプロパティで渡します（属性名がある項目は HTML の属性でも指定できます）。

| プロパティ           | 属性                   | 型                            | 既定値                        | 内容                                                                                           |
| -------------------- | ---------------------- | ----------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `template`           | —                      | `Template`                    | 空のテンプレート              | 取得すると `getJson()`、代入すると `loadJson()` と同じ                                         |
| `theme`              | —                      | `Partial<BodySettings>`       | `{}`                          | 新規テンプレートの既定デザイン（幅・色・フォントなど）。読み込んだ JSON には適用しない         |
| `locale`             | `locale`               | `'ja' \| 'en'`                | `'ja'`                        | UI の言語。テキストパートの SNS 名などにも使う                                                 |
| `messages`           | —                      | `Record<string, string>`      | `{}`                          | UI 文言の部分上書き（例: `{ 'toolbar.preview': '確認' }`）                                     |
| `mergeTags`          | —                      | `MergeTag[]`                  | `[]`                          | 差し込み変数の候補                                                                             |
| `mergeTagDelimiters` | —                      | `{ open, close }`             | `{ open: '{{', close: '}}' }` | 差し込み変数の区切り                                                                           |
| `onImageSelect`      | —                      | `ImageSelectHook \| null`     | `null`                        | 画像欄の「選択…」ボタンで呼ぶ。自前の画像ライブラリ画面などを開いて URL を返す                 |
| `onImageUpload`      | —                      | `ImageUploadHook \| null`     | `null`                        | ローカルの画像ファイルを受け取ってアップロードし、URL を返す                                   |
| `maxImageSize`       | `max-image-size`       | `number`                      | `5242880`（5MB）              | アップロードできる画像の上限（バイト、0 で無制限）                                             |
| `socialIconBaseUrl`  | `social-icon-base-url` | `string`                      | `''`                          | SNS アイコン PNG の置き場所。`{base}/{service}-{color\|mono}.png` を参照。空ならテキストリンク |
| `outlookFontFamily`  | `outlook-font-family`  | `string`                      | `'Arial, sans-serif'`         | Outlook（Windows）用のフォント（最初のフォントが無いと明朝体になるため）                       |
| `historyLimit`       | `history-limit`        | `number`                      | `100`                         | Undo の履歴の上限                                                                              |
| `colorMode`          | `color-mode`           | `'light' \| 'dark' \| 'auto'` | `'light'`                     | エディタ UI の配色（メールの色ではない）                                                       |
| `view`               | `view`                 | `'edit' \| 'preview'`         | `'edit'`                      | 編集画面かプレビューか                                                                         |
| `previewDevice`      | `preview-device`       | `'desktop' \| 'mobile'`       | `'desktop'`                   | プレビューの幅（900px / 375px）                                                                |

### 型

```ts
type MergeTag = { key: string; label: string; sample?: string; fallback?: string };

// 画像欄の「選択…」ボタン
type ImageSelectHook = (context: {
  current: string;
}) => Promise<string | { src: string; alt?: string } | null | undefined>;

// ローカルの画像ファイル（PNG・JPEG・GIF）。null / undefined を返すと取り消し、例外は失敗として表示
type ImageUploadHook = (
  file: File,
  context: { blockId: string },
) => Promise<string | { src: string; alt?: string } | null | undefined>;
```

`{ src, alt }` を返すと、代替テキストが空のときだけ `alt` も設定します。画像の実寸（`naturalWidth` / `naturalHeight`）はエディタが測ります。

## メソッド

| メソッド                  | 戻り値           | 内容                                                                                                                                                                                             |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loadJson(json)`          | `Warning[]`      | テンプレート（オブジェクトまたは JSON 文字列）を読み込む。欠けた項目は補い、直した箇所を返す（`mm-warning` も発火）。履歴はクリアし、`mm-change` は発火しない。解釈できなければ `MailmasonError` |
| `getJson()`               | `Template`       | 現在のテンプレートのコピー                                                                                                                                                                       |
| `exportHtml(options?)`    | `string`         | 配信用 HTML。`options` は `RenderHtmlOptions`（`minify`・`mergeValues` など）。`mergeValues` を渡したときだけ、値の無いキーに `mergeTags` の `fallback` を使う                                   |
| `exportText(options?)`    | `string`         | テキストパート（手直しがあればそれ、無ければ自動生成）。`options` は `RenderTextOptions`（`wrapWidth`・`mergeValues` など）                                                                      |
| `export(options?)`        | `{ html, text }` | `{ html?: RenderHtmlOptions, text?: RenderTextOptions }` を受け取り、両方を書き出す                                                                                                              |
| `undo()` / `redo()`       | `boolean`        | 元に戻す / やり直す（できたら true）                                                                                                                                                             |
| `canUndo()` / `canRedo()` | `boolean`        |                                                                                                                                                                                                  |
| `select(id)`              | `void`           | 行・カラム・ブロックを ID で選択（`null` で解除）                                                                                                                                                |

### `RenderHtmlOptions`

| キー                 | 既定値                | 内容                                                  |
| -------------------- | --------------------- | ----------------------------------------------------- |
| `minify`             | `false`               | 改行・インデントを入れない（本番配信向け）            |
| `mergeValues`        | `null`                | マージタグを値に置き換える（HTML では値をエスケープ） |
| `mergeTagDelimiters` | `{{` `}}`             |                                                       |
| `socialIconBaseUrl`  | `''`                  |                                                       |
| `locale` / `lang`    | `'ja'` / locale       | `<html lang>` など                                    |
| `outlookFontFamily`  | `'Arial, sans-serif'` |                                                       |

### `RenderTextOptions`

| キー            | 既定値     | 内容                                                          |
| --------------- | ---------- | ------------------------------------------------------------- |
| `wrapWidth`     | `0`        | 折り返す桁数（全角 = 2 桁）。0 は折り返さない。URL は折らない |
| `newline`       | `'\n'`     | `'\r\n'` も可                                                 |
| `headingPrefix` | `''`       | 見出しの前に付ける記号（例: `'■ '`）                          |
| `dividerText`   | `'-'` × 40 | 区切り線                                                      |
| `mergeValues`   | `null`     | マージタグを値に置き換える（エスケープしない）                |

## イベント

すべて `bubbles: true, composed: true` の `CustomEvent` です。

| イベント     | `detail`                       | いつ                                                                                                       |
| ------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `mm-ready`   | なし                           | 最初の描画が終わったとき                                                                                   |
| `mm-change`  | `{ template, actions }`        | 編集内容が変わったとき（1 フレームに 1 回まで）。`template` は変更しないこと。`actions` はコマンド名の配列 |
| `mm-select`  | `{ id, kind }`                 | 選択が変わったとき。`kind` は `'row' \| 'column' \| 'block' \| null`                                       |
| `mm-warning` | `{ code, path, message, ... }` | 下の警告コード                                                                                             |
| `mm-view`    | `{ view, device }`             | ツールバーで表示を切り替えたとき（プロパティへの代入では発火しない）                                       |

`mm-ready` は要素の登録直後に発火するため、`import` より後で `addEventListener` するとき取りこぼすことがあります。待つ必要があれば `await editor.updateComplete` を使ってください。

### 警告コード（`mm-warning` / `loadJson` の戻り値）

| コード                                    | 内容                                                 |
| ----------------------------------------- | ---------------------------------------------------- |
| `missing-version`                         | `version` が無かったので補った                       |
| `invalid-value`                           | 型や範囲が不正な値を既定値にした                     |
| `unknown-key`                             | 未知のキーを削除した                                 |
| `regenerated-id`                          | 空・重複した ID を振り直した                         |
| `layout-mismatch`                         | カラムの数をレイアウトに合わせた                     |
| `unknown-block-type`                      | 未知のブロック（データは残し、出力しない）           |
| `sanitized-html`                          | テキストの HTML を許可タグに整えた                   |
| `unknown-merge-tag`                       | `mergeTags` に無いキーを使っている（書き出し時）     |
| `html-size`                               | HTML が 90KB を超えた（`bytes` 付き）                |
| `stale-text`                              | 手直ししたテキストパートが本文より古い               |
| `image-upload-type` / `image-upload-size` | アップロードできない形式 / 大きさ（`fileName` 付き） |
| `image-upload-failed`                     | `onImageUpload` が失敗した（`error` 付き）           |

### エラー（`MailmasonError`、`code` プロパティ）

`invalid-json`（JSON 文字列として読めない）、`invalid-template`（テンプレートの形でない）、`invalid-version` / `unsupported-version`（新しいバージョン）。`@hidemikimura/mailmason/core` の `createRow` などは `invalid-layout` / `unknown-block-type` / `not-found` なども投げます。

## 見た目の調整

- CSS カスタムプロパティ（要素に指定）: `--mm-color-accent` `--mm-color-accent-soft` `--mm-color-accent-text` `--mm-color-bg` `--mm-color-surface` `--mm-color-surface-2` `--mm-color-text` `--mm-color-muted` `--mm-color-border` `--mm-color-danger` `--mm-radius` `--mm-font-family` `--mm-font-size` `--mm-palette-width` `--mm-panel-width`
- `::part()`: `toolbar` `palette` `canvas` `settings` `preview`
- スロット: `slot="toolbar"` の要素をツールバーの右端に置く（保存ボタンなど）

```css
mailmason-editor {
  --mm-color-accent: #0f766e;
  --mm-font-family: 'Noto Sans JP', sans-serif;
}
mailmason-editor::part(toolbar) {
  border-bottom-color: #0f766e;
}
```

```html
<mailmason-editor>
  <button slot="toolbar" id="save">保存</button>
</mailmason-editor>
```

## `@hidemikimura/mailmason/core`（Node でも動く）

| 関数                                                                                   | 内容                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `renderHtml(template, options?)`                                                       | 配信用 HTML                                                         |
| `renderText(template, options?)`                                                       | 自動生成のテキストパート                                            |
| `resolveTextPart(template, options?)`                                                  | `{ text, mode, stale }`。手直しがあればそれを使う（配信にはこちら） |
| `validate(json)`                                                                       | `{ valid, warnings, error }`。例外を投げない                        |
| `migrate(json, { mergeTagDelimiters })`                                                | `{ template, warnings }`。正規化したテンプレート（不正なら例外）    |
| `createTemplate(theme?)` / `createRow(layout, blocks?)` / `createBlock(type, values?)` | 部品を作る                                                          |
| `findMergeTags(template)` / `replaceMergeTags(text, values)`                           | マージタグの列挙・置換                                              |
| `sanitizeHtml(html)`                                                                   | テキストブロック用に HTML を許可タグへ整える                        |

型（`Template`・`Block`・`RenderHtmlOptions` など）も同じパスから import できます。
