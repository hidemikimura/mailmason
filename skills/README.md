# Mailmason の AI 用スキル

AI コーディングエージェント（Claude Code など）に Mailmason の使い方を教えるための [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) です。

| スキル                                                    | 使う場面                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`mailmason-integration`](mailmason-integration/SKILL.md) | `<mailmason-editor>` をアプリに組み込む（API、画像のアップロード、保存と読み込み、書き出し、React / Vue など） |
| [`mailmason-templates`](mailmason-templates/SKILL.md)     | テンプレート JSON を作る・直す・検査する（スキーマのリファレンス、例、検査スクリプト）                         |

## 使い方

npm パッケージに同梱しています。Claude Code では、プロジェクトの `.claude/skills/` にコピーします。

```sh
mkdir -p .claude/skills
cp -r node_modules/@hidemikimura/mailmason/skills/mailmason-* .claude/skills/
```

すべてのプロジェクトで使うなら `~/.claude/skills/` にコピーします。スキルに対応していないエージェントでは、`AGENTS.md` などから `SKILL.md` を読むよう指示してください。

`mailmason-templates/references/schema.md` は `src/core` のスキーマから自動生成しています（`npm run docs:reference`）。パッケージを更新したら、コピーし直してください。
