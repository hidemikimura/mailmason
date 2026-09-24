# 変更履歴

このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に従います。1.0.0 までは、マイナーバージョンで互換性の無い変更を含むことがあります。

## 0.3.0 - 2026-09-24

カスタムブロック、コンポーネント（保存した行・ブロック）、QR コードのブロックを追加しました。互換性の無い変更はありません。

### 互換性

- 0.3.0 で保存したテンプレートのうち、QR コード・カスタムブロック・画像の `uploadData` を使っているものを 0.2.x 以前で読み込むと、未知のブロック（`unknown-block-type`、データは残して出力しない）や未知の項目（`unknown-key`、取り除く）の警告になります。0.3.0 以降で読み込んでください
- 依存パッケージに `qrcode-generator` が加わり、単一バンドル（`dist/`）が大きくなりました

### 追加

- QR コードのブロック（`qr`）。内容（URL・文字列）・サイズ・誤り訂正・余白・色を設定し、「QR コードを作成」でエディタが PNG を作って `onImageUpload` でアップロード、返った URL を画像にする（`onImageUpload` が無いとパレットに出ない）。作成後に設定が変わると設定パネルとキャンバスで作り直しを促し、書き出し時に `mm-warning`（`qr-missing` / `qr-stale`）を出す。内容に差し込み変数は使えない
- `@hidemikimura/mailmason/core` に `qrSignature` / `qrStatus`
- 依存パッケージに `qrcode-generator`（MIT）を追加
- `onImageUpload` / `onImageSelect` が `{ url, data?, alt? }` を返せるようにし、`data`（任意のオブジェクト）を画像・画像＋テキスト・QR コードの `uploadData` としてテンプレート JSON に保存する。画像を差し替えると置き換わり、URL を手で書き換えると `null` になる。出力には使わない。型 `ImageResult` を export
- テンプレートの値の更新（`updateBlockValues` など）で、任意のオブジェクトの項目はマージせずに置き換える
- カスタムブロック: `defineBlock()`（`@hidemikimura/mailmason/core`）で設定項目と出力の関数を定義し、エディタの `blocks` プロパティと、`renderHtml` / `renderText` / `resolveTextPart` / `migrate` / `validate` / `findMergeTags` / `createBlock` / `createStore` の `blocks` オプションに渡す。設定項目は text / textarea / url / number / color / select / align / toggle / image / list（繰り返し）/ action（利用者の処理で値を入れるボタン）/ element（利用者のカスタム要素）。`renderHtml` には escape・image・button などの道具を渡す。`mm-warning` に `block-action-failed`。型 `CustomBlock` / `CustomBlockInput` / `CustomField` / `CustomHtmlContext` を export
- コンポーネント（保存した行・ブロック）: 設定パネルの「コンポーネントとして保存」で行・ブロックに名前を付けて `onSaveComponent` に渡し（保存先はアプリ）、パレットの「保存済み」タブ（`components`）からクリック・ドラッグで別のメールに複製して入れる。入れた後は元と連動しない。`onDeleteComponent`、メソッド `insertComponent`、`mm-warning` に `component-save-failed` / `component-delete-failed` / `invalid-component`。core に `extractComponent` / `instantiateComponent` / `componentKindOf`、型 `Component` / `SaveComponentHook` / `DeleteComponentHook`
- ドキュメントサイトに「コンポーネント」「カスタムブロック」のページを追加し、デモにクーポンと商品リストのカスタムブロックと、ブラウザに保存するコンポーネントの保存先を追加
- AI 用スキルの `validate.mjs` に `--blocks`（カスタムブロックの定義を渡す）

### 変更

- テキストの書式ツールバーのリンク: リンクの中にキャレットを置いて（または一部を選んで）開くと、設定済みの URL を入力欄に表示する。適用するとリンク全体の URL を差し替える（キャレットだけのときに URL の文字が挿入されたり、一部だけ選んだときにリンクが分かれたりしない）。空にして適用するとリンク全体を外す

### 開発

- `npm run samples:send`: テンプレートを実際のメールソフトに送って確認するスクリプト（SMTP の設定は `.env.samples`、`--dry-run` で `.eml` の書き出しのみ）。画像はドキュメントサイトのサンプル画像に差し替え、送る前に読めるか確かめる。`--embed` で画像をメールに埋め込める
- ドキュメントサイトのサンプル画像を JPEG・PNG でも用意し、デモも JPEG・PNG を使うように変更（書き出した HTML をそのままメールで送れる）

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
