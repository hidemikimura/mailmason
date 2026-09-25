---
name: mailmason-templates
description: Mailmason のテンプレート JSON（メールの行・カラム・ブロック）を新しく作る・直す・検査するときに使う。メールマガジンやお知らせのレイアウトを JSON で組み立て、スキーマどおりか validate で確かめ、HTML とテキストパートを書き出して確認する。Use when generating or editing Mailmason email template JSON.
---

# Mailmason のテンプレート JSON を作る・直す

Mailmason のメールは 1 つのテンプレート JSON で表します。エディタ（`<mailmason-editor>`）で開けるほか、`@hidemikimura/mailmason/core` の `renderHtml` / `resolveTextPart` で HTML とテキストパートを作れます。HTML からテンプレートには戻せないので、**編集するのは常にテンプレート JSON** です。

全項目の型・既定値・範囲は [references/schema.md](references/schema.md)（スキーマから自動生成）にあります。書く前に必要な部分を読んでください。完成形の例は [examples/](examples/) にあります。

## 構造

```
template
├─ version: 1
├─ body
│  ├─ settings        幅・背景色・フォント・文字色・リンク色・title・preheader
│  └─ rows[]          上から順に並ぶ行
│     ├─ id, layout   '1' | '1:1' | '1:1:1' | '1:2' | '2:1' | '1:1:1:1'
│     ├─ settings     背景色・余白・カラム間隔・スマホで縦積みするか・スマホで隠すか
│     └─ columns[]    数はレイアウトと同じ
│        ├─ id, settings（背景色・余白・縦位置）
│        └─ blocks[]  上から順に並ぶブロック
│           ├─ id, type  text | image | button | divider | spacer | imageText | social | qr | html
│           ├─ values    種類ごとの値
│           ├─ style     { backgroundColor, padding }（既定の余白は 10px、spacer は 0）
│           └─ hideOn    'mobile' | null
└─ text               テキストパート（通常は { mode: 'auto' }。省略可）
```

省略した設定・値は既定値で補われます（警告は出ません）。**書くのは既定値から変える項目だけ**にすると、JSON が短く読みやすくなります。ただし `version` と各 ID は必ず書いてください（無いと警告付きで補われ、ID が毎回変わります）。

## 手順

1. 目的とレイアウトを決める。本文の幅は 600px が標準。1 行に置くカラムは 1〜2 個が基本で、3〜4 個は短い要素（アイコン・小さな商品）だけにする。
2. `body.settings` を決める。`title`（HTML の title）と `preheader`（受信一覧に出る短い文）は必ず書く。色は `#rrggbb`。
3. 行を上から並べる。行とカラムの余白（`padding`）で本文の左右の余白を作る（例: 左右 24〜32px）。背景色を変えたい帯は行の `backgroundColor` で作る。
4. ブロックを置く。
   - `text` の `html` は許可したタグだけ（`p` `h1`〜`h3` `ul` `ol` `li` `br` `strong` `em` `u` `s` `a` `span`）。揃えは段落の `style="text-align:center"`、文字色は `<span style="color:#...">`。文字サイズやフォントはブロックの `fontSize` / `fontFamily` で指定する。
   - `image` は受信者が読める公開 URL を `src` に、内容を表す `alt` を必ず書く。実寸が分かれば `naturalWidth` / `naturalHeight` も書く（Outlook の崩れを防ぐ）。
   - 行動してほしいリンクは `button` にする（`label` と `href`）。
   - 表は `table`。`cells` は行ごとのセルの配列で、各セルは段落を持たないリッチテキスト（`strong` `em` `u` `s` `a` `span` `br`。`p` 見出し リストは使わない）。`columns` は列ごとの `width`（%、`null` なら残りを等分）と `align`。1 行目は `headerRow` で見出しになる。レイアウトには使わず、スペック・料金・日程などのデータに使う。
   - 複数のリンクを横に並べるときは `menu`（文字のリンク）か `buttons`（ボタン）、画像を格子に並べるときは `gallery` を使う（`items` の配列）。
   - 背景画像は `body.settings.backgroundImage`（外側）・`contentBackgroundImage`（本文）と、行・カラムの `settings.backgroundImage`（`{ src, size, position, repeat }`）。上に文字を載せるときは、画像が表示されない場合に備えて文字が読める背景色（`backgroundColor`）も指定する。Outlook（Windows）では、背景画像のある要素の中の背景画像は背景色になるので、本文と行など入れ子で使わない
   - `video` はサムネイル画像（`thumbnail`）に再生ボタンを重ね、`url` の動画ページにリンクする。メールの中では再生できない。YouTube なら `https://i.ytimg.com/vi/<動画ID>/hqdefault.jpg`（480×360）をサムネイルに使える。
   - `type` にハイフンを含むブロック（例: `acme-coupon`）はアプリのカスタムブロック。値の形はアプリの定義で決まるので、既存のテンプレートにあるものを真似て書き、検査には `--blocks` で定義を渡す。
   - `qr` の画像はエディタが作ってアップロードするもの。JSON だけで作るときは `content` を書き、`src` は空のままにして、エディタで「QR コードを作成」してもらう（`src` が空の QR は出力されない）。
   - 配信停止リンクなど、人によって変わる値はマージタグ `{{key}}` で書く（使える項目は schema.md の「マージタグを使える項目」）。
5. 検査する（下記）。警告が 0 件になるまで直す。
6. 必要なら HTML とテキストを書き出して内容を確かめる。

## 検査

`@hidemikimura/mailmason` をインストールしたプロジェクトで、同梱のスクリプトを実行します。

```sh
node <このスキルのフォルダ>/scripts/validate.mjs template.json --html out.html --text out.txt
```

- 構成の要約（行・ブロック数、使っているマージタグ、minify 後の HTML サイズ）を出す
- 中身が空で出力されないブロックや、代替テキストの無い画像を「注意」として出す
- スキーマに合わない値・未知のキー・重複 ID などの警告を出す（警告があると終了コード 1）
- `--values values.json` を付けると、マージタグに値を入れて書き出す
- `--blocks blocks.mjs` でカスタムブロックの定義（配列を default か `blocks` で export するモジュール）を渡す

スクリプトを使えないときは、同じことをコードで確かめます。

```js
import { validate, renderHtml, resolveTextPart } from '@hidemikimura/mailmason/core';
const { valid, warnings, error } = validate(template); // error があれば読み込めない
```

## 既存のテンプレートを直すとき

- **ID は変えない。** エディタの選択や外部の参照が ID を使う。新しく足す要素だけ、重複しない ID（`r_` `c_` `b_` で始めるのが慣例）を付ける。
- **知らない `type` のブロックは消さない。** 将来の拡張や別の環境で作られたブロックの可能性がある。
- **`text` は触らない。** 利用者がテキストパートを手直ししている（`mode: "manual"`）場合、本文を変えると「古い」と判定されるので、変えたことを利用者に伝える。自動生成に戻すのは頼まれたときだけ（`{ "mode": "auto", "content": null, "sourceHash": null }`）。
- レイアウトを変えるときは `columns` の数を合わせ、減らすカラムのブロックは残りのカラムに移す。

## メールとして気をつけること

- 画像だけのメールにしない（画像を表示しない設定の受信者がいる）。大事な文言はテキストで書く。
- `html` ブロックは最後の手段。メールソフトごとに崩れやすく、エディタでも編集しにくい。
- ボタンの文字と背景、本文と背景のコントラストを十分に取る。
- 最後に配信停止リンクや問い合わせ先を置く。
- minify 後の HTML が 90KB を超えたら、行やブロックを減らす（Gmail は約 102KB で省略する）。
