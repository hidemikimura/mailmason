# テンプレート JSON リファレンス

<!-- このファイルは scripts/reference.js が src/core のスキーマから生成します。直接編集しないでください（npm run docs:reference）。 -->

Mailmason のテンプレートは 1 つの JSON で、HTML とテキストパートはすべてここから作られます。読み込み時（`loadJson` / `migrate` / `validate`）にスキーマで検査し、欠けた項目は既定値で補い、不正な値は既定値に置き換えて警告します。

## 全体

```json
{
  "version": 1,
  "body": {
    "settings": {
      "width": 600,
      "backgroundColor": "#f4f4f4",
      "contentBackgroundColor": "#ffffff",
      "fontFamily": "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
      "fontSize": 16,
      "lineHeight": 1.6,
      "textColor": "#333333",
      "linkColor": "#0066cc",
      "preheader": "新作アイテムのご案内です",
      "title": "秋の新作のお知らせ"
    },
    "rows": [
      {
        "id": "r_intro",
        "layout": "1",
        "settings": {
          "backgroundColor": null,
          "padding": {
            "top": 24,
            "right": 24,
            "bottom": 8,
            "left": 24
          },
          "columnGap": 16,
          "stackOnMobile": true,
          "hideOn": null
        },
        "columns": [
          {
            "id": "c_intro",
            "settings": {
              "backgroundColor": null,
              "padding": {
                "top": 0,
                "right": 0,
                "bottom": 0,
                "left": 0
              },
              "verticalAlign": "top"
            },
            "blocks": [
              {
                "id": "b_greeting",
                "type": "text",
                "values": {
                  "html": "<h1>{{name}} 様</h1><p>いつもご利用ありがとうございます。</p>"
                },
                "style": {
                  "backgroundColor": null,
                  "padding": {
                    "top": 10,
                    "right": 10,
                    "bottom": 10,
                    "left": 10
                  }
                },
                "hideOn": null
              },
              {
                "id": "b_cta",
                "type": "button",
                "values": {
                  "label": "新作を見る",
                  "href": "https://example.com/new",
                  "backgroundColor": "#e8590c"
                },
                "style": {
                  "backgroundColor": null,
                  "padding": {
                    "top": 10,
                    "right": 10,
                    "bottom": 10,
                    "left": 10
                  }
                },
                "hideOn": null
              }
            ]
          }
        ]
      }
    ]
  },
  "text": {
    "mode": "auto",
    "content": null,
    "sourceHash": null
  }
}
```

| キー            | 型           | 説明                                                                                     |
| --------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `version`       | `1`          | テンプレートの形式のバージョン。省略すると警告付きで補う。新しいバージョンは読み込めない |
| `body.settings` | オブジェクト | ボディ設定（下記）                                                                       |
| `body.rows`     | 配列         | 行の並び（上から順）                                                                     |
| `text`          | オブジェクト | テキストパート（下記）                                                                   |

## ボディ設定（`body.settings`）

| キー                     | 型              | 既定値                                                                       | 説明                                             |
| ------------------------ | --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `width`                  | 整数 320〜1200  | `600`                                                                        | 本文の幅（px）                                   |
| `backgroundColor`        | 色（`#rrggbb`） | `"#f4f4f4"`                                                                  | 本文の外側の背景色                               |
| `contentBackgroundColor` | 色（`#rrggbb`） | `"#ffffff"`                                                                  | 本文の背景色                                     |
| `fontFamily`             | 文字列          | `"'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif"` | 基本のフォント                                   |
| `fontSize`               | 数値 8〜72      | `16`                                                                         | 基本の文字サイズ（px）                           |
| `lineHeight`             | 数値 0.8〜3     | `1.6`                                                                        | 行の高さ（文字サイズに対する倍率）               |
| `textColor`              | 色（`#rrggbb`） | `"#333333"`                                                                  | 基本の文字色                                     |
| `linkColor`              | 色（`#rrggbb`） | `"#0066cc"`                                                                  | リンクの色                                       |
| `preheader`              | 文字列          | `""`                                                                         | プリヘッダー（受信一覧で件名の後ろに出る短い文） |
| `title`                  | 文字列          | `""`                                                                         | HTML の `<title>`                                |

## 行（`body.rows[]`）

| キー       | 型             | 説明                                                                            |
| ---------- | -------------- | ------------------------------------------------------------------------------- |
| `id`       | 文字列         | テンプレート内で重複しない ID（空や重複は振り直して警告）。慣例は `r_` で始める |
| `layout`   | 下のレイアウト | カラムの分け方                                                                  |
| `settings` | オブジェクト   | 行の設定（下記）                                                                |
| `columns`  | 配列           | カラム。数はレイアウトと同じ（合わなければ警告して合わせる）                    |

### レイアウト

幅は 12 分割で、カラムの間隔（`columnGap`）は内側にだけ入ります。

| `layout`    | カラム数 | 幅の比（12 分割） |
| ----------- | -------- | ----------------- |
| `"1"`       | 1        | 12                |
| `"1:1"`     | 2        | 6 : 6             |
| `"1:1:1"`   | 3        | 4 : 4 : 4         |
| `"1:2"`     | 2        | 4 : 8             |
| `"2:1"`     | 2        | 8 : 4             |
| `"1:1:1:1"` | 4        | 3 : 3 : 3 : 3     |

### 行の設定（`settings`）

| キー              | 型                                             | 既定値                                    | 説明                                |
| ----------------- | ---------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| `backgroundColor` | 色（`#rrggbb`） \| `null`                      | `null`                                    | 行の背景色（`null` で本文の背景色） |
| `padding`         | 余白 `{ top, right, bottom, left }`（0〜1000） | `{"top":0,"right":0,"bottom":0,"left":0}` | 行の内側の余白（px）                |
| `columnGap`       | 整数 0〜200                                    | `16`                                      | カラムの間隔（px）                  |
| `stackOnMobile`   | 真偽値                                         | `true`                                    | スマホでカラムを縦に並べるか        |
| `hideOn`          | `"mobile"` \| `null`                           | `null`                                    | `"mobile"` でスマホでは表示しない   |

## カラム（`columns[]`）

| キー       | 型           | 説明                                |
| ---------- | ------------ | ----------------------------------- |
| `id`       | 文字列       | 重複しない ID。慣例は `c_` で始める |
| `settings` | オブジェクト | カラムの設定（下記）                |
| `blocks`   | 配列         | ブロックの並び（上から順）          |

| キー              | 型                                             | 既定値                                    | 説明                     |
| ----------------- | ---------------------------------------------- | ----------------------------------------- | ------------------------ |
| `backgroundColor` | 色（`#rrggbb`） \| `null`                      | `null`                                    | カラムの背景色           |
| `padding`         | 余白 `{ top, right, bottom, left }`（0〜1000） | `{"top":0,"right":0,"bottom":0,"left":0}` | カラムの内側の余白（px） |
| `verticalAlign`   | `"top"` \| `"middle"` \| `"bottom"`            | `"top"`                                   | カラム内の縦位置         |

## ブロック（`blocks[]`）

| キー     | 型                   | 説明                                                                                                                                                                                                         |
| -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`     | 文字列               | 重複しない ID。慣例は `b_` で始める                                                                                                                                                                          |
| `type`   | 文字列               | ブロックの種類（`text` / `image` / `button` / `divider` / `spacer` / `imageText` / `gallery` / `video` / `buttons` / `menu` / `table` / `social` / `qr` / `html`）。未知の種類はデータを残したまま出力しない |
| `values` | オブジェクト         | 種類ごとの値（下記）。省略した項目は既定値                                                                                                                                                                   |
| `style`  | オブジェクト         | 背景と余白（下記）                                                                                                                                                                                           |
| `hideOn` | `"mobile"` \| `null` | `"mobile"` でスマホでは表示しない                                                                                                                                                                            |

### 共通のスタイル（`style`）

| キー              | 型                                             | 既定値                                        | 説明                       |
| ----------------- | ---------------------------------------------- | --------------------------------------------- | -------------------------- |
| `backgroundColor` | 色（`#rrggbb`） \| `null`                      | `null`                                        | ブロックの背景色           |
| `padding`         | 余白 `{ top, right, bottom, left }`（0〜1000） | `{"top":10,"right":10,"bottom":10,"left":10}` | ブロックの内側の余白（px） |

### `text`

リッチテキスト。`html` は許可したタグだけの整形式 HTML（下の「リッチテキスト」を参照）。文字設定が `null` の項目はボディ設定を使う。

| キー         | 型                        | 既定値 | 説明                                  |
| ------------ | ------------------------- | ------ | ------------------------------------- |
| `html`       | 文字列                    | `""`   | 本文（許可タグだけの HTML）           |
| `fontFamily` | 文字列 \| `null`          | `null` | フォント（`null` でボディ設定）       |
| `fontSize`   | 数値 8〜72 \| `null`      | `null` | 文字サイズ（px、`null` でボディ設定） |
| `lineHeight` | 数値 0.8〜3 \| `null`     | `null` | 行の高さ（倍率、`null` でボディ設定） |
| `color`      | 色（`#rrggbb`） \| `null` | `null` | 文字色（`null` でボディ設定）         |

マージタグを使える項目: `html`

### `image`

画像。`src` が空なら出力しない。`naturalWidth` / `naturalHeight` があると、Outlook 用に height 属性を出す。

| キー            | 型                                  | 既定値     | 説明                                                                                                                                                                                                            |
| --------------- | ----------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`           | 文字列                              | `""`       | 画像の URL（受信者が読める公開 URL）                                                                                                                                                                            |
| `alt`           | 文字列                              | `""`       | 代替テキスト                                                                                                                                                                                                    |
| `href`          | 文字列                              | `""`       | リンク先（空ならリンクなし）                                                                                                                                                                                    |
| `width`         | オブジェクト                        |            | 表示幅                                                                                                                                                                                                          |
| `width.unit`    | `"%"` \| `"px"`                     | `"%"`      | `"%"` はブロック幅に対する割合、`"px"` は固定幅                                                                                                                                                                 |
| `width.value`   | 数値 1〜1200                        | `100`      | 幅の値                                                                                                                                                                                                          |
| `align`         | `"left"` \| `"center"` \| `"right"` | `"center"` | 横位置                                                                                                                                                                                                          |
| `naturalWidth`  | 整数 1 以上 \| `null`               | `null`     | 画像の実際の幅（px）                                                                                                                                                                                            |
| `naturalHeight` | 整数 1 以上 \| `null`               | `null`     | 画像の実際の高さ（px）                                                                                                                                                                                          |
| `uploadData`    | 任意のオブジェクト \| `null`        | `null`     | アップロード時に `onImageUpload`（または `onImageSelect`）が `{ url, data }` で返した `data`。中身は自由（JSON で表せる値）で、出力には使わない。画像を差し替えると置き換わり、URL を手で変えると `null` になる |

マージタグを使える項目: `src`、`alt`、`href`

### `button`

ボタン。`label` が空なら出力しない。Outlook（Windows）では VML の角丸ボタンになる。

| キー              | 型                                             | 既定値                                        | 説明                                       |
| ----------------- | ---------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| `label`           | 文字列                                         | `""`                                          | ボタンの文字                               |
| `href`            | 文字列                                         | `""`                                          | リンク先                                   |
| `backgroundColor` | 色（`#rrggbb`）                                | `"#0066cc"`                                   | ボタンの色                                 |
| `color`           | 色（`#rrggbb`）                                | `"#ffffff"`                                   | 文字色                                     |
| `fontSize`        | 数値 8〜72                                     | `16`                                          | 文字サイズ（px）                           |
| `fontWeight`      | `"normal"` \| `"bold"`                         | `"bold"`                                      | 文字の太さ                                 |
| `borderRadius`    | 整数 0〜100                                    | `4`                                           | 角丸（px）                                 |
| `innerPadding`    | 余白 `{ top, right, bottom, left }`（0〜1000） | `{"top":12,"right":24,"bottom":12,"left":24}` | ボタンの内側の余白（px）                   |
| `width`           | `"auto"` \| `"full"`                           | `"auto"`                                      | `"auto"` は文字に合わせる、`"full"` は全幅 |
| `align`           | `"left"` \| `"center"` \| `"right"`            | `"center"`                                    | 横位置                                     |

マージタグを使える項目: `label`、`href`

### `divider`

区切り線。

| キー           | 型                                    | 既定値      | 説明                             |
| -------------- | ------------------------------------- | ----------- | -------------------------------- |
| `thickness`    | 整数 1〜20                            | `1`         | 線の太さ（px）                   |
| `color`        | 色（`#rrggbb`）                       | `"#dddddd"` | 線の色                           |
| `lineStyle`    | `"solid"` \| `"dashed"` \| `"dotted"` | `"solid"`   | 線の種類                         |
| `widthPercent` | 整数 1〜100                           | `100`       | 線の長さ（ブロック幅に対する %） |
| `align`        | `"left"` \| `"center"` \| `"right"`   | `"center"`  | 横位置                           |

マージタグを使える項目: なし

### `spacer`

空白。既定のブロック余白は 0。

| キー     | 型          | 既定値 | 説明       |
| -------- | ----------- | ------ | ---------- |
| `height` | 整数 1〜500 | `24`   | 高さ（px） |

マージタグを使える項目: なし

既定の `style`: `{"backgroundColor":null,"padding":{"top":0,"right":0,"bottom":0,"left":0}}`

### `imageText`

画像とテキストの横並び（スマホでは縦に並ぶ）。

| キー                  | 型                           | 既定値   | 説明                                                               |
| --------------------- | ---------------------------- | -------- | ------------------------------------------------------------------ |
| `image`               | オブジェクト                 |          | 画像                                                               |
| `image.src`           | 文字列                       | `""`     | 画像の URL                                                         |
| `image.alt`           | 文字列                       | `""`     | 代替テキスト                                                       |
| `image.href`          | 文字列                       | `""`     | リンク先                                                           |
| `image.naturalWidth`  | 整数 1 以上 \| `null`        | `null`   | 画像の実際の幅（px）                                               |
| `image.naturalHeight` | 整数 1 以上 \| `null`        | `null`   | 画像の実際の高さ（px）                                             |
| `image.uploadData`    | 任意のオブジェクト \| `null` | `null`   | 画像ブロックの `uploadData` と同じ（アップロード時の任意のデータ） |
| `imagePosition`       | `"left"` \| `"right"`        | `"left"` | 画像を置く側                                                       |
| `imageWidthPercent`   | 整数 10〜90                  | `40`     | 画像の幅（ブロック幅に対する %）                                   |
| `html`                | 文字列                       | `""`     | テキスト（許可タグだけの HTML）                                    |

マージタグを使える項目: `image.src`、`image.alt`、`image.href`、`html`

### `gallery`

画像ギャラリー。画像を 2〜4 列の格子に並べる。`src` が空の項目は出力しない。

| キー                          | 型                           | 既定値  | 説明                                                               |
| ----------------------------- | ---------------------------- | ------- | ------------------------------------------------------------------ |
| `items`                       | 配列                         |         | 画像の一覧（左上から順に並べる）                                   |
| `items[].image`               | オブジェクト                 |         | 画像                                                               |
| `items[].image.src`           | 文字列                       | `""`    | 画像の URL                                                         |
| `items[].image.alt`           | 文字列                       | `""`    | 代替テキスト                                                       |
| `items[].image.naturalWidth`  | 整数 1 以上 \| `null`        | `null`  | 画像の実際の幅（px）                                               |
| `items[].image.naturalHeight` | 整数 1 以上 \| `null`        | `null`  | 画像の実際の高さ（px）                                             |
| `items[].image.uploadData`    | 任意のオブジェクト \| `null` | `null`  | 画像ブロックの `uploadData` と同じ（アップロード時の任意のデータ） |
| `items[].href`                | 文字列                       | `""`    | リンク先                                                           |
| `columns`                     | `"2"` \| `"3"` \| `"4"`      | `"2"`   | 1 行に並べる数                                                     |
| `gap`                         | 整数 0〜40                   | `8`     | 画像の間の余白（px）                                               |
| `stackOnMobile`               | 真偽値                       | `false` | スマホでは 1 列に並べる                                            |

マージタグを使える項目: `items[].image.src`、`items[].image.alt`、`items[].href`

### `video`

動画。サムネイルに再生ボタンを重ね、`url`（動画のページ）にリンクする。メールの中では再生できない。サムネイルはセルの背景に敷き（Outlook は VML）、背景画像を表示しないメールソフトでは黒地に再生ボタンだけが出る。`playButton: "none"` なら画像ブロックと同じ出力。

| キー                      | 型                                  | 既定値     | 説明                                                               |
| ------------------------- | ----------------------------------- | ---------- | ------------------------------------------------------------------ |
| `url`                     | 文字列                              | `""`       | 動画のページの URL（YouTube など）                                 |
| `thumbnail`               | オブジェクト                        |            | サムネイル画像                                                     |
| `thumbnail.src`           | 文字列                              | `""`       | サムネイルの URL。空なら出力しない                                 |
| `thumbnail.alt`           | 文字列                              | `""`       | 代替テキスト（リンクの title にも使う）                            |
| `thumbnail.naturalWidth`  | 整数 1 以上 \| `null`               | `null`     | 画像の実際の幅（px）                                               |
| `thumbnail.naturalHeight` | 整数 1 以上 \| `null`               | `null`     | 画像の実際の高さ（px）                                             |
| `thumbnail.uploadData`    | 任意のオブジェクト \| `null`        | `null`     | 画像ブロックの `uploadData` と同じ（アップロード時の任意のデータ） |
| `playButton`              | `"dark"` \| `"light"` \| `"none"`   | `"dark"`   | 再生ボタン（`"dark"` 黒 / `"light"` 白 / `"none"` なし）           |
| `ratio`                   | `"16:9"` \| `"4:3"` \| `"1:1"`      | `"16:9"`   | 縦横比（再生ボタンがあるとき。サムネイルははみ出す分を切る）       |
| `width`                   | オブジェクト                        |            | 幅                                                                 |
| `width.unit`              | `"%"` \| `"px"`                     | `"%"`      | 単位                                                               |
| `width.value`             | 数値 1〜1200                        | `100`      | 値                                                                 |
| `align`                   | `"left"` \| `"center"` \| `"right"` | `"center"` | 横位置                                                             |

マージタグを使える項目: `url`、`thumbnail.alt`

### `buttons`

ボタンの並び。複数のボタンを横に並べる（`stackOnMobile` ならスマホで縦に並ぶ）。見た目は共通で、色はボタンごと。`label` が空の項目は出力しない。

| キー                      | 型                                             | 既定値                                        | 説明                                         |
| ------------------------- | ---------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `items`                   | 配列                                           |                                               | ボタンの一覧                                 |
| `items[].label`           | 文字列                                         | `""`                                          | ボタンの文字                                 |
| `items[].href`            | 文字列                                         | `""`                                          | リンク先                                     |
| `items[].backgroundColor` | 色（`#rrggbb`）                                | `"#0066cc"`                                   | ボタンの色                                   |
| `items[].color`           | 色（`#rrggbb`）                                | `"#ffffff"`                                   | 文字色                                       |
| `fontSize`                | 数値 8〜72                                     | `16`                                          | 文字サイズ（px）                             |
| `fontWeight`              | `"normal"` \| `"bold"`                         | `"bold"`                                      | 文字の太さ                                   |
| `borderRadius`            | 整数 0〜100                                    | `4`                                           | 角丸（px）                                   |
| `innerPadding`            | 余白 `{ top, right, bottom, left }`（0〜1000） | `{"top":12,"right":24,"bottom":12,"left":24}` | ボタンの内側の余白（px）                     |
| `gap`                     | 整数 0〜60                                     | `12`                                          | ボタンの間隔（px）                           |
| `equalWidth`              | 真偽値                                         | `false`                                       | ブロックの幅を等分して、ボタンの幅をそろえる |
| `stackOnMobile`           | 真偽値                                         | `true`                                        | スマホでは縦に並べる                         |
| `align`                   | `"left"` \| `"center"` \| `"right"`            | `"center"`                                    | 横位置                                       |

マージタグを使える項目: `items[].label`、`items[].href`

### `menu`

メニュー。リンクを区切り文字でつないで 1 行に並べる（ヘッダーやフッターのナビゲーション）。`label` が空の項目は出力しない。

| キー             | 型                                  | 既定値      | 説明                                |
| ---------------- | ----------------------------------- | ----------- | ----------------------------------- |
| `items`          | 配列                                |             | リンクの一覧                        |
| `items[].label`  | 文字列                              | `""`        | 表示する文字                        |
| `items[].href`   | 文字列                              | `""`        | リンク先（空なら文字だけ）          |
| `separator`      | 文字列                              | `"          | "`                                  | 区切り文字（空なら空白） |
| `spacing`        | 整数 0〜60                          | `12`        | 項目の間隔（px）                    |
| `fontSize`       | 数値 8〜72                          | `14`        | 文字サイズ（px）                    |
| `fontWeight`     | `"normal"` \| `"bold"`              | `"normal"`  | 文字の太さ                          |
| `color`          | 色（`#rrggbb`） \| `null`           | `null`      | 文字色（`null` ならボディの文字色） |
| `separatorColor` | 色（`#rrggbb`）                     | `"#c5cad1"` | 区切り文字の色                      |
| `underline`      | 真偽値                              | `false`     | リンクに下線を引く                  |
| `align`          | `"left"` \| `"center"` \| `"right"` | `"center"`  | 横位置                              |

マージタグを使える項目: `items[].label`、`items[].href`

### `table`

表。`cells` は行ごとのセルの配列で、各セルは段落を持たないリッチテキスト（`strong` `em` `u` `s` `a` `span` の文字色、`br` など。下の「リッチテキスト」から `p` 見出し リストを除いたもの）。行の数は 1〜50、列の数は 1〜8 で、`columns` と各行のセルの数は読み込み時にそろえる。全部のセルが空なら出力しない。

| キー                    | 型                                  | 既定値      | 説明                                                                                 |
| ----------------------- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `cells`                 | 配列                                |             | 行ごとのセル（`string[][]`。各セルは段落を持たないリッチテキスト）                   |
| `columns`               | 配列                                |             | 列の設定（各行のセルの数と同じ）                                                     |
| `columns[].width`       | 整数 1〜100 \| `null`               | `null`      | 列の幅（表の幅に対する %）。`null` の列は残りを等分する。合計が 100 を超えたら縮める |
| `columns[].align`       | `"left"` \| `"center"` \| `"right"` | `"left"`    | 文字の揃え                                                                           |
| `headerRow`             | 真偽値                              | `true`      | 1 行目を見出し（`th`）にする                                                         |
| `headerBackgroundColor` | 色（`#rrggbb`）                     | `"#f3f4f6"` | 見出しの背景色                                                                       |
| `headerColor`           | 色（`#rrggbb`） \| `null`           | `null`      | 見出しの文字色（`null` なら本文と同じ）                                              |
| `borderColor`           | 色（`#rrggbb`）                     | `"#d0d7de"` | 罫線の色                                                                             |
| `borderWidth`           | 整数 0〜8                           | `1`         | 罫線の太さ（px、0 で罫線なし）                                                       |
| `cellPadding`           | 整数 0〜40                          | `8`         | セルの内側の余白（px）                                                               |
| `striped`               | 真偽値                              | `false`     | 1 行おきに背景色を付ける                                                             |
| `stripeColor`           | 色（`#rrggbb`）                     | `"#f9fafb"` | しま模様の色                                                                         |
| `fontSize`              | 数値 8〜72 \| `null`                | `null`      | 文字サイズ（px、`null` ならボディ設定）                                              |
| `color`                 | 色（`#rrggbb`） \| `null`           | `null`      | 文字色（`null` ならボディ設定）                                                      |

マージタグを使える項目: `cells`

### `social`

SNS へのリンク。`url` が空の項目は出力しない。アイコン PNG の置き場所（`socialIconBaseUrl`）を指定しなければテキストリンクになる。

| キー              | 型                                                                                                                          | 既定値      | 説明                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| `items`           | 配列                                                                                                                        |             | リンクの一覧（並び順どおりに出力）             |
| `items[].service` | `"x"` \| `"facebook"` \| `"instagram"` \| `"line"` \| `"youtube"` \| `"tiktok"` \| `"linkedin"` \| `"website"` \| `"email"` | `"website"` | サービス（下の一覧から）                       |
| `items[].url`     | 文字列                                                                                                                      | `""`        | リンク先（`mailto:` も可）                     |
| `iconSize`        | 整数 16〜64                                                                                                                 | `32`        | アイコンの大きさ（px）                         |
| `align`           | `"left"` \| `"center"` \| `"right"`                                                                                         | `"center"`  | 横位置                                         |
| `iconStyle`       | `"color"` \| `"mono"`                                                                                                       | `"color"`   | アイコンの色（`socialIconBaseUrl` を使うとき） |

マージタグを使える項目: `items`

### `qr`

QR コード。画像（PNG）はエディタが作って `onImageUpload` でアップロードし、その URL を `src` に持つ（出力は画像と同じ）。JSON を直接作るときは、QR の PNG を自分で用意して `src` に URL を入れ、`generated` に `qrSignature(values)` の値を入れる（`null` のままだとエディタで「作り直し」が必要と表示される）。

| キー              | 型                                  | 既定値      | 説明                                                                                                    |
| ----------------- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `content`         | 文字列                              | `""`        | QR にする文字列（URL など。差し込み変数は使えない）                                                     |
| `size`            | 整数 48〜600                        | `160`       | 表示サイズ（px、正方形）                                                                                |
| `ecLevel`         | `"L"` \| `"M"` \| `"Q"` \| `"H"`    | `"M"`       | 誤り訂正レベル（L 約 7% / M 約 15% / Q 約 25% / H 約 30% の汚れ・欠けまで読める）                       |
| `margin`          | 整数 0〜8                           | `2`         | 周りの余白（升目の数。読み取りには 2 以上を推奨）                                                       |
| `color`           | 色（`#rrggbb`）                     | `"#000000"` | 升目の色                                                                                                |
| `backgroundColor` | 色（`#rrggbb`）                     | `"#ffffff"` | 背景色                                                                                                  |
| `src`             | 文字列                              | `""`        | アップロードした QR 画像（PNG）の URL。空なら出力しない                                                 |
| `alt`             | 文字列                              | `""`        | 代替テキスト                                                                                            |
| `href`            | 文字列                              | `""`        | リンク先（空ならリンクなし）。テキストパートでは、空なら `content` が URL のときその URL を出す         |
| `align`           | `"left"` \| `"center"` \| `"right"` | `"center"`  | 横位置                                                                                                  |
| `generated`       | 文字列 \| `null`                    | `null`      | `src` の画像を作ったときの設定（`qrSignature()` の値）。今の設定と違うと作り直しが必要                  |
| `uploadData`      | 任意のオブジェクト \| `null`        | `null`      | QR の画像をアップロードしたときに `onImageUpload` が返した `data`（画像ブロックの `uploadData` と同じ） |

マージタグを使える項目: `alt`、`href`

### `html`

生の HTML。エディタのキャンバスでは sandbox の iframe で表示し、出力にはそのまま入れる（テキストパートは許可タグに整えてから変換）。

| キー   | 型     | 既定値 | 説明      |
| ------ | ------ | ------ | --------- |
| `html` | 文字列 | `""`   | 生の HTML |

マージタグを使える項目: `html`

### カスタムブロック

`type` にハイフンを含むブロック（例: `acme-coupon`）は、アプリが `defineBlock()` で定義したカスタムブロックです。`values` の形は定義の設定項目（`fields`）で決まります。定義を渡さずに読み込むと未知の種類として扱い（`unknown-block-type`）、データは残したまま出力しません。

## リッチテキスト（`text.html` / `imageText.html`）

- 段落: `<p>` `<h1>` `<h2>` `<h3>`、リスト: `<ul>` `<ol>` と `<li>`、改行: `<br>`
- 文字の装飾: `<strong>` `<em>` `<u>` `<s>` `<a>` `<span>`
- `<a>` の `href` は `http:` `https:` `mailto:` `tel:` `#` とマージタグだけ。`<span>` の `style` は `color` と `background-color` だけ。段落の `style` は `text-align` だけ
- 読み替え: `b` → `strong`、`i` → `em`、`strike` → `s`、`del` → `s`、`ins` → `u`、`font` → `span`。`<div>` や `<table>` などは段落に、許可していないタグは外して中身の文字だけ残す。`<script>` `<style>` `<img>` などは中身ごと削除
- 文字サイズやフォントは文字単位では指定できません（ブロックの `fontSize` などを使う）

## SNS のサービス（`social.items[].service`）

`x`（X）、`facebook`（Facebook）、`instagram`（Instagram）、`line`（LINE）、`youtube`（YouTube）、`tiktok`（TikTok）、`linkedin`（LinkedIn）、`website`（Webサイト）、`email`（メール）

## マージタグ

既定の区切りは `{{` と `}}` です（エディタの `mergeTagDelimiters` で変更可）。キーは英数字・`_`・`.`・`-` で、上の「マージタグを使える項目」とボディ設定の `preheader` / `title` に書けます。

## テキストパート（`text`）

| キー         | 型                     | 既定値   | 説明                                                           |
| ------------ | ---------------------- | -------- | -------------------------------------------------------------- |
| `mode`       | `"auto"` \| `"manual"` | `"auto"` | `"auto"` は自動生成、`"manual"` は `content` を使う            |
| `content`    | 文字列 \| `null`       | `null`   | 手編集したテキスト（`manual` のとき）                          |
| `sourceHash` | 文字列 \| `null`       | `null`   | 手編集を始めた時点の自動生成テキストのハッシュ（古さの判定用） |

`mode: "manual"` のとき、`sourceHash` が今の本文から作ったハッシュと違えば「手編集の後に本文が変わった」と判定します（`resolveTextPart` の `stale`）。
