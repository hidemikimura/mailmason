# AI 向け

AI コーディングエージェントに Mailmason を使った実装やテンプレート作りを任せるための資料です。

## Agent Skills

npm パッケージとリポジトリの `skills/` に、[Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) 形式のスキルを 2 つ同梱しています。

| スキル                  | 使う場面                                 | 中身                                                               |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `mailmason-integration` | `<mailmason-editor>` をアプリに組み込む  | 手順と注意、API リファレンス、React / Vue / Svelte / Node の例     |
| `mailmason-templates`   | テンプレート JSON を作る・直す・検査する | 構造と手順、スキーマのリファレンス（自動生成）、例、検査スクリプト |

### Claude Code で使う

プロジェクトの `.claude/skills/` にコピーします（すべてのプロジェクトで使うなら `~/.claude/skills/`）。

```sh
npm install @hidemikimura/mailmason lit
mkdir -p .claude/skills
cp -r node_modules/@hidemikimura/mailmason/skills/mailmason-* .claude/skills/
```

スキルに対応していないエージェントでは、`AGENTS.md` などに「Mailmason を扱うときは `node_modules/@hidemikimura/mailmason/skills/*/SKILL.md` を読む」と書いておくと参照されます。

### テンプレートの検査スクリプト

`mailmason-templates` には、テンプレート JSON を検査して HTML とテキストを書き出すスクリプトが入っています。AI が作ったテンプレートの確認にも使えます。

```sh
node .claude/skills/mailmason-templates/scripts/validate.mjs template.json --html out.html --text out.txt
```

```text
行 4 / ブロック 9（image×3 text×4 button×1 social×1）
マージタグ: name, unsubscribe_url
HTML（minify）: 9.2KB
OK: 警告はありません
```

## llms.txt

このサイトの内容を AI に読ませるためのテキストを用意しています。

- [llms.txt](/llms.txt){target="_blank"} — 各ページへの案内
- [llms-full.txt](/llms-full.txt){target="_blank"} — ガイド・リファレンス・スキルの本文をまとめたもの

## 頼み方の例

- 「Mailmason のエディタを React の管理画面に組み込んで。テンプレートは `/api/templates/:id` に保存し、画像は `/api/images` にアップロードして URL を受け取る」
- 「秋のセールのメールマガジンを Mailmason のテンプレート JSON で作って。ヒーロー画像、2 列の商品紹介を 2 行、クーポンコード `{{coupon}}`、配信停止リンク。作ったら検査スクリプトで警告が無いことを確かめて」
- 「このテンプレートのボタンの色をブランドカラー `#0f766e` にそろえて。ID は変えないで」
