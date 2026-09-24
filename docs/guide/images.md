# 画像

メールの画像は、受信者のメールソフトが読みに行ける**公開 URL** に置く必要があります。Mailmason は画像を保存しません。URL の入れ方は次の 3 つです。

| 方法                               | 組み込み                               | 使いどころ                   |
| ---------------------------------- | -------------------------------------- | ---------------------------- |
| URL を入力                         | 不要                                   | すでにどこかに置いてある画像 |
| 「選択…」ボタン（`onImageSelect`） | 自前の画像選択画面を開いて URL を返す  | アプリに画像ライブラリがある |
| アップロード（`onImageUpload`）    | ファイルを受け取って保存し、URL を返す | 利用者の手元の画像を使う     |

::: warning data URL は使わない
画像を base64 の data URL にしてメールに埋め込むと、Gmail や Outlook では表示されません。必ずサーバーやストレージに置いた URL を返してください。
:::

## アップロードを組み込む

`onImageUpload` に、ファイルを受け取って URL を返す関数を設定します。

```js
editor.onImageUpload = async (file, { blockId }) => {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/images', { method: 'POST', body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // 設定欄に理由が表示される
  const { url } = await res.json();
  return url; // または { url, alt: '代替テキスト', data: { ... } }
};
```

設定すると、次の操作が使えるようになります。

- 画像の設定欄の「アップロード…」ボタン
- 画像の設定欄へのファイルのドロップ
- キャンバスへのドロップ（画像ブロックの上なら差し替え、行間やカラムならファイルの数だけ新しい画像ブロック）
- 画像の貼り付け（`Ctrl/⌘+V`。画像ブロックを選択中なら差し替え、それ以外なら画像ブロックを追加）

アップロード中は手元のファイルをキャンバスに仮表示します。画像の実寸（`naturalWidth` / `naturalHeight`）はアップロード前にブラウザで測るので、フックが返すのは URL だけで構いません。`null` を返すと取り消しになります。

### フックの戻り値

| 戻り値                 | 内容                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `'https://…'`          | 画像の URL                                                                                      |
| `{ url, data?, alt? }` | `data` はテンプレート JSON に保存する任意のオブジェクト。`alt` は代替テキストが空のときだけ設定 |
| `{ src, alt? }`        | 以前からの形（`url` と同じ扱い）                                                                |
| `null` / `undefined`   | 取り消し                                                                                        |

`data` には、画像の ID やストレージ上のキーなど、アプリが後で使いたい情報を入れられます（Editor.js の画像ツールが返す `file` のような使い方です）。

```js
editor.onImageUpload = async (file, { blockId }) => {
  const res = await fetch('/api/images', { method: 'POST', body: file });
  const image = await res.json(); // { id: 'img_123', url: 'https://…', key: 'uploads/…' }
  return { url: image.url, data: { id: image.id, key: image.key } };
};
```

受け取った `data` は、そのブロックの `uploadData`（画像＋テキストは `image.uploadData`、QR コードは `uploadData`）に保存されます。

```json
{
  "type": "image",
  "values": { "src": "https://…", "uploadData": { "id": "img_123", "key": "uploads/…" } }
}
```

- 中身は JSON で表せる値（文字列・数値・真偽値・null・配列・オブジェクト）だけにしてください。それ以外（関数・Date など）を含むと、読み込み時に `null` に直して警告を出します。
- `uploadData` は出力の HTML やテキストには使いません（受信者には届きません）。ただしテンプレート JSON を見られる人には見えるので、秘密の値は入れないでください。
- 画像を差し替えると置き換わります（URL の文字列だけを返したときは `null`）。設定欄で URL を手で書き換えたときも、別の画像のデータになるため `null` にします。
- `onImageSelect` も同じ形を返せます。
- フックに渡す `blockId` はテンプレート内で一意ですが、同じブロックで画像を差し替えると同じ値が渡ります。保存するファイル名はサーバー側で一意に作ってください（`blockId` をファイル名にすると、送信済みのメールの画像まで上書きしてしまいます）。
- テンプレート内の画像の `uploadData` を集めれば、使っている画像の一覧（使われていない画像の掃除など）に使えます。

### 受け付けるファイル

- 形式は **PNG・JPEG・GIF** だけです（WebP や SVG は一部のメールソフトで表示されないため）。
- 大きさの上限は既定で 5MB です。`max-image-size` 属性（バイト、0 で無制限）で変えられます。

受け付けないファイルや失敗は、設定欄に理由を表示し、`mm-warning`（`image-upload-type` / `image-upload-size` / `image-upload-failed`）で知らせます。

### QR コード

`onImageUpload` を設定すると、パレットに **QR コード** のブロックが出ます（設定していないと出ません）。

1. QR コードのブロックを置き、設定パネルの「内容」に読み取ったときに開く URL や文字列を書く
2. サイズ・誤り訂正・周りの余白・色・背景色を決める
3. 「QR コードを作成」を押すと、エディタが PNG（ファイル名 `qr.png`）を作って `onImageUpload` に渡し、返ってきた URL を画像として設定する

- PNG は表示サイズの 2 倍以上の解像度で作ります。出力は通常の画像と同じ（公開 URL の `<img>`）なので、どのメールソフトでも表示されます（data URL は Gmail で表示されないため使いません）。
- 作成後に内容や色などを変えると、設定パネルとキャンバスに「作り直し」が必要と表示し、書き出し時に `mm-warning`（`qr-stale`）を出します。まだ作成していない QR は出力されず、`qr-missing` を出します。
- 内容に差し込み変数は使えません（全員に同じ QR が届きます）。代替テキストとリンク先には使えます。
- 内容が長すぎて QR コードにできないときは、設定欄に理由を出し、`mm-warning`（`qr-too-long`）を出します。

### 署名付き URL でストレージに直接送る例

```js
editor.onImageUpload = async (file) => {
  // 1. アプリのサーバーで、アップロード用の URL と公開 URL を発行してもらう
  const { uploadUrl, publicUrl } = await fetch('/api/images/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: file.type }),
  }).then((r) => r.json());
  // 2. ストレージに直接送る
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return publicUrl;
};
```

## 自前の画像選択画面（`onImageSelect`）

```js
editor.onImageSelect = async ({ current }) => {
  const picked = await openMyImageLibrary({ selected: current }); // アプリの画面
  return picked ? { src: picked.url, alt: picked.caption } : null;
};
```

## 画像のこつ

- 代替テキスト（`alt`）を必ず入れる。画像を表示しない設定の受信者には、代わりにこの文字が出ます。
- 表示幅の 2 倍程度の解像度で用意すると、高解像度の画面でもきれいです（幅 600px のメールなら 1200px）。
- 大事な文言は画像にせず、テキストブロックで書く。

## SNS アイコン

SNS リンクのブロックは、アイコン PNG の置き場所を `social-icon-base-url` で指定するとアイコンを表示します。指定しなければテキストのリンクになります。参照するファイル名は `{base}/{service}-{color|mono}.png`（例: `https://cdn.example.com/icons/x-color.png`）です。
