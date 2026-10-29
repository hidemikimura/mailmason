---
name: mailmason-integration
description: Mailmason（@hidemikimura/mailmason、<mailmason-editor>）をアプリに組み込むときに使う。インストール、プロパティ・メソッド・イベント、画像のアップロード（onImageUpload）、差し込み変数（エディタでは表示名で見せる）、件名など外の欄に置く差し込み変数の入力欄 <mm-text-input>、保存と読み込み、HTML・テキストパートの書き出し（textOptions、サーバーの resolveTextPart と同じ設定にする）、React / Vue / 素の HTML での使い方、見た目の調整。Use when embedding the Mailmason no-code HTML email editor web component (or its <mm-text-input> merge-tag field) into an app.
---

# Mailmason をアプリに組み込む

Mailmason は Lit 製のノーコード HTML メールエディタです。カスタム要素 `<mailmason-editor>` を置くと、行 × カラムのドラッグ&ドロップでメールを作れます。出力は次の 2 つです。

- テーブル＋インライン CSS の HTML（Outlook デスクトップを含む主要メーラー向け）
- マルチパート配信用のテキストパート（自動生成。利用者がブロックごとに扱いを変えたり、全文を手で直したりもできる）

保存する形式はテンプレート JSON だけです。HTML からテンプレートには戻せないので、**必ずテンプレート JSON を保存**し、HTML とテキストは送信やプレビューのたびに書き出してください。

詳しい API は [references/api.md](references/api.md)、フレームワークごとの例は [references/frameworks.md](references/frameworks.md) を読んでください。テンプレート JSON を直接作る・直すときは `mailmason-templates` スキルを使います。

## 手順

1. インストールする。Lit（3.3 以上）は peer dependency。

   ```sh
   npm install @hidemikimura/mailmason lit
   ```

2. `import '@hidemikimura/mailmason'` でカスタム要素が登録される（2 回 import しても安全）。ブラウザ専用なので、SSR のフレームワークではクライアント側だけで読み込む。
3. 要素に高さを与える（`height: 100%` で親いっぱいに広がる。最低 480px）。幅は 1024px 以上を想定し、狭いとパレットと設定パネルは重ね表示になる。
4. プロパティを設定する（下の最小構成）。オブジェクトや関数は属性ではなくプロパティで渡す。
5. 保存: `mm-change` で `event.detail.template` を受け取り、JSON として保存する（変更は 1 フレームに 1 回まで通知される。必要なら利用側でデバウンスする）。
6. 読み込み: `editor.loadJson(savedJson)`。直した箇所は戻り値と `mm-warning` で分かる。壊れた JSON は `MailmasonError` を投げるので try/catch する。
7. 送信: `editor.export({ html: { minify: true } })` で `{ html, text }` を得て、マルチパート（text/plain と text/html）で送る。サーバーで書き出すなら `@hidemikimura/mailmason/core` の `renderHtml` と `resolveTextPart` を使い、テキストパートの作り方（`textOptions`）をエディタと同じにする（下の「守ること」）。

## 最小構成

```html
<mailmason-editor id="editor" style="height: 100vh"></mailmason-editor>
<script type="module">
  import '@hidemikimura/mailmason';

  const editor = document.getElementById('editor');
  editor.mergeTags = [
    { key: 'name', label: '氏名', sample: '山田 太郎', fallback: 'お客様' },
    { key: 'unsubscribe_url', label: '配信停止 URL', sample: 'https://example.com/u' },
  ];
  editor.onImageUpload = async (file) => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/images', { method: 'POST', body });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).url; // 受信者が読める公開 URL
  };

  const saved = await fetch('/api/templates/1').then((r) => (r.ok ? r.json() : null));
  if (saved) editor.loadJson(saved);

  editor.addEventListener('mm-change', (e) => {
    void fetch('/api/templates/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(e.detail.template),
    });
  });
  editor.addEventListener('mm-warning', (e) => console.warn(e.detail));
</script>
```

## 守ること

- **画像は公開 URL にする。** エディタは画像を保存しない。`onImageUpload` でサーバーやストレージに置き、URL を返す。data URL（base64）の画像は Gmail や Outlook で表示されないので返さない。`onImageUpload` が無ければアップロードの操作と QR コードのブロックは出ない（URL の手入力と `onImageSelect` は使える）。QR コードもエディタが作った PNG をこのフックでアップロードする（ファイル名 `qr.png`）。
- **差し込み変数は既定で `{{key}}`。** `mergeTags` に候補を渡すと、エディタのメニューに出て、未定義のキーは `mm-warning`（`unknown-merge-tag`）で知らせる。`sample` はプレビュー用、`fallback` は `exportHtml({ mergeValues })` で値が無いときの既定値。`mergeValues` を渡さなければタグのまま書き出すので、配信システム側で差し込める。
- **エディタの中では差し込み変数を表示名（`label`）で見せる。** 利用者には `{{氏名}}` と見え、保存（`getJson()`・`mm-change`）と書き出しはキー（`{{name}}`）のまま。アプリ側で変換はしない。`label` が他の候補と重なる・他の候補の `key` と同じ・区切り文字や改行を含む候補はキーのまま見せるので、`label` は候補の中で重ならない名前にする。
- **件名・差出人名など、エディタの外の欄には `<mm-text-input>` を使う。** エディタと同じ候補・表示名・`{{` での入力補完が使える。`value` と `mm-value-input`・`mm-value-change` の `detail.value` はキーで返る。`<form>` の中で `name`・`required` も効く（api.md の「`<mm-text-input>`」）。
- **本番配信は `minify: true`。** Gmail は約 102KB を超えると本文を省略する。90KB を超えると `mm-warning`（`html-size`）が出る。
- **テキストパートは `exportText()`（サーバーでは `resolveTextPart()`）を使う。** 利用者が全文を手で直していればその内容、無ければ自動生成を返す。利用者は設定パネルの「テキストパート」で、ブロックごとに「出さない」「テキストだけ」「指定の文」も選べる（テンプレート JSON のブロック・行の `text`）。
- **テキストパートの作り方は `editor.textOptions` で決め、サーバーにも同じ値を渡す。** 例: `{ textVariant: 'desktop', textTemplates: { button: '{@label}：{@href}' } }`。プレビュー・手直しの古さの判定・`exportText()` がこれを使う。サーバーの `resolveTextPart(template, { ...textOptions, mergeValues })` に違う値を渡すと、テキストが変わり、全文の手直しが「古い」と判定される。設定はアプリの 1 か所に置いて、両方から読む。差し込みを配信システムで行うなら `wrapWidth` は 0（既定）のままにする。
- **テキストパートの警告を保存や送信の前に見る。** `stale-text`（全文の手直しなら `added`・`removed`、ブロックの指定の文なら `blockIds` 付き）、`unknown-text-ref`（指定の文の `{@名前}` の誤り）。全文編集を始める前の案内が要らなければ `textEditConfirm = false`。
- **テンプレートを外で変更したら `loadJson` で読み込み直す。** `getJson()` はコピーを返し、`mm-change` の `detail.template` は変更してはいけない（イミュータブル）。`loadJson` は履歴をクリアし、`mm-change` を発火しない。
- **ホスト側でキーボードショートカットを奪わない。** エディタは Ctrl/⌘+Z・Y・D・V、Delete、Alt+↑/↓、Enter、Esc を使う。
- **コンポーネント（保存した行・ブロック）の保存先はアプリ。** `onSaveComponent` で保存して id を付けて返し、一覧は `editor.components` に渡す。入れると複製になり、元とは連動しない。
- **カスタムブロックは `defineBlock()` で定義し、`editor.blocks` と書き出しの `blocks` オプションの両方に渡す。** 渡し忘れると未知のブロックとして出力されない。定義は core だけで書き、ブラウザとサーバーで同じファイルを import する。詳しくは api.md の「カスタムブロック」。
- **サーバーで HTML を作るなら `@hidemikimura/mailmason/core`。** DOM に依存しないので Node で動く（`renderHtml` / `renderText` / `resolveTextPart` / `validate`）。エディタ本体（ルートの `@hidemikimura/mailmason`）は Node では import しない。
- **エディタとサーバーの mailmason は同じ版にする。** テンプレート JSON には形式の版（`version`）があり、新しい版のエディタで保存したテンプレートは古い版の core では読み込めない（`unsupported-version`。0.9.0 から版 2）。
- **ESM 版（`dist/mailmason.bundle.js`）を自分のサーバーに置くときは `dist/chunks/` も同じ場所に置く。** プレビューや表の編集などは使うときに `chunks/` から読み込む。npm 版をバンドラーで使うときと、script タグ版（`dist/mailmason.iife.js`、1 ファイル）は気にしなくてよい。

## よく使う API（抜粋）

| 種類       | 名前                                                              | 内容                                                                                                                   |
| ---------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| プロパティ | `mergeTags` / `mergeTagDelimiters`                                | 差し込み変数の候補と区切り                                                                                             |
| プロパティ | `onImageUpload` / `onImageSelect`                                 | 画像のアップロード / 自前の画像選択画面。URL か `{ url, data?, alt? }` を返す（`data` は JSON の `uploadData` に保存） |
| プロパティ | `theme`                                                           | 新規テンプレートの既定デザイン（`BodySettings` の一部）                                                                |
| プロパティ | `locale` / `messages`                                             | `'ja'` / `'en'` と UI 文言の部分上書き                                                                                 |
| プロパティ | `textOptions` / `textEditConfirm`                                 | テキストパートの作り方（サーバーにも同じ値を渡す）/ 全文編集の前の案内                                                 |
| 属性       | `color-mode` / `view` / `preview-device`                          | UI の配色、編集 ⇄ プレビュー、PC ⇄ スマホ                                                                              |
| メソッド   | `loadJson(json)` / `getJson()`                                    | 読み込み（警告を返す）/ コピーを取得                                                                                   |
| メソッド   | `exportHtml(o)` / `exportText(o)` / `export(o)`                   | 書き出し                                                                                                               |
| メソッド   | `undo()` / `redo()` / `select(id)`                                | 履歴と選択                                                                                                             |
| イベント   | `mm-change` / `mm-warning` / `mm-select` / `mm-ready` / `mm-view` | 変更・警告・選択・準備完了・表示切替                                                                                   |
| 要素       | `<mm-text-input>`                                                 | 外の欄用の差し込み変数の入力欄（`tags`・`value`・`display-labels`、イベント `mm-value-change`）                        |

全項目と型は [references/api.md](references/api.md) にあります。

## 確認

- ブラウザのコンソールに `mm-warning` を出して、読み込み時の補正や未定義のマージタグ、テキストパートの警告（`stale-text`・`unknown-text-ref`）が無いか確かめる。
- エディタの `exportText()` と、サーバーの `resolveTextPart()` の結果が同じになるか確かめる（`textOptions` の渡し忘れの確認）。
- 書き出した HTML を実際のメールソフトで確認する（Outlook デスクトップは特に崩れやすい）。リポジトリの `npm run samples` で `.eml` を作れる。
