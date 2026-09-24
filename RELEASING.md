# リリース手順

`X.Y.Z` は新しいバージョンに読み替えてください。1.0.0 までは、機能追加や互換性の無い変更でマイナー（Y）、不具合の修正でパッチ（Z）を上げます。

## 1. 変更点をまとめる

- `CHANGELOG.md` の「未公開」を `## X.Y.Z - YYYY-MM-DD` にする。互換性の無い変更があれば先頭に書く
- テンプレート JSON の形式（`version`）を変えた場合は、`migrate` で古い形式を読めることを確かめる

## 2. バージョンを上げる

```sh
npm version X.Y.Z --no-git-tag-version   # package.json と package-lock.json
```

次の箇所の CDN の URL と表記も合わせる（マイナーを上げたときだけ）。

- `README.md`（`@hidemikimura/mailmason@X.Y` と「vX.Y（試用版）」）
- `docs/guide/getting-started.md`、`skills/mailmason-integration/references/frameworks.md`（CDN の URL）
- `docs/.vitepress/config.mjs`（ナビゲーションの `vX.Y`）、`docs/guide/what-is-mailmason.md`（「対象外のもの（vX.Y）」）

## 3. 確かめる

```sh
npm run check              # lint・整形・型・テスト（エディタは Chromium）
npm run test:editor:all    # エディタを Chromium・Firefox・WebKit で
npm run build && npm run build:types
npm run docs:build
npm pack --dry-run         # 同梱されるファイル（src・types・dist・skills など）
```

出力 HTML を変えたときは、`npm run samples` の `.eml` を実際のメールソフト（特に Windows の Outlook）で確認する（`docs/client-checklist.md`）。

## 4. 公開する

```sh
git add -A
git commit -m "vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
npm publish            # prepublishOnly で check・build・build:types を実行してから公開する
```

- `main` に push すると、ドキュメントサイトは GitHub Actions で自動的に更新される
- GitHub の Releases で `vX.Y.Z` のタグからリリースを作り、本文に `CHANGELOG.md` の該当部分を貼る
