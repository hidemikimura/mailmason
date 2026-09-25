# メールクライアントでの表示確認

Mailmason の出力 HTML は、既知の落とし穴を `test/core/compat.test.js` で機械的に検査しています（整形式の XHTML、テーブルの属性、画像の width・alt、Outlook が対応しない CSS を使っていないか、など）。ただし実際の表示はメールソフトごとに違うため、公開前とレンダラーを変更したときは実機でも確認してください。

## サンプルを用意する

```sh
npm run samples                                   # テスト用フィクスチャ（basic / kitchen-sink / content-blocks / backgrounds）
npm run samples -- path/to/template.json          # 自分のテンプレート（複数指定可）
npm run samples -- --icons https://cdn.example.com/icons   # SNS アイコン PNG の置き場所を指定
```

`samples/` に次のファイルができます（Git の管理対象外）。

| ファイル          | 内容                                                            |
| ----------------- | --------------------------------------------------------------- |
| `<名前>.html`     | 整形した配信用 HTML（マージタグのまま）                         |
| `<名前>.min.html` | minify した配信用 HTML（本番配信向け）                          |
| `<名前>.txt`      | テキストパート                                                  |
| `<名前>.eml`      | HTML とテキストのマルチパートメール（サンプル値を差し込み済み） |

`.eml` は Outlook（Windows / Mac）や Apple Mail で開くと、送信しなくても受信時とほぼ同じ表示を確認できます。Gmail・Yahoo!メールなど Web メールやスマホのアプリでは、次の「テストメールを送る」で実際に届けて確認します。Litmus や Email on Acid などの確認サービスを使う場合は `.min.html` を貼り付けます。

## テストメールを送る

`npm run samples:send` は、テンプレートを HTML（minify）とテキストのマルチパートメールにして、SMTP で送ります。

- 画像の URL（`https://example.com/images/*`）は、ドキュメントサイトに置いたサンプル画像（`https://hidemikimura.github.io/mailmason/demo/` の JPEG・PNG）に差し替えます。受信側が読める公開 URL なので、どのメールソフトでも画像まで確認できます。
- マージタグにはサンプル値（`name` など）を差し込みます。
- 件名は `[Mailmason テスト 日時] テンプレートのタイトル` です。

### 1. SMTP を設定する

`.env.samples.example` を `.env.samples` にコピーして書き換えます（`.env.samples` は Git の管理対象外です。パスワードをコミットしないでください）。

```sh
cp .env.samples.example .env.samples
```

| 変数                      | 内容                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `SMTP_HOST`               | SMTP サーバー（Gmail は `smtp.gmail.com`）                 |
| `SMTP_PORT`               | ポート（既定 587。465 なら SSL で接続）                    |
| `SMTP_SECURE`             | `true` / `false` で SSL を明示する（省略時はポートで判断） |
| `SMTP_USER` / `SMTP_PASS` | ログイン情報                                               |
| `MAIL_FROM`               | 差出人（省略すると `SMTP_USER`）                           |
| `MAIL_TO`                 | 宛先（カンマ区切り）                                       |

Gmail から送る場合は、Google アカウントで 2 段階認証を有効にしてから「アプリ パスワード」を作り、`SMTP_PASS` に書きます（通常のパスワードでは送れません）。宛先には、確認したいメールソフトで受け取れるアドレス（Gmail・iCloud・Yahoo!メール・Outlook.com など）を並べます。

### 2. 送る

```sh
npm run samples:send                                  # 既定の 6 通（basic / newsletter / announcement / kitchen-sink / content-blocks / backgrounds）
npm run samples:send -- path/to/template.json          # 自分のテンプレート（複数指定可）
npm run samples:send -- --to someone@example.com       # 宛先を一時的に変える
npm run samples:send -- --dry-run                      # 送らずに samples/sent/*.eml を書き出す
npm run samples:send -- --icons https://cdn.example.com/icons   # SNS アイコン PNG の置き場所
npm run samples:send -- --image-base https://cdn.example.com/demo/   # サンプル画像の置き場所
npm run samples:send -- --embed                        # 画像を公開 URL ではなくメールに埋め込む（cid:）
```

::: tip
サンプル画像は GitHub Pages で公開しているファイルを参照します。送る前に画像の URL が読めるか確かめ、読めなければ送りません。`docs/public/demo/` の画像を追加・変更したときは、push してドキュメントサイトに反映されてから送ってください。反映を待たずに確認したいときは `--embed` で画像をメールに埋め込めます（ただし実際の配信は公開 URL の画像なので、最終確認は埋め込まずに行ってください。Gmail などは埋め込み画像を添付ファイルとしても表示することがあります）。
:::

::: warning
同じ内容のテストメールを何度も送ると、受信側で迷惑メールに振り分けられることがあります。届かないときは迷惑メールフォルダを確認し、「迷惑メールではない」にしてください。
:::

## 確認するメールソフト

| 種類    | メールソフト                                         | 主な確認点                                  |
| ------- | ---------------------------------------------------- | ------------------------------------------- |
| Windows | Outlook（従来版 2016 / 2019 / 2021 / Microsoft 365） | Word エンジンでの崩れ、VML ボタン、フォント |
| Windows | 新しい Outlook / Outlook.com                         | 余白、ダークモード                          |
| Mac     | Apple Mail、Outlook for Mac                          | 表示幅、ダークモード                        |
| iPhone  | iOS メール、Gmail アプリ                             | 縦積み、文字サイズ、スマホで非表示の要素    |
| Android | Gmail アプリ                                         | 縦積み、画像の縮小                          |
| Web     | Gmail、Yahoo!メール                                  | 省略表示（約 102KB）、リンク、プリヘッダー  |

## 確認項目

- [ ] 本文の幅が設定どおり（PC は既定 600px）で、中央に表示される
- [ ] 2 カラム以上の行が、スマホでは縦に並ぶ（`stackOnMobile: false` の行は並ばない）
- [ ] 「スマホで非表示」にした行・ブロックがスマホで表示されない（PC では表示される）
- [ ] Outlook（Windows）でボタンが角丸の色付きボタンとして表示され、クリックできる
- [ ] Outlook（Windows）で文字が明朝体にならない（`outlookFontFamily` のフォントになる）
- [ ] 見出し・本文・リストの文字サイズと行間が、エディタのキャンバスと同じ
- [ ] 画像がはみ出さず、スマホでは幅に合わせて縮む。画像を表示しない設定では代替テキストが出る
- [ ] リンクとボタンのリンク先が正しい。マージタグを使ったリンクも差し込み後に正しい
- [ ] 受信一覧でプリヘッダーが件名の後ろに表示され、本文の冒頭が混ざらない
- [ ] ダークモードで文字が読める（背景色・文字色の組み合わせ）
- [ ] Gmail で「メッセージの一部が表示されていません」と省略されない（minify 後 102KB 未満）
- [ ] テキストパート（`.txt`）が読みやすく、URL が途中で切れていない
- [ ] 表の罫線・見出し行・しま模様が崩れず、スマホでも表のまま読める
- [ ] 動画のサムネイルに再生ボタンが重なり、クリックで動画のページが開く（Outlook（Windows）でも背景のサムネイルが出る。背景画像を出さないメールソフトでは黒地に再生ボタン）。スマホで高さが縮む
- [ ] 画像ギャラリーが格子に並び、「スマホでは 1 列」の設定では画面幅いっぱいに縦に並ぶ
- [ ] 背景画像（外側・行・カラム）が表示され、上の文字が読める。Outlook（Windows）でも表示され、行の高さが中身に合っている。背景画像を表示しない設定では背景色になる
- [ ] ボタンの並び・メニューが 1 行に並び、ボタンの並びはスマホで縦に並ぶ（間隔が空く）

## 確認結果の記録

レンダラーを変えたときは、次の表を埋めて差分を確認します（◯ 問題なし / △ 軽微な差 / ✕ 崩れ）。

| メールソフト                  | PC 表示 | スマホ表示 | ダークモード | 画像 | ボタン・リンク | メモ |
| ----------------------------- | ------- | ---------- | ------------ | ---- | -------------- | ---- |
| Outlook（Windows 従来版）     |         | —          |              |      |                |      |
| 新しい Outlook / Outlook.com  |         |            |              |      |                |      |
| Gmail（Web）                  |         | —          |              |      |                |      |
| Gmail アプリ（iOS / Android） | —       |            |              |      |                |      |
| Apple Mail（Mac）             |         | —          |              |      |                |      |
| iOS メール                    | —       |            |              |      |                |      |
| Yahoo!メール（Web / アプリ）  |         |            |              |      |                |      |

## 配信時の注意

- 本番配信には `minify: true` の出力を使ってください。
- SMTP には 1 行 998 バイトの上限があります。HTML パートとテキストパートは quoted-printable か base64 でエンコードして送ってください（多くの配信システムは自動で行います）。
- マージタグ（既定 `{{name}}`）は、配信システム側で差し込むか、`exportHtml({ mergeValues })` で差し込んでから送ります。
