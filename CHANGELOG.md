# 変更履歴

このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に従います。1.0.0 までは、マイナーバージョンで互換性の無い変更を含むことがあります。

## 0.2.0 - 2026-09-24

画像のアップロードに対応し、ドキュメントサイトと AI 用のスキルを用意しました。互換性の無い変更はありません。

### 追加

- 画像のアップロード: `onImageUpload(file, { blockId })` フックと `max-image-size` 属性（既定 5MB）。設定欄の「アップロード…」ボタン、設定欄・キャンバスへのファイルのドロップ（画像ブロックの上なら差し替え、行間・カラムなら新しい画像ブロック）、画像の貼り付け（`Ctrl/⌘+V`）に対応。保存はフックが担当し、公開 URL を返す。形式は PNG・JPEG・GIF。アップロード中は手元のファイルを仮表示し、実寸を測って設定する
- `mm-warning` の警告コード `image-upload-failed` / `image-upload-type` / `image-upload-size`
- 型 `ImageUploadHook` を `@hidemikimura/mailmason` から export
- AI 用の Agent Skills を npm パッケージに同梱（`skills/mailmason-integration`・`skills/mailmason-templates`）。テンプレートの検査スクリプト（`validate.mjs`）と例を含む
- ドキュメントサイト（https://hidemikimura.github.io/mailmason/ 、デモ付き）と llms.txt / llms-full.txt
- package.json に repository / homepage / bugs

### 変更

- キャンバスにファイルを落としたとき、ブラウザがそのファイルを開いて編集中の内容が失われないよう、ドロップを止めるようにした（`onImageUpload` を設定していなくても）

### 開発

- テンプレート JSON のリファレンス（ドキュメントとスキル）をスキーマから自動生成（`npm run docs:reference`）。古いとテストが失敗する
- リリース手順を `RELEASING.md` にまとめた

## 0.1.0 - 2026-09-24

最初の試用版。

### エディタ（`<mailmason-editor>`）

- 行 × カラム（1 / 1:1 / 1:1:1 / 1:2 / 2:1 / 1:1:1:1）とブロックでメールを組み立てる。パレットからのドラッグ&ドロップ、つまみでの移動、キーボード操作（Alt+↑/↓ ほか）
- ブロック: テキスト / 画像 / ボタン / 区切り線 / スペーサー / 画像＋テキスト / SNS リンク / HTML
- テキストはキャンバス上で直接編集（段落の種類・太字・斜体・下線・取り消し線・リンク・文字色・リスト・揃え・差し込み変数）。貼り付けは許可タグに整える
- 設定パネル、Undo / Redo（連続入力は 1 つにまとめる）、スマホで非表示
- プレビュー: PC（900px）/ スマホ（375px）、サンプル値の差し込み、テキストパートの確認と手編集、手編集が古くなったときの警告
- 画面幅 1024px 未満では、パレットと設定パネルを重ねて表示
- 日本語・英語の UI、文言の部分上書き、ライト / ダーク
- API: `loadJson` / `getJson` / `exportHtml` / `exportText` / `export` / `undo` / `redo` / `select`、イベント `mm-ready` / `mm-change` / `mm-select` / `mm-warning` / `mm-view`

### 出力（`@hidemikimura/mailmason/core`）

- `renderHtml`: テーブル＋インライン CSS、XHTML 1.0 Transitional、Outlook 用の条件付きコメントと VML ボタン、スマホでのカラムの縦積み、minify
- `renderText` / `resolveTextPart`: テンプレートからテキストパートを生成（全角文字を考慮した折り返し、手編集の優先と古さの判定）
- `migrate` / `validate`: 保存済み JSON の読み込みと補正（警告コード付き）
- マージタグ（既定 `{{name}}`、区切り文字は変更可）
