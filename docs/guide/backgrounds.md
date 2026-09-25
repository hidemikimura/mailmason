# 背景画像

メール全体の外側・本文・行・カラムに背景画像を敷けます。画像の上に見出しやボタンを載せるヒーロー（メインビジュアル）や、帯・模様などに使います。

<ClientOnly>
  <MailmasonDemo template="backgrounds" height="560px" :controls="false" />
</ClientOnly>

## 設定する

要素を選んで設定パネルの「背景画像」に URL を入れる（または「アップロード…」「選択…」）と、次の設定が出ます。

| 設定     | 内容                                                             |
| -------- | ---------------------------------------------------------------- |
| サイズ   | 全面を覆う（はみ出す分は切る）/ 全体を入れる / 原寸              |
| 位置     | 9 か所（左上〜右下）。全面を覆うときは、どこを残して切るかになる |
| 繰り返す | 模様などを敷き詰める                                             |

メール全体の設定（何も選択していないとき）に「外側の背景画像」と「本文の背景画像」、行とカラムの設定に「背景画像」があります。

::: tip 背景色も指定する
背景画像を表示しないメールソフト（画像をブロックしている場合など）では、背景色が見えます。白い文字を載せるときは、文字が読める濃い背景色も指定してください。
:::

## テンプレート JSON

```json
{
  "backgroundImage": {
    "src": "https://cdn.example.com/hero.jpg",
    "size": "cover",
    "position": "center center",
    "repeat": "no-repeat",
    "uploadData": null
  }
}
```

`body.settings.backgroundImage`（外側）・`body.settings.contentBackgroundImage`（本文）と、行・カラムの `settings.backgroundImage` に同じ形で入ります。`src` が空なら背景画像はありません。詳しくは[テンプレート JSON](../reference/template) を参照してください。

## メールソフトでの表示

- 一般のメールソフト（Gmail・Apple Mail・iOS メールなど）: セルの CSS（`background-image` など）と `background` 属性で表示します。
- Outlook（Windows）: CSS の背景画像に対応していないため、VML（条件付きコメント）で表示します。行やカラムの高さは中身に合わせて伸びます。外側の背景画像は `v:background` で表示します。
- Outlook（Windows）では VML を入れ子にできないため、**背景画像のある要素の中の背景画像は表示せず、背景色になります**（本文に背景画像があるときの行・カラム、行に背景画像があるときのカラム）。どのメールソフトでも同じにしたいときは、入れ子にしないでください。
- Outlook（Windows）の「位置」「原寸」は近似です（VML の値に置き換えて表示します）。

実機での確認は[メールソフトでの確認](/client-checklist)の手順で行えます（`npm run samples:send` の `backgrounds` が背景画像のサンプルです）。
