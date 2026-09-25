# Mailmason

Lit ベースのノーコード HTML メールエディタです。行×カラムのドラッグ&ドロップでメールを組み立て、次の 2 つを出力します。

- 主要メーラー（Outlook デスクトップ含む）で崩れにくい、テーブル＋インライン CSS の HTML
- マルチパート配信用のテキストパート（自動生成、手編集で上書き可）

**ドキュメントとデモ: https://hidemikimura.github.io/mailmason/**

> v0.7（試用版）です。1.0 までは API が変わることがあります。変更点は [CHANGELOG.md](CHANGELOG.md) に記録します。

## インストール

```sh
npm install @hidemikimura/mailmason lit
```

Lit（3.3 以上）は peer dependency です。バンドラーを使わない場合は、Lit を同梱した単一バンドルを読み込めます。

```html
<!-- ES モジュール版 -->
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@hidemikimura/mailmason@0.7/dist/mailmason.bundle.js"
></script>
<!-- 従来の script タグ版（グローバル変数 Mailmason） -->
<script src="https://cdn.jsdelivr.net/npm/@hidemikimura/mailmason@0.7/dist/mailmason.iife.js"></script>
```

プレビュー・表の直接編集・QR コードの作成・英語の UI 文言は、使うときに読み込みます。ES モジュール版は最初に約 80KB（gzip）を読み込み、残りを `dist/chunks/` から読み込みます（自分のサーバーに置くときは `chunks/` も同じ場所に置いてください）。script タグ版はすべて 1 ファイル（約 97KB）です。

動作環境: Chrome・Edge・Firefox・Safari の最新版。画面幅は 1024px 以上を想定しています（それより狭いと、パレットと設定パネルはツールバーのボタンで開閉する重ね表示になります）。

## 使い方

```html
<script type="module">
  import '@hidemikimura/mailmason';
</script>

<mailmason-editor style="height: 100vh"></mailmason-editor>
```

```js
const editor = document.querySelector('mailmason-editor');

// sample はプレビューで差し込む値、fallback は値が無いときの既定値
editor.mergeTags = [{ key: 'name', label: '氏名', sample: '山田 太郎', fallback: 'お客様' }];
editor.onImageSelect = async ({ current }) => openMyImagePicker(current); // 画像の URL を返す
editor.onImageUpload = async (file) => {
  // ローカルの画像ファイルを自分のサーバーに送り、公開 URL を返す
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/images', { method: 'POST', body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).url;
};

editor.loadJson(savedTemplate); // 保存しておいたテンプレート JSON を読み込む
editor.addEventListener('mm-change', (e) => save(e.detail.template)); // 編集のたびに（1 フレーム 1 回まで）

const { html, text } = editor.export({ html: { minify: true } }); // 配信用の HTML とテキストパート
```

| プロパティ / 属性                  | 内容                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `theme`                            | 新規テンプレートの既定デザイン（`BodySettings` の一部）。読み込んだ JSON には適用しない            |
| `locale` / `messages`              | 表示言語（`ja` / `en`）と UI 文言の部分上書き                                                      |
| `mergeTags` / `mergeTagDelimiters` | 差し込み変数の候補（`group` でグループ分け）と区切り文字（既定 `{{` `}}`）                         |
| `mergeTagTrigger`                  | 区切り開始文字を入力したときに差し込み変数の候補を出す（既定 `true`）                              |
| `onImageSelect`                    | 画像の「選択…」ボタンで呼ぶ関数。URL（または `{ src, alt }`）を返す                                |
| `onImageUpload`                    | ローカルの画像ファイル（`File`）を受け取ってアップロードし、URL（または `{ src, alt }`）を返す関数 |
| `webFontOptions`                   | 全体設定の「Web フォントを追加」に出す候補（既定は Google Fonts。空の配列で URL の指定だけ）       |
| `max-image-size`                   | アップロードできる画像の上限（バイト、既定 5MB。0 で無制限）                                       |
| `social-icon-base-url`             | SNS アイコン PNG の置き場所（未指定ならテキストリンク）                                            |
| `outlook-font-family`              | Outlook（Windows）用のフォント                                                                     |
| `color-mode`                       | エディタ UI の配色（`light` / `dark` / `auto`）                                                    |
| `view` / `preview-device`          | 表示中の画面（`edit` / `preview`）とプレビューの幅（`desktop` 900px / `mobile` 375px）             |

| メソッド                                                          | 内容                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `loadJson(json)`                                                  | テンプレートを読み込む（直した箇所の警告を返す。履歴はクリア） |
| `getJson()`                                                       | 現在のテンプレート（コピー）                                   |
| `exportHtml(options)` / `exportText(options)` / `export(options)` | 配信用 HTML / テキストパート / 両方                            |
| `undo()` / `redo()` / `select(id)`                                | 履歴の操作と選択                                               |

| イベント     | detail                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| `mm-ready`   | なし                                                                                         |
| `mm-change`  | `{ template, actions }`（template は変更しないこと）                                         |
| `mm-select`  | `{ id, kind, ids }`（kind は `row` / `column` / `block` / `null`、ids はまとめて選んだ要素） |
| `mm-warning` | `{ code, path, message, ... }`（読込時の補正、未定義のマージタグ、HTML の大きさなど）        |
| `mm-view`    | `{ view, device }`（ツールバーで表示を切り替えたとき）                                       |

見た目は CSS カスタムプロパティ（`--mm-color-accent` など）と `::part(toolbar | palette | canvas | settings | preview)` で調整できます。ツールバーの右端には `slot="toolbar"` で要素（保存ボタンなど）を置けます。

テキスト: テキストブロックを選択してもう一度クリック（またはダブルクリック・Enter）すると、キャンバス上で直接編集できます。書式ツールバーで段落の種類・太字・斜体・下線・取り消し線・リンク・文字色・リスト・揃え・書式クリア・差し込み変数を使えます。貼り付けた HTML は許可タグだけに整えます。

プレビュー: ツールバーの「プレビュー」で、配信用 HTML を PC（900px）・スマホ（375px）の幅で確認できます。差し込み変数は `sample`（無ければ `fallback`）の値で表示します。「テキスト」タブではテキストパートを確認でき、「編集する」で手直しできます。手直しの後にメール本文を変えると、テキストを確認するよう警告を出します（`mm-warning` の `stale-text`）。

画像のアップロード: `onImageUpload` を設定すると、画像の設定欄の「アップロード…」ボタン、設定欄やキャンバスへのファイルのドロップ（画像ブロックの上なら差し替え、行間やカラムなら新しい画像ブロック）、画像の貼り付け（`Ctrl/⌘+V`）でローカルの画像を使えます。エディタは画像を保存しないため、フックでサーバーなどに置いて公開 URL（または `{ url, data }`。`data` は任意のオブジェクトで、ブロックの `uploadData` として JSON に保存されます）を返してください（data URL の画像は Gmail や Outlook で表示されません）。形式は PNG・JPEG・GIF で、実寸はアップロード前に手元で測ります。失敗したときは設定欄に理由を出し、`mm-warning`（`image-upload-failed` / `image-upload-type` / `image-upload-size`）を発火します。

コンポーネント: 行やブロックに名前を付けて保存し（`onSaveComponent`、保存先はアプリ）、パレットの「保存済み」から別のメールに複製して入れられます（`components`）。入れた後は元と連動しません。

カスタムブロック: `defineBlock()` で設定項目（テキスト・画像・リスト・外部データを入れるボタン・独自の入力欄など）と出力の関数を定義し、`editor.blocks` とサーバーの `renderHtml(template, { blocks })` に渡すと、アプリ独自のブロックを使えます。詳しくは[ドキュメント](https://hidemikimura.github.io/mailmason/guide/custom-blocks)を参照してください。

差し込み変数: 候補は「差し込み…」ボタンの一覧から、グループ名・名前・キーで絞り込んで選べます。本文や設定欄で `{{` を入力すると、その場に候補を出します（`mergeTagTrigger` でオフにできます）。

背景画像: メール全体（外側）・本文・行・カラムに背景画像を敷けます（サイズ・位置・繰り返し）。Outlook（Windows）では VML で表示します。

スマホ向けの表示: 行とブロックは「表示する画面」で PC だけ・スマホだけに出せます。全体とブロックに「スマホの文字サイズ」を設定できます（Outlook（Windows）とメディアクエリに対応しないメールソフトでは PC と同じ表示）。

Web フォント: 全体設定の「Web フォント」で Google Fonts の候補か URL を指定して追加し、「フォント」で選びます。Apple Mail・iOS メールなどで表示され、Gmail・Outlook などでは後ろに並べた端末のフォントになります。

表・メニュー・ボタンの並び・画像ギャラリー・動画: 表はセルをキャンバス上で直接編集でき（太字・リンク・文字色・改行・差し込み変数、Tab で次のセル）、行と列は表の下のボタンで増減・移動します（端のつまみのドラッグでも移動できます）。Shift+クリックで選んだ範囲のセルを結合でき、スマホでは 1 行ずつ「見出し：値」の縦並びにもできます。動画はサムネイルに再生ボタンを重ねて動画のページにリンクします（メールの中では再生できません。YouTube の URL ならサムネイルを自動で入れます）。

QR コード: `onImageUpload` を設定すると QR コードのブロックが使えます。内容（URL など）を入れて「QR コードを作成」を押すと、エディタが PNG を作ってフックでアップロードし、返った URL を画像にします。作成後に内容や色を変えると作り直しを促します（書き出し時は `mm-warning` の `qr-stale`）。

操作: パレットの項目はキャンバスへドラッグして置けます（クリックでも追加できます）。選択中の行・ブロックは、上に出るラベル（つまみ）をドラッグして移動できます。ブロックを行の上下端に落とすと、新しい行になります。

キーボード: `Ctrl/⌘+Z` 元に戻す、`Ctrl/⌘+Shift+Z`・`Ctrl+Y` やり直す、`Delete` 削除、`Ctrl/⌘+D` 複製、`Alt+↑/↓` 並べ替え、`Esc` 選択解除。`Shift`・`Ctrl/⌘`+クリックで行どうし・ブロックどうしをまとめて選べ、`Ctrl/⌘+C` / `X` / `V` で行・ブロックをコピー・切り取り・貼り付けできます（OS のクリップボードを使うので、別のメールにも貼り付けられます）。

Node など DOM の無い環境では、出力用の関数だけを `@hidemikimura/mailmason/core` から使えます。

```js
import { renderHtml, renderText, resolveTextPart, validate } from '@hidemikimura/mailmason/core';

const html = renderHtml(savedTemplate, { minify: true }); // 本番配信は minify 推奨（Gmail の約 102KB 制限）
const { text } = resolveTextPart(savedTemplate); // 手編集があればそれを、無ければ自動生成を使う
const { warnings } = validate(savedTemplate); // 読込時に直した箇所の一覧
```

- マージタグ（既定 `{{name}}`）はそのまま出力します。値を入れたいときは `mergeValues` を渡します。エディタの `exportHtml` / `exportText` では、`mergeValues` に無いキーに `mergeTags` の `fallback` を使います
- SNS ブロックのアイコンを出すには、PNG を置いた場所を `socialIconBaseUrl` で指定します（`{base}/{service}-{color|mono}.png` を参照します）。指定が無ければテキストリンクになります
- Outlook（Windows）は最初のフォントが無いと明朝体になるため、`outlookFontFamily`（既定 `Arial, sans-serif`）を別に指定できます

出力 HTML の互換性は自動テストで検査していますが、公開前には実際のメールソフトでも確認してください。手順と確認項目は [docs/client-checklist.md](docs/client-checklist.md) にあります（`npm run samples` で確認用の `.eml` などを書き出し、`npm run samples:send` で実際のメールソフトにテストメールを送れます）。

## 開発

必要なもの: Node.js 22.12 以上

```sh
npm install
npm run setup:browser   # エディタのテストに使う Chromium を取得（初回のみ。Firefox・Safari も使うなら setup:browser:all）
npm run dev             # デモ（demo/）を開発サーバーで開く
```

| コマンド                  | 内容                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`             | デモを開発サーバーで起動                                                   |
| `npm run build`           | Lit を同梱したバンドル（`dist/`。ES モジュール版と script タグ版）を生成   |
| `npm run size`            | バンドルの大きさ（gzip）を表示し、上限を超えていないか確かめる             |
| `npm run types:schema`    | 型定義の検査用ファイル（`test/types/schema.gen.ts`）をスキーマから作り直す |
| `npm run lint`            | ESLint                                                                     |
| `npm run format`          | Prettier で整形                                                            |
| `npm run typecheck`       | JSDoc の型検査と、型定義（`types/`）の検査（`test/types`）                 |
| `npm test`                | 全テスト（core は Node、editor は Chromium）                               |
| `npm run test:editor:all` | エディタのテストを Chromium・Firefox・WebKit（Safari）で実行               |
| `npm run check`           | lint・整形・型検査・テストをまとめて実行                                   |
| `npm run samples`         | 実機確認用のサンプル（HTML・テキスト・.eml）を `samples/` に書き出す       |
| `npm run samples:send`    | テストメールを SMTP で送る（設定は `.env.samples`）                        |

### ディレクトリ

- `src/core/` — DOM と Lit に依存しない部分（データモデル、出力）。Node でも動く
- `src/editor/` — Lit 製のエディタ UI
- `demo/` — 開発用デモ
- `scripts/` — 開発用のスクリプト（サンプルの書き出し・送信、リファレンスの生成）
- `docs/` — メールクライアントでの確認手順
- `types/` — TypeScript の型定義（手書き。公開 API を変えたら合わせて直す）
- `test/core/`, `test/editor/`, `test/types/` — テスト（`test/types` は型定義の検査）

`src/core` から `lit` や `document` などの DOM を使うと ESLint がエラーにします。

### ドキュメントサイト

`docs/` は VitePress のサイトです。`main` ブランチに push すると GitHub Actions（`.github/workflows/docs.yml`）でビルドし、GitHub Pages に公開します（リポジトリの Settings > Pages で Source を「GitHub Actions」にしておく）。

```sh
npm run docs:dev        # 開発サーバー
npm run docs:build      # docs/.vitepress/dist にビルド
npm run docs:reference  # テンプレート JSON のリファレンスをスキーマから作り直す
```

`docs/reference/template.md` と `skills/mailmason-templates/references/schema.md` は自動生成です。スキーマを変えたら `npm run docs:reference` を実行してください（古いままだとテストが失敗します）。

### 型定義

`types/index.d.ts`（エディタ）と `types/core/index.d.ts`（core）は手書きです。公開 API やブロックの値を変えたら、型定義も直してください。ずれは次の検査で見つかります。

- `npm test` の `test/core/types.test.js`: export の一覧、エディタのプロパティとイベントが型定義と合っているか
- `npm run typecheck` の `test/types`: スキーマから作った型（`npm run types:schema` で `test/types/schema.gen.ts` を作り直す）と型定義が同じか、使用例（`test/types/usage.ts`）が通るか

### AI 用スキル

`skills/` に AI コーディングエージェント向けの Agent Skills（組み込み用・テンプレート作成用）があり、npm パッケージにも同梱しています。使い方は [skills/README.md](skills/README.md) を参照してください。

### 公開

```sh
npm login
npm publish   # prepublishOnly で check・build を実行してから公開する
```

手順の詳細（バージョンを上げる箇所、確認、タグ）は [RELEASING.md](RELEASING.md) にあります。`npm pack --dry-run` で同梱されるファイルを確認できます。

## ライセンス

MIT

不具合の報告や要望は [GitHub の Issues](https://github.com/hidemikimura/mailmason/issues) へお願いします。
