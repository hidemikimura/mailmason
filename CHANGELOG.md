# 変更履歴

このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に従います。1.0.0 までは、マイナーバージョンで互換性の無い変更を含むことがあります。

## 0.6.0 - 2026-09-25

表ブロックで、セルの結合・行と列の並べ替え・スマホでの縦並びができるようになりました。行とブロックを PC では隠す（スマホだけに出す）設定と、スマホだけの文字サイズを追加しました。Google Fonts などの Web フォントを使えるようにしました。

### 互換性

- 表ブロックの値に `merges`（結合したセル）と `mobileLayout`（スマホでの表示）が加わりました。項目の無い古いテンプレートは警告なしで既定値（結合なし・表のまま）を補うため、`getJson()` の結果や保存する JSON にはこの項目が入ります。結合も縦並びも使わなければ、表の出力は変わりません
- 0.6.0 で保存したテンプレートを 0.5.x 以前で読み込むと、新しい項目（表の `merges`・`mobileLayout`、ボディの `mobileFontSize`・`webFonts`、ブロックの `mobileFontSize`）は未知の項目（`unknown-key`）の警告になって取り除かれ、結合・縦並び・スマホの文字サイズ・Web フォントは使われません
- 出力 HTML の `<style>` のメディアクエリに `.mm-show-mobile` と `.mm-hide-desktop` の規則が加わりました
- `hideOn` に `"desktop"`（PC では表示しない）が加わりました。0.5.x 以前で読み込むと不正な値として警告になり、`null`（すべてに表示）に直ります
- ボディの設定に `mobileFontSize`、テキスト・ボタン・ボタンの並び・メニュー・表の値に `mobileFontSize` が加わりました。項目の無い古いテンプレートは警告なしで `null`（PC と同じ）を補います。使わなければ出力は変わりません
- 設定パネルの「スマホでは表示しない」（チェックボックス）を、「表示する画面」（すべて / PC だけ / スマホだけ）に変えました
- ボディの設定に `webFonts` が加わりました。項目の無い古いテンプレートは警告なしで `[]` を補います。Web フォントを使わなければ出力は変わりません
- 全体設定とテキストブロックの「フォント」を、自由入力の欄から選択（端末のフォント・Web フォント・直接入力）に変えました

### 追加

- 表のセルの結合: 縦・横に結合できる（`colspan` / `rowspan`）。キャンバスで `Shift` を押しながらセルをクリックして範囲を選び、表の下の「セルを結合」「結合を解除」で操作する。空でないセルの内容は改行でつなぐ。行・列の挿入と削除は結合に合わせて直す。値の型 `TableMerge`
- 表の行と列の並べ替え: 表の下の「行を上へ」「行を下へ」「列を左へ」「列を右へ」と、編集中のセルの行・列の端に出るつまみのドラッグで移動できる（列の幅と揃えもいっしょに動く）。縦に結合したセルの行（横に結合したセルの列）はまとめて動く
- 表の「スマホでの表示」（`mobileLayout`）: 「縦に並べる」（`'stack'`）にすると、スマホでは 1 行ずつ「見出し：値」の縦並びにする。表と縦並びの両方を出力してメディアクエリで切り替えるため、Outlook（Windows）とメディアクエリに対応しないメールソフトでは表のまま表示する
- 行とブロックの「表示する画面」に「スマホだけ」（`hideOn: "desktop"`）を追加。PC では隠し、メディアクエリでスマホのときだけ表示する。Outlook（Windows）とメディアクエリに対応しないメールソフトでは表示されないため、設定パネルに注意を出す。キャンバスには「PC 非表示」のバッジを付ける。値の型 `HideOn`
- スマホの文字サイズ: 全体設定の「スマホの文字サイズ」（`body.settings.mobileFontSize`）と、テキスト・ボタン・ボタンの並び・メニュー・表の「スマホの文字サイズ」（`mobileFontSize`）。要素にクラスを付けてメディアクエリで文字サイズと行の高さを上書きする。全体の設定は、文字サイズを指定していないテキスト・表・画像＋テキスト・SNS のテキストリンクに効き、見出しは本文との比を保つ
- Web フォント: 全体設定の「Web フォント」で、Google Fonts の候補（日本語のゴシック体・明朝体と欧文）か URL を指定して追加し、全体設定とテキストブロックの「フォント」で選べる。`fontFamily` で名前を使ったものだけ、出力 HTML の head で `<link>` と `@import` で読み込む（Outlook（Windows）には出さない）。キャンバスでも読み込んで表示し、設定欄に表示されないメールソフトで使うフォントを出す。プレビューの「Web フォント」をオフにすると、読み込まないメールソフトでの見え方を確かめられる。テンプレート JSON は `body.settings.webFonts`（`{ family, url }`、https のみ）、値の型 `WebFont`。`renderHtml` のオプション `webFonts: false` で読み込みを出さない。エディタのプロパティ `webFontOptions` で候補を変えられる（型 `WebFontOption`）
- ガイドに「スマホでの表示」「フォント」を追加
- `kitchen-sink` フィクスチャの最初のテキストに Web フォント（Noto Serif JP）を使った
- テストとドキュメントのサンプルに `tables` フィクスチャ（料金表、スマホだけの注記とスマホの文字サイズを含む）を追加

### 変更

- 表の行・列の削除は、結合したセル（または `Shift` で選んだ範囲）の行・列をまとめて消す
- テキストパートの表: 横に結合したセルは 1 つにまとめ、縦に結合したセルは各行に同じ値を出す

## 0.5.0 - 2026-09-25

背景画像を追加し、差し込み変数の候補を選びやすくしました。

### 互換性

- 背景画像を使ったテンプレートを 0.4.x 以前で読み込むと、未知の項目（`unknown-key`）の警告になり、背景画像は取り除かれます
- テンプレート JSON のボディ・行・カラムの設定に `backgroundImage`（本文は `contentBackgroundImage` も）が加わりました。項目の無い古いテンプレートは警告なしで既定値（`src` が空＝背景画像なし）を補うため、`getJson()` の結果や保存する JSON にはこの項目が入ります。背景画像を使わなければ、出力 HTML は変わりません
- `onImageUpload` の 2 つ目の引数に `target`（`'block'` / `'row'` / `'column'` / `'body'`）が加わりました。背景画像のアップロードでは `blockId` に行・カラムの ID（メール全体は `'body'`）が入ります

### 追加

- 背景画像: メール全体の外側（`body.settings.backgroundImage`）・本文（`contentBackgroundImage`）・行・カラム（`settings.backgroundImage`）に背景画像を敷ける。サイズ（全面を覆う / 全体を入れる / 原寸）・位置（9 か所）・繰り返しを設定でき、`onImageUpload` でアップロードもできる（フックの 2 つ目の引数に `target` を追加。背景画像では `blockId` が行・カラムの ID、メール全体は `'body'`）。一般のメールソフトは CSS と `background` 属性、Outlook（Windows）は VML で表示する（外側は `v:background`）。Outlook では VML を入れ子にできないため、背景画像のある要素の中の背景画像は背景色になる。値の型 `BackgroundImage`
- 差し込み変数の候補に `group`（グループ名）を追加。候補の一覧でグループごとにまとめる（グループの無い候補は「その他」）
- 区切り開始文字（既定 `{{`）を入力すると、その場に差し込み変数の候補を出す。続けて入力した文字で絞り込み、上下キーと Enter / Tab で選ぶと入力中の文字ごとタグに置き換える（Esc で閉じる）。キャンバスの本文・画像＋テキスト・表のセルと、設定欄の差し込み変数を使える入力欄で使える。プロパティ `mergeTagTrigger`（属性 `merge-tag-trigger`、既定 `true`）でオフにできる

### 変更

- 書式ツールバーと設定欄の「差し込み…」を、セレクトボックスから絞り込みのできるコンボボックスにした。グループ名・名前・キーで絞り込み、上下キーと Enter で選ぶ
- デモの差し込み変数をグループ分けし、候補を増やした
- デモとドキュメントサイトのサンプルに「背景画像」を追加し、`npm run samples` / `samples:send` の既定に `backgrounds` を加えた

### 修正

- 日本語入力（IME）で変換を確定する Enter で、差し込み変数の候補（コンボボックス・入力中の候補）が選ばれてしまう問題を修正。変換中のキー操作（Safari の確定の Enter を含む）は、候補の操作やエディタのショートカット（Esc で編集を終えるなど）に使わない

## 0.4.0 - 2026-09-24

表・メニュー・ボタンの並び・画像ギャラリー・動画のブロックを追加し、TypeScript の型定義を手書きのものにしました。実行時の動作に互換性の無い変更はありません。

### 互換性

- 型定義: `Block` をブロックの種類ごとの型のユニオンにしたため、`block.values.xxx` を `block.type` で絞り込まずに使っていると型エラーになります（実行時の動作は変わりません）
- 新しいブロックを使ったテンプレートを 0.3.x 以前で読み込むと、未知のブロック（`unknown-block-type`、データは残して出力しない）の警告になります
- 出力 HTML の `<style>`（メディアクエリ）に `.mm-stack-gap` / `.mm-fluid` / `.mm-video-*` のクラスが加わりました

### 追加

- 表のブロック（`table`）。セルは段落を持たないリッチテキスト（太字・斜体・下線・取り消し線・リンク・文字色・改行・差し込み変数）で、キャンバス上で直接編集する（クリックしたセルを編集、Tab / Shift+Tab でセルを移動、最後のセルで Tab を押すと行を追加、表の下のボタンで行・列の挿入と削除）。見出し行（`th`）・しま模様・罫線・セルの余白・文字サイズ・文字色、列ごとの幅（%）と揃えを設定できる。列は 8、行は 50 まで。テキストパートは `|` 区切り。出力はデータの表として `role="presentation"` を付けない（目印は `class="mm-table"`）
- メニューのブロック（`menu`）。リンクを区切り文字でつないで 1 行に並べる（ヘッダー・フッターのナビゲーション）
- ボタンの並びのブロック（`buttons`）。複数のボタンを横に並べ、スマホでは縦に並べられる。見た目は共通で色はボタンごと。幅をそろえることもできる
- 画像ギャラリーのブロック（`gallery`）。画像を 2〜4 列の格子に並べ、画像ごとにリンクを付けられる。スマホで 1 列に並べることもできる
- 動画のブロック（`video`）。サムネイルに再生ボタン（黒・白・なし）を重ねて動画のページにリンクする。サムネイルはセルの背景に敷き（Outlook は VML）、縦横比（16:9 / 4:3 / 1:1）でトリミングする。スマホでは画面幅に合わせて高さを変える。YouTube の URL を入れるとサムネイルを自動で入れる。core に `youtubeVideoId` / `youtubeThumbnail`
- エディタの設定パネルで、標準ブロックにも繰り返しの項目（`list`）を使う（メニュー・ボタンの並び・画像ギャラリー）
- ドキュメントサイトに「ブロック」のページを追加し、デモに「表・動画・ギャラリー」のサンプルを追加

### 変更

- TypeScript の型定義（`types/`）を、JSDoc からの自動生成から手書きに変えた。公開 API だけを定義し、内部の状態（`_store` など）は出さない
  - 標準ブロックの `values` の型（`TextValues`・`TableValues` など 14 種類、`BlockValuesMap`・`BlockOf<'table'>`）。`Block` は `block.type` で絞り込める（カスタムブロックは type にハイフンを含む `CustomBlockData`）
  - `createBlock('table', { … })` は標準ブロックの値を検査する（`DeepPartial`）
  - `<mailmason-editor>` のイベント（`MailmasonEditorEventMap`。`mm-change` などの `detail`）と `HTMLElementTagNameMap`。`colorMode` などを文字列のユニオンに
  - 警告コード（`WarningCode`）・エラーコード（`MailmasonErrorCode`）、`EditorWarning`、コマンドとストアの型
- `npm run build:types` を廃止（`prepublishOnly` は check と build だけ）

### 開発

- 型定義の検査: `test/core/types.test.js`（export・エディタのプロパティとイベント）、`npm run types:schema`（スキーマから作った型 `test/types/schema.gen.ts` と型定義を突き合わせる）、`test/types/usage.ts`。`npm run typecheck` が `tsc -p test/types` も実行する
- テスト用フィクスチャ `content-blocks`（新しいブロック）を追加し、スナップショット・メール互換の静的チェック・`npm run samples` / `samples:send` の既定に加えた

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
