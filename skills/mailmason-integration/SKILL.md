---
name: mailmason-integration
description: Mailmason（@hidemikimura/mailmason、<mailmason-editor>）をアプリに組み込むときに使う。インストール、プロパティ・メソッド・イベント、画像のアップロード（onImageUpload）、差し込み変数、保存と読み込み、HTML・テキストの書き出し、React / Vue / 素の HTML での使い方、見た目の調整。Use when embedding the Mailmason no-code HTML email editor web component into an app.
---

# Mailmason をアプリに組み込む

Mailmason は Lit 製のノーコード HTML メールエディタです。カスタム要素 `<mailmason-editor>` を置くと、行 × カラムのドラッグ&ドロップでメールを作れます。出力は次の 2 つです。

- テーブル＋インライン CSS の HTML（Outlook デスクトップを含む主要メーラー向け）
- マルチパート配信用のテキストパート（自動生成。利用者が手で直すこともできる）

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
7. 送信: `editor.export({ html: { minify: true } })` で `{ html, text }` を得て、マルチパート（text/plain と text/html）で送る。

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

- **画像は公開 URL にする。** エディタは画像を保存しない。`onImageUpload` でサーバーやストレージに置き、URL を返す。data URL（base64）の画像は Gmail や Outlook で表示されないので返さない。`onImageUpload` が無ければアップロードの操作は出ない（URL の手入力と `onImageSelect` は使える）。
- **差し込み変数は既定で `{{key}}`。** `mergeTags` に候補を渡すと、エディタのメニューに出て、未定義のキーは `mm-warning`（`unknown-merge-tag`）で知らせる。`sample` はプレビュー用、`fallback` は `exportHtml({ mergeValues })` で値が無いときの既定値。`mergeValues` を渡さなければタグのまま書き出すので、配信システム側で差し込める。
- **本番配信は `minify: true`。** Gmail は約 102KB を超えると本文を省略する。90KB を超えると `mm-warning`（`html-size`）が出る。
- **テキストパートは `exportText()` を使う。** 利用者が手で直していればその内容、無ければ自動生成を返す。手直しの後に本文が変わると `stale-text` の警告が出る。
- **テンプレートを外で変更したら `loadJson` で読み込み直す。** `getJson()` はコピーを返し、`mm-change` の `detail.template` は変更してはいけない（イミュータブル）。`loadJson` は履歴をクリアし、`mm-change` を発火しない。
- **ホスト側でキーボードショートカットを奪わない。** エディタは Ctrl/⌘+Z・Y・D・V、Delete、Alt+↑/↓、Enter、Esc を使う。
- **サーバーで HTML を作るなら `@hidemikimura/mailmason/core`。** DOM に依存しないので Node で動く（`renderHtml` / `renderText` / `resolveTextPart` / `validate`）。エディタ本体（ルートの `@hidemikimura/mailmason`）は Node では import しない。

## よく使う API（抜粋）

| 種類       | 名前                                                              | 内容                                                                  |
| ---------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| プロパティ | `mergeTags` / `mergeTagDelimiters`                                | 差し込み変数の候補と区切り                                            |
| プロパティ | `onImageUpload` / `onImageSelect`                                 | 画像のアップロード / 自前の画像選択画面。URL か `{ src, alt }` を返す |
| プロパティ | `theme`                                                           | 新規テンプレートの既定デザイン（`BodySettings` の一部）               |
| プロパティ | `locale` / `messages`                                             | `'ja'` / `'en'` と UI 文言の部分上書き                                |
| 属性       | `color-mode` / `view` / `preview-device`                          | UI の配色、編集 ⇄ プレビュー、PC ⇄ スマホ                             |
| メソッド   | `loadJson(json)` / `getJson()`                                    | 読み込み（警告を返す）/ コピーを取得                                  |
| メソッド   | `exportHtml(o)` / `exportText(o)` / `export(o)`                   | 書き出し                                                              |
| メソッド   | `undo()` / `redo()` / `select(id)`                                | 履歴と選択                                                            |
| イベント   | `mm-change` / `mm-warning` / `mm-select` / `mm-ready` / `mm-view` | 変更・警告・選択・準備完了・表示切替                                  |

全項目と型は [references/api.md](references/api.md) にあります。

## 確認

- ブラウザのコンソールに `mm-warning` を出して、読み込み時の補正や未定義のマージタグが無いか確かめる。
- 書き出した HTML を実際のメールソフトで確認する（Outlook デスクトップは特に崩れやすい）。リポジトリの `npm run samples` で `.eml` を作れる。
