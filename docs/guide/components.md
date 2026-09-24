# コンポーネント（保存した行・ブロック）

エディタで作った行やブロックに名前を付けて保存し、別のメールで再利用できます。ヘッダー・フッター・よく使う商品の並び・定番のボタンなどに便利です。

- 保存できるのは**行**（カラムと中のブロックごと）と、**ブロック 1 つ**です。
- 入れるときは**複製**します。入れた後は普通の行・ブロックなので自由に直せ、元のコンポーネントを直しても、すでに使っているメールは変わりません。
- 保存先はアプリが決めます（エディタは保存しません）。サーバーに保存すれば、チームで共有できます。

[デモ](/demo)では、このブラウザに保存して試せます。

## 使い方

1. 行またはブロックを選択し、設定パネルの下の「コンポーネント」で名前を入れて「コンポーネントとして保存」を押す
2. パレットの「保存済み」タブに一覧が出る。クリックすると選択中の要素の後ろ（行は選択中の要素を含む行の直後）に入り、キャンバスへドラッグして好きな位置にも置ける
3. 一覧の ✕ で削除する（アプリが削除を許したとき）

## 組み込む

```js
// 保存済みの一覧（アプリのサーバーから読み込む）
editor.components = await fetch('/api/components').then((r) => r.json());

// 「コンポーネントとして保存」: アプリが保存し、id を付けて返すと一覧に加わる
editor.onSaveComponent = async (component) => {
  const res = await fetch('/api/components', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(component),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // 設定パネルに理由が出る
  return res.json(); // { id, name, kind, version, content }
};

// 削除（省略すると ✕ は出ない）。false を返すと取り消し
editor.onDeleteComponent = async (component) => {
  if (!confirm(`「${component.name}」を削除しますか？`)) return false;
  await fetch(`/api/components/${component.id}`, { method: 'DELETE' });
};
```

`onSaveComponent` を設定すると保存の操作が、`components` が空でなければ「保存済み」タブが出ます。一覧は `editor.components` に代入し直せばいつでも更新できます（ほかの人が保存したものを読み込み直す、など）。

## コンポーネントの形

```json
{
  "id": "cmp_1",
  "name": "フッター",
  "kind": "row",
  "version": 1,
  "content": { "id": "r_…", "layout": "1", "settings": { … }, "columns": [ … ] }
}
```

| キー      | 内容                                                            |
| --------- | --------------------------------------------------------------- |
| `id`      | アプリが付ける ID（エディタは付けない。一覧の中で重複しない値） |
| `name`    | 表示名                                                          |
| `kind`    | `"row"`（行）か `"block"`（ブロック 1 つ）                      |
| `version` | 作ったときのテンプレートのバージョン                            |
| `content` | テンプレート JSON の行またはブロックと同じ形                    |

- 入れるときは、読み込み時と同じように中身を整え（古いバージョンや不正な値を直す）、ID を振り直します。直した箇所は `mm-warning` で知らせます。
- 画像は URL のまま保存します（アップロード時の `uploadData` も含む）。
- カスタムブロックを含むコンポーネントは、そのカスタムブロックの定義（`editor.blocks`）が必要です。

## API

| 名前                                     | 内容                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `components`（プロパティ）               | 保存済みの一覧（`Component[]`）                                                          |
| `onSaveComponent(component)`             | 保存するフック。id 付きのコンポーネントを返すと一覧に加える。例外は失敗                  |
| `onDeleteComponent(component)`           | 削除するフック。`false` を返すと取り消し                                                 |
| `insertComponent(component)`（メソッド） | コンポーネントを入れる（アプリ独自の一覧画面から入れるときなど）。入れた要素の ID を返す |
| `mm-warning`                             | `component-save-failed` / `component-delete-failed` / `invalid-component`                |

`@hidemikimura/mailmason/core` の `extractComponent(template, id, { name })` と `instantiateComponent(component, { blocks })` を使うと、サーバーでもコンポーネントを作ったり、テンプレートに入れたりできます。
