# `<mailmason-editor>` API リファレンス

## プロパティ / 属性

オブジェクト・配列・関数はプロパティで渡します（属性名がある項目は HTML の属性でも指定できます）。

| プロパティ           | 属性                   | 型                                                                                     | 既定値                        | 内容                                                                                                                                     |
| -------------------- | ---------------------- | -------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `template`           | —                      | `Template`                                                                             | 空のテンプレート              | 取得すると `getJson()`、代入すると `loadJson()` と同じ                                                                                   |
| `theme`              | —                      | `Partial<BodySettings>`                                                                | `{}`                          | 新規テンプレートの既定デザイン（幅・色・フォントなど）。読み込んだ JSON には適用しない                                                   |
| `locale`             | `locale`               | `'ja' \| 'en'`                                                                         | `'ja'`                        | UI の言語。テキストパートの SNS 名などにも使う                                                                                           |
| `messages`           | —                      | `Record<string, string>`                                                               | `{}`                          | UI 文言の部分上書き（例: `{ 'toolbar.preview': '確認' }`）                                                                               |
| `mergeTags`          | —                      | `MergeTag[]`                                                                           | `[]`                          | 差し込み変数の候補（`group` でグループ分け）                                                                                             |
| `mergeTagDelimiters` | —                      | `{ open, close }`                                                                      | `{ open: '{{', close: '}}' }` | 差し込み変数の区切り                                                                                                                     |
| `mergeTagTrigger`    | `merge-tag-trigger`    | `boolean`                                                                              | `true`                        | 区切り開始文字（`{{`）を入力したときに差し込み変数の候補を出す。属性で消すときは `merge-tag-trigger="false"`                             |
| `textOptions`        | —                      | `{ wrapWidth?, newline?, headingPrefix?, dividerText?, textVariant?, textTemplates? }` | `{}`                          | テキストパートの作り方。プレビュー・手直しの古さの判定・`exportText()` に同じものを使う（サーバーの `resolveTextPart` にも同じ値を渡す） |
| `textEditConfirm`    | `text-edit-confirm`    | `boolean`                                                                              | `true`                        | テキストパートを全文編集する前に、本文と切れることを伝えて部品ごとの設定を案内する。属性で消すときは `text-edit-confirm="false"`         |
| `onImageSelect`      | —                      | `ImageSelectHook \| null`                                                              | `null`                        | 画像欄の「選択…」ボタンで呼ぶ。自前の画像ライブラリ画面などを開いて URL を返す                                                           |
| `onImageUpload`      | —                      | `ImageUploadHook \| null`                                                              | `null`                        | ローカルの画像ファイル（と QR コードの PNG）を受け取ってアップロードし、URL を返す。無ければ QR コードのブロックは使えない               |
| `blocks`             | —                      | `CustomBlock[]`                                                                        | `[]`                          | カスタムブロックの定義（`defineBlock()` の戻り値）。`loadJson` より前に設定する。書き出し・プレビューにも使う                            |
| `components`         | —                      | `Component[]`                                                                          | `[]`                          | 保存済みのコンポーネント（行・ブロック）。パレットの「保存済み」に出す                                                                   |
| `onSaveComponent`    | —                      | `SaveComponentHook \| null`                                                            | `null`                        | 「コンポーネントとして保存」で呼ぶ。アプリが保存し、id を付けて返すと一覧に加える                                                        |
| `onDeleteComponent`  | —                      | `DeleteComponentHook \| null`                                                          | `null`                        | 「保存済み」の削除で呼ぶ。`false` を返すと取り消し                                                                                       |
| `maxImageSize`       | `max-image-size`       | `number`                                                                               | `5242880`（5MB）              | アップロードできる画像の上限（バイト、0 で無制限）                                                                                       |
| `socialIconBaseUrl`  | `social-icon-base-url` | `string`                                                                               | `''`                          | SNS アイコン PNG の置き場所。`{base}/{service}-{color\|mono}.png` を参照。空ならテキストリンク                                           |
| `outlookFontFamily`  | `outlook-font-family`  | `string`                                                                               | `'Arial, sans-serif'`         | Outlook（Windows）用のフォント（最初のフォントが無いと明朝体になるため）                                                                 |
| `historyLimit`       | `history-limit`        | `number`                                                                               | `100`                         | Undo の履歴の上限                                                                                                                        |
| `colorMode`          | `color-mode`           | `'light' \| 'dark' \| 'auto'`                                                          | `'light'`                     | エディタ UI の配色（メールの色ではない）                                                                                                 |
| `view`               | `view`                 | `'edit' \| 'preview'`                                                                  | `'edit'`                      | 編集画面かプレビューか                                                                                                                   |
| `previewDevice`      | `preview-device`       | `'desktop' \| 'mobile'`                                                                | `'desktop'`                   | プレビューの幅（900px / 375px）                                                                                                          |

### 型

```ts
// group があると候補の一覧でグループごとにまとめる。一覧はグループ名・label・key で絞り込める
// groupDescription はグループの説明（一覧のグループ名の下に出す。グループで最初に書いた候補のものを使う）
type MergeTag = {
  key: string;
  label: string;
  group?: string;
  groupDescription?: string;
  sample?: string;
  fallback?: string;
};

// フックの戻り値。data はブロックの uploadData に保存する任意のオブジェクト（JSON で表せる値）
type ImageResult =
  | string
  | { url: string; data?: Record<string, unknown> | null; alt?: string }
  | { src: string; alt?: string } // 以前からの形
  | null
  | undefined; // null / undefined は取り消し

// 画像欄の「選択…」ボタン
type ImageSelectHook = (context: { current: string }) => Promise<ImageResult>;

// ローカルの画像ファイル（PNG・JPEG・GIF）と QR コードの PNG。例外は失敗として表示
// 背景画像では blockId が行・カラムの ID（メール全体は 'body'）になり、target で区別する
type ImageUploadHook = (
  file: File,
  context: { blockId: string; target: 'block' | 'row' | 'column' | 'body' },
) => Promise<ImageResult>;

// 保存した行・ブロック。id はアプリが付ける。入れるときは複製（元とは連動しない）
type Component = {
  id?: string;
  name: string;
  kind: 'row' | 'block';
  version: number;
  content: Row | Block;
};
type SaveComponentHook = (component: Component) => Promise<Component | null | void>; // id 付きで返すと一覧に加える
type DeleteComponentHook = (component: Component) => Promise<boolean | void> | boolean | void; // false で取り消し
```

`alt` は代替テキストが空のときだけ設定します。`data` は画像ブロックの `uploadData`（画像＋テキストは `image.uploadData`）に保存し、出力には使いません。画像を差し替えると置き換わり（URL だけを返せば `null`）、URL を手で書き換えると `null` になります。画像の実寸（`naturalWidth` / `naturalHeight`）はエディタが測ります。`blockId` はテンプレート内で一意ですが、同じブロックの差し替えでは同じ値が渡るので、保存するファイル名はサーバー側で一意に作ってください。

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
| `insertComponent(c)`      | `string \| null` | コンポーネントを複製して入れる（選択中の要素の後ろ）。入れた要素の ID                                                                                                                            |
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

| キー            | 既定値     | 内容                                                                                                                  |
| --------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `wrapWidth`     | `0`        | 折り返す桁数（全角 = 2 桁）。0 は折り返さない。URL は折らない                                                         |
| `newline`       | `'\n'`     | `'\r\n'` も可                                                                                                         |
| `headingPrefix` | `''`       | 見出しの前に付ける記号（例: `'■ '`）                                                                                  |
| `dividerText`   | `'-'` × 40 | 区切り線                                                                                                              |
| `mergeValues`   | `null`     | マージタグを値に置き換える（エスケープしない）                                                                        |
| `textVariant`   | `'both'`   | PC 用・スマホ用で分けた部品・行（`hideOn`）のどちらを出すか（`'both'` / `'desktop'` / `'mobile'`）                    |
| `textTemplates` | `{}`       | 種類ごとの既定の書き方（例: `{ button: '{@label}：{@href}' }`）。`{@名前}` でブロックの値、`{@text}` で自動生成を参照 |

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

| コード                                                                    | 内容                                                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `missing-version`                                                         | `version` が無かったので補った                                                                                       |
| `invalid-value`                                                           | 型や範囲が不正な値を既定値にした                                                                                     |
| `unknown-key`                                                             | 未知のキーを削除した                                                                                                 |
| `regenerated-id`                                                          | 空・重複した ID を振り直した                                                                                         |
| `layout-mismatch`                                                         | カラムの数をレイアウトに合わせた                                                                                     |
| `unknown-block-type`                                                      | 未知のブロック（データは残し、出力しない）                                                                           |
| `sanitized-html`                                                          | テキストの HTML を許可タグに整えた                                                                                   |
| `unknown-merge-tag`                                                       | `mergeTags` に無いキーを使っている（書き出し時）                                                                     |
| `html-size`                                                               | HTML が 90KB を超えた（`bytes` 付き）                                                                                |
| `stale-text`                                                              | 手直ししたテキストパート（全文、または参照を含まないブロックの指定の文。後者は `blockIds` 付き）が本文より古い       |
| `unknown-text-ref`                                                        | テキストパートの指定の文・種類ごとの書き方で、そのブロックに無い名前を参照した（書き出し時、`blockId`・`name` 付き） |
| `image-upload-type` / `image-upload-size`                                 | アップロードできない形式 / 大きさ（`fileName` 付き）                                                                 |
| `image-upload-failed`                                                     | `onImageUpload` が失敗した（`error` 付き）                                                                           |
| `qr-missing` / `qr-stale`                                                 | QR コードの画像が未作成 / 作成後に設定が変わった（書き出し時、`blockId` 付き）                                       |
| `component-save-failed` / `component-delete-failed` / `invalid-component` | コンポーネントの保存・削除に失敗 / 入れられない形                                                                    |
| `block-action-failed`                                                     | カスタムブロックの `action` の処理が失敗した（`error` 付き）                                                         |
| `qr-too-long` / `qr-failed`                                               | 内容が長すぎて QR コードにできない / 作れなかった                                                                    |

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

## `<mm-text-input>`（差し込み変数の入力欄）

エディタの設定欄と同じ入力欄を、件名などエディタの外の欄に置けます。`@hidemikimura/mailmason` を import すると登録されます。Shadow DOM を使わないので、外の `<label for>` で中の欄（`input-id`）を指せます。

| プロパティ        | 属性                | 型                       | 既定値                        | 内容                                                                                                                                  |
| ----------------- | ------------------- | ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `value`             | `string`                 | `''`                          | 今の値。差し込み変数はキー（`{{order.id}}`）で書く。入力のたびに更新する                                                              |
| `tags`            | —                   | `MergeTag[]`             | `[]`                          | 差し込み変数の候補。空なら「差し込み…」ボタンも候補も出さない                                                                         |
| `displayLabels`   | `display-labels`    | `boolean`                | `false`                       | 欄の中を `label` で見せる（`{{注文番号}}`）。`value` とイベントはキーのまま                                                           |
| `delimiters`      | —                   | `{ open, close }`        | `{ open: '{{', close: '}}' }` | 差し込み変数の区切り                                                                                                                  |
| `mergeTagTrigger` | `merge-tag-trigger` | `boolean`                | `true`                        | `{{` の入力で候補を出す。属性で消すときは `merge-tag-trigger="false"`                                                                 |
| `inputId`         | `input-id`          | `string`                 | `''`                          | 中の欄の id                                                                                                                           |
| `placeholder`     | `placeholder`       | `string`                 | `''`                          |                                                                                                                                       |
| `inputmode`       | `inputmode`         | `string`                 | `'text'`                      |                                                                                                                                       |
| `multiline`       | `multiline`         | `boolean`                | `false`                       | 複数行（textarea）にする                                                                                                              |
| `rows`            | `rows`              | `number`                 | `4`                           | 複数行の行数                                                                                                                          |
| `disabled`        | `disabled`          | `boolean`                | `false`                       | 欄と「差し込み…」ボタンを使えなくする                                                                                                 |
| `name`            | `name`              | `string`                 | `''`                          | フォームで送るときの名前。送る値は `value`（キー）                                                                                    |
| `required`        | `required`          | `boolean`                | `false`                       | 空ならフォームの検査で弾く                                                                                                            |
| `maxLength`       | `maxlength`         | `number`                 | `-1`                          | `value`（キーで書いた値）の文字数の上限。超えると検査で弾く（入力は止めない）                                                         |
| `autocomplete`    | `autocomplete`      | `string`                 | `''`                          | 中の欄の `autocomplete`                                                                                                               |
| `accessibleName`  | `aria-label`        | `string`                 | `''`                          | 中の欄に写す（`<label for>` で名前を付けられないとき）                                                                                |
| `describedBy`     | `aria-describedby`  | `string`                 | `''`                          | 中の欄に写す（説明・エラー表示の id）                                                                                                 |
| `invalid`         | `aria-invalid`      | `string`                 | `''`                          | 中の欄に写す                                                                                                                          |
| `locale`          | `locale`            | `'ja' \| 'en'`           | `'ja'`                        | 文言の言語                                                                                                                            |
| `messages`        | —                   | `Record<string, string>` | `{}`                          | 文言の部分上書き（`mergeTag.insert`・`mergeTag.search`・`mergeTag.empty`・`mergeTag.other`・`mergeTag.required`・`mergeTag.tooLong`） |

イベントは `bubbles: true` の `CustomEvent` です（`composed` ではないので、エディタの設定欄の入力欄のイベントはエディタの外に出ません）。

| イベント               | `detail`    | いつ                                                                                                                                     |
| ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `mm-value-input`       | `{ value }` | 入力のたび（候補を選んで入れたときも）。`value` はキーで書く                                                                             |
| `mm-value-change`      | `{ value }` | 値を確定したとき（中の欄の `change` と同じ時機）                                                                                         |
| `mm-unknown-merge-tag` | `{ keys }`  | 確定した値に `tags` に無い差し込み変数があるとき（`tags` が空なら出さない）。`{{未知の変数}}` のようにキーに使えない文字を含むものも入る |

表示名とキーの行き来の決まり（`display-labels`。エディタの中と同じ）:

- 表示名で手で打っても、表示名と一致すれば `value` ではキーに戻す
- どの表示名・キーにも一致しない `{{…}}` は、打ったまま `value` に入れる
- 次の候補は表示名で見せず、キーのまま見せる（キーに戻せなくなるため）: `label` が他の候補と同じ、他の候補の `key` と同じ、区切り文字や改行を含む、空

メソッド `insertText(text)` で、カーソル位置（選択していればその範囲）に文字を入れられます（入力と同じくイベントを出す）。

フォームの部品として振る舞います（form-associated custom element）。`<form>` の中に置くと `name` の値が送られ、`required`・`maxlength` で検査し、フォームのリセット（`value` 属性の値に戻る）と `<fieldset disabled>` も効きます。`form`・`validity`・`validationMessage`・`willValidate`・`checkValidity()`・`reportValidity()` を使えます。検査の文言は `mergeTag.required`・`mergeTag.tooLong` で上書きできます。

入力中の候補は、中の欄を `role="combobox"` にし、`aria-expanded`・`aria-controls`・`aria-activedescendant` で一覧と選択中の候補を指します（画面読み上げで選べる）。

見た目は `--mm-color-*` `--mm-radius` `--mm-font-family` `--mm-font-size` で変えられます（エディタの外でも初期値があります）。入力中に出す候補の一覧の幅は `--mm-suggest-width`（既定 260px）。中の要素は次の class で指せます: `.mm-text-input-row`（欄とボタンの並び）、`.mm-text-input-field`（中の `input` / `textarea`）、`.mm-text-input-suggest`（入力中の候補）。

```html
<label for="subject">件名</label>
<mm-text-input id="subject-field" input-id="subject" display-labels></mm-text-input>

<script type="module">
  import '@hidemikimura/mailmason';

  const field = document.getElementById('subject-field');
  field.tags = mergeTags; // MergeTag[]
  field.value = 'ご注文ありがとうございます（{{order.id}}）'; // 欄には {{注文番号}} と見える
  field.addEventListener('mm-value-change', (e) => save(e.detail.value)); // キーで受け取る
</script>
```

## `@hidemikimura/mailmason/core`（Node でも動く）

| 関数                                                                                       | 内容                                                                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `renderHtml(template, options?)`                                                           | 配信用 HTML                                                                                     |
| `renderText(template, options?)`                                                           | 自動生成のテキストパート                                                                        |
| `resolveTextPart(template, options?)`                                                      | `{ text, mode, stale, staleBlockIds, unknownRefs }`。手直しがあればそれを使う（配信にはこちら） |
| `validate(json)`                                                                           | `{ valid, warnings, error }`。例外を投げない                                                    |
| `migrate(json, { mergeTagDelimiters })`                                                    | `{ template, warnings }`。正規化したテンプレート（不正なら例外）                                |
| `createTemplate(theme?)` / `createRow(layout, blocks?)` / `createBlock(type, values?)`     | 部品を作る                                                                                      |
| `findMergeTags(template)` / `replaceMergeTags(text, values)`                               | マージタグの列挙・置換                                                                          |
| `sanitizeHtml(html)`                                                                       | テキストブロック用に HTML を許可タグへ整える                                                    |
| `defineBlock(definition)`                                                                  | カスタムブロックを定義する（下記）                                                              |
| `extractComponent(template, id, { name })` / `instantiateComponent(component, { blocks })` | 行・ブロックをコンポーネントとして切り出す / 新しい ID の行・ブロックにする                     |

`renderHtml` / `renderText` / `resolveTextPart` / `migrate` / `validate` / `findMergeTags` / `createBlock` / `createStore` は `blocks` オプションでカスタムブロックの定義を受け取ります（渡さないと未知のブロックとして出力しない）。

### カスタムブロック（`defineBlock`）

```js
import { defineBlock } from '@hidemikimura/mailmason/core';

const couponBlock = defineBlock({
  type: 'acme-coupon', // 英小文字・数字・ハイフン。ハイフンを 1 つ以上含む
  label: { ja: 'クーポン', en: 'Coupon' },
  icon: '<svg viewBox="0 0 24 24">…</svg>', // 省略可
  fields: [
    { key: 'code', kind: 'text', label: 'コード', default: 'AUTUMN2026', mergeTags: true },
    {
      key: 'items',
      kind: 'list',
      label: '商品',
      fields: [{ key: 'name', kind: 'text', label: '商品名' }],
    },
    {
      kind: 'action',
      label: '商品を選ぶ…',
      run: async ({ values, blockId, locale }) => ({/* values に入れる値 */}),
    },
    { key: 'product', kind: 'element', label: '商品', tagName: 'acme-product-picker' },
  ],
  renderHtml: (values, ctx) => `<p>${ctx.escape(values.code)}</p>`, // 空なら出力しない
  renderText: (values) => values.code, // 省略可
});

editor.blocks = [couponBlock]; // エディタ
renderHtml(template, { blocks: [couponBlock] }); // サーバー
```

- `kind`: `text` / `textarea` / `url` / `number` / `color` / `select` / `align` / `toggle` / `image`（`{ src, alt, naturalWidth, naturalHeight, uploadData }`）/ `list`（項目の配列、`fields`・`min`・`max`・`itemLabel`）/ `action`（ボタン。`run` が返した値を values にマージ）/ `element`（カスタム要素。`value`・`values`・`locale`・`blockId` を渡し、`mm-field-change` イベントの `detail.value` を受け取る）
- 共通: `key`・`label`・`help`・`default`・`visible(values)`、`mergeTags`（差し込み変数）、number の `min`・`max`・`step`・`unit`・`integer`・`nullable`、select / align の `choices: [{ value, label }]`
- `renderHtml` の `ctx`: `width`・`body`・`blockId`・`locale`・`escape()`・`escapeAttr()`・`text()`（改行を `<br />`）・`image({ src, alt, href, width, … })`・`button({ label, href, backgroundColor, … })`
- 入力値のエスケープは定義側で行う。出力はテーブル＋インライン CSS で書き、縦積みしたいセルには `class="mm-col"` を付ける
- 定義が不正なら `MailmasonError`（`invalid-block-definition`）

型（`Template`・`Block`・`RenderHtmlOptions` など）も同じパスから import できます。TypeScript の型定義を同梱しており、`Block` は `block.type` で絞り込むと `values` の型（`TableValues` など。`BlockValuesMap` / `BlockOf<'table'>`）が決まり、`<mailmason-editor>` のイベントの `detail` にも型が付きます（`MailmasonEditorEventMap`・`MmTextInputEventMap`）。
