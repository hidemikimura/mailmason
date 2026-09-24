// テンプレート JSON のリファレンス（Markdown）を、実際のスキーマと既定値から作る。
// ドキュメントサイトと AI 用 skills の両方に同じ内容を書き出す:
//   npm run docs:reference          生成して書き込む
//   npm run docs:reference -- --check  ファイルが最新か確かめる（違えば終了コード 1）
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { TEMPLATE_VERSION } from '../src/core/model/factory.js';
import {
  blockStyleSchema,
  bodySettingsSchema,
  columnSettingsSchema,
  defaultBlockStyle,
  defaultBodySettings,
  defaultColumnSettings,
  defaultRowSettings,
  rowSettingsSchema,
  textPartSchema,
} from '../src/core/model/settings.js';
import { ROW_LAYOUTS } from '../src/core/model/layout.js';
import { BLOCK_TYPES, getBlockDef } from '../src/core/blocks/registry.js';
import { SOCIAL_SERVICES, socialLabel } from '../src/core/blocks/social.js';
import {
  BLOCK_TAGS,
  INLINE_TAGS,
  LIST_TAGS,
  RENAMED_TAGS,
} from '../src/core/richtext/allowlist.js';

/** @import { Schema } from '../src/core/model/schema.js' */

const root = fileURLToPath(new URL('..', import.meta.url));

/** 書き出し先（リポジトリのルートからの相対パス） */
export const REFERENCE_FILES = [
  'docs/reference/template.md',
  'skills/mailmason-templates/references/schema.md',
];

/** ブロックの説明 */
const BLOCK_NOTES = {
  text: 'リッチテキスト。`html` は許可したタグだけの整形式 HTML（下の「リッチテキスト」を参照）。文字設定が `null` の項目はボディ設定を使う。',
  image:
    '画像。`src` が空なら出力しない。`naturalWidth` / `naturalHeight` があると、Outlook 用に height 属性を出す。',
  button: 'ボタン。`label` が空なら出力しない。Outlook（Windows）では VML の角丸ボタンになる。',
  divider: '区切り線。',
  spacer: '空白。既定のブロック余白は 0。',
  imageText: '画像とテキストの横並び（スマホでは縦に並ぶ）。',
  social:
    'SNS へのリンク。`url` が空の項目は出力しない。アイコン PNG の置き場所（`socialIconBaseUrl`）を指定しなければテキストリンクになる。',
  html: '生の HTML。エディタのキャンバスでは sandbox の iframe で表示し、出力にはそのまま入れる（テキストパートは許可タグに整えてから変換）。',
};

/** 項目の説明（パスはブロックなら `type.key`） */
const DESCRIPTIONS = {
  'body.width': '本文の幅（px）',
  'body.backgroundColor': '本文の外側の背景色',
  'body.contentBackgroundColor': '本文の背景色',
  'body.fontFamily': '基本のフォント',
  'body.fontSize': '基本の文字サイズ（px）',
  'body.lineHeight': '行の高さ（文字サイズに対する倍率）',
  'body.textColor': '基本の文字色',
  'body.linkColor': 'リンクの色',
  'body.preheader': 'プリヘッダー（受信一覧で件名の後ろに出る短い文）',
  'body.title': 'HTML の `<title>`',
  'row.backgroundColor': '行の背景色（`null` で本文の背景色）',
  'row.padding': '行の内側の余白（px）',
  'row.columnGap': 'カラムの間隔（px）',
  'row.stackOnMobile': 'スマホでカラムを縦に並べるか',
  'row.hideOn': '`"mobile"` でスマホでは表示しない',
  'column.backgroundColor': 'カラムの背景色',
  'column.padding': 'カラムの内側の余白（px）',
  'column.verticalAlign': 'カラム内の縦位置',
  'style.backgroundColor': 'ブロックの背景色',
  'style.padding': 'ブロックの内側の余白（px）',
  'text.mode': '`"auto"` は自動生成、`"manual"` は `content` を使う',
  'text.content': '手編集したテキスト（`manual` のとき）',
  'text.sourceHash': '手編集を始めた時点の自動生成テキストのハッシュ（古さの判定用）',
  'text.html': '本文（許可タグだけの HTML）',
  'text.fontFamily': 'フォント（`null` でボディ設定）',
  'text.fontSize': '文字サイズ（px、`null` でボディ設定）',
  'text.lineHeight': '行の高さ（倍率、`null` でボディ設定）',
  'text.color': '文字色（`null` でボディ設定）',
  'image.src': '画像の URL（受信者が読める公開 URL）',
  'image.alt': '代替テキスト',
  'image.href': 'リンク先（空ならリンクなし）',
  'image.width': '表示幅',
  'image.width.unit': '`"%"` はブロック幅に対する割合、`"px"` は固定幅',
  'image.width.value': '幅の値',
  'image.align': '横位置',
  'image.naturalWidth': '画像の実際の幅（px）',
  'image.naturalHeight': '画像の実際の高さ（px）',
  'button.label': 'ボタンの文字',
  'button.href': 'リンク先',
  'button.backgroundColor': 'ボタンの色',
  'button.color': '文字色',
  'button.fontSize': '文字サイズ（px）',
  'button.fontWeight': '文字の太さ',
  'button.borderRadius': '角丸（px）',
  'button.innerPadding': 'ボタンの内側の余白（px）',
  'button.width': '`"auto"` は文字に合わせる、`"full"` は全幅',
  'button.align': '横位置',
  'divider.thickness': '線の太さ（px）',
  'divider.color': '線の色',
  'divider.lineStyle': '線の種類',
  'divider.widthPercent': '線の長さ（ブロック幅に対する %）',
  'divider.align': '横位置',
  'spacer.height': '高さ（px）',
  'imageText.image': '画像',
  'imageText.image.src': '画像の URL',
  'imageText.image.alt': '代替テキスト',
  'imageText.image.href': 'リンク先',
  'imageText.image.naturalWidth': '画像の実際の幅（px）',
  'imageText.image.naturalHeight': '画像の実際の高さ（px）',
  'imageText.imagePosition': '画像を置く側',
  'imageText.imageWidthPercent': '画像の幅（ブロック幅に対する %）',
  'imageText.html': 'テキスト（許可タグだけの HTML）',
  'social.items': 'リンクの一覧（並び順どおりに出力）',
  'social.items[].service': 'サービス（下の一覧から）',
  'social.items[].url': 'リンク先（`mailto:` も可）',
  'social.iconSize': 'アイコンの大きさ（px）',
  'social.align': '横位置',
  'social.iconStyle': 'アイコンの色（`socialIconBaseUrl` を使うとき）',
  'html.html': '生の HTML',
};

/**
 * @param {unknown} value
 */
function code(value) {
  return `\`${JSON.stringify(value)}\``;
}

/**
 * 型の表記
 * @param {Schema} schema
 */
function typeOf(schema) {
  const info = schema.info ?? { type: 'any' };
  const orNull = info.nullable ? ' \\| `null`' : '';
  switch (info.type) {
    case 'string':
      return `文字列${orNull}`;
    case 'boolean':
      return '真偽値';
    case 'color':
      return `色（\`#rrggbb\`）${orNull}`;
    case 'number': {
      const kind = info.integer ? '整数' : '数値';
      const min = Number.isFinite(info.min) ? info.min : null;
      const max = Number.isFinite(info.max) ? info.max : null;
      const range =
        min !== null && max !== null
          ? ` ${min}〜${max}`
          : min !== null
            ? ` ${min} 以上`
            : max !== null
              ? ` ${max} 以下`
              : '';
      return `${kind}${range}${orNull}`;
    }
    case 'oneOf':
      return (info.values ?? []).map((v) => code(v)).join(' \\| ');
    case 'spacing':
      return '余白 `{ top, right, bottom, left }`（0〜1000）';
    case 'object':
      return 'オブジェクト';
    case 'array':
      return '配列';
    default:
      return '任意';
  }
}

/**
 * スキーマから表の行を作る（入れ子は `a.b` の形で展開）
 * @param {Schema} schema object のスキーマ
 * @param {Record<string, unknown>} defaults
 * @param {string} scope 説明の接頭辞
 * @param {string} [prefix]
 * @returns {string[]}
 */
function rows(schema, defaults, scope, prefix = '') {
  const shape = schema.info?.shape ?? {};
  /** @type {string[]} */
  const out = [];
  for (const [key, child] of Object.entries(shape)) {
    const path = `${prefix}${key}`;
    const value = defaults?.[key];
    const description =
      /** @type {Record<string, string>} */ (DESCRIPTIONS)[`${scope}.${path}`] ?? '';
    const shown =
      child.info?.type === 'object' || child.info?.type === 'array' || value === undefined
        ? ''
        : code(value);
    out.push(`| \`${path}\` | ${typeOf(child)} | ${shown} | ${description} |`);
    if (child.info?.type === 'object') {
      out.push(...rows(child, /** @type {any} */ (value), scope, `${path}.`));
    } else if (child.info?.type === 'array' && child.info.item?.info?.type === 'object') {
      const itemDefaults = /** @type {any} */ (child.info.itemDefault?.() ?? {});
      out.push(...rows(child.info.item, itemDefaults, scope, `${path}[].`));
    }
  }
  return out;
}

/**
 * @param {Schema} schema
 * @param {Record<string, unknown>} defaults
 * @param {string} scope
 */
function table(schema, defaults, scope) {
  return [
    '| キー | 型 | 既定値 | 説明 |',
    '| --- | --- | --- | --- |',
    ...rows(schema, defaults, scope),
  ].join('\n');
}

/** @returns {string} */
export function buildReference() {
  const layouts = Object.entries(ROW_LAYOUTS)
    .map(([name, spans]) => `| ${code(name)} | ${spans.length} | ${spans.join(' : ')} |`)
    .join('\n');

  const blocks = BLOCK_TYPES.map((type) => {
    const def = /** @type {import('../src/core/blocks/types.js').CoreBlockDef} */ (
      getBlockDef(type)
    );
    const style = def.defaultStyle ? def.defaultStyle() : defaultBlockStyle();
    const fields = def.mergeTagFields.length
      ? def.mergeTagFields.map((f) => `\`${f}\``).join('、')
      : 'なし';
    const styleNote =
      JSON.stringify(style) === JSON.stringify(defaultBlockStyle())
        ? ''
        : `\n\n既定の \`style\`: ${code(style)}`;
    return `### \`${type}\`

${/** @type {Record<string, string>} */ (BLOCK_NOTES)[type] ?? ''}

${table(def.schema, def.defaults(), type)}

マージタグを使える項目: ${fields}${styleNote}`;
  }).join('\n\n');

  const services = SOCIAL_SERVICES.map(
    (service) => `\`${service}\`（${socialLabel(service, 'ja')}）`,
  ).join('、');
  const renamed = Object.entries(RENAMED_TAGS)
    .map(([from, to]) => `\`${from}\` → \`${to}\``)
    .join('、');

  const example = {
    version: TEMPLATE_VERSION,
    body: {
      settings: {
        ...defaultBodySettings(),
        title: '秋の新作のお知らせ',
        preheader: '新作アイテムのご案内です',
      },
      rows: [
        {
          id: 'r_intro',
          layout: '1',
          settings: {
            ...defaultRowSettings(),
            padding: { top: 24, right: 24, bottom: 8, left: 24 },
          },
          columns: [
            {
              id: 'c_intro',
              settings: defaultColumnSettings(),
              blocks: [
                {
                  id: 'b_greeting',
                  type: 'text',
                  values: { html: '<h1>{{name}} 様</h1><p>いつもご利用ありがとうございます。</p>' },
                  style: defaultBlockStyle(),
                  hideOn: null,
                },
                {
                  id: 'b_cta',
                  type: 'button',
                  values: {
                    label: '新作を見る',
                    href: 'https://example.com/new',
                    backgroundColor: '#e8590c',
                  },
                  style: defaultBlockStyle(),
                  hideOn: null,
                },
              ],
            },
          ],
        },
      ],
    },
    text: { mode: 'auto', content: null, sourceHash: null },
  };

  return `# テンプレート JSON リファレンス

<!-- このファイルは scripts/reference.js が src/core のスキーマから生成します。直接編集しないでください（npm run docs:reference）。 -->

Mailmason のテンプレートは 1 つの JSON で、HTML とテキストパートはすべてここから作られます。読み込み時（\`loadJson\` / \`migrate\` / \`validate\`）にスキーマで検査し、欠けた項目は既定値で補い、不正な値は既定値に置き換えて警告します。

## 全体

\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\`

| キー | 型 | 説明 |
| --- | --- | --- |
| \`version\` | ${code(TEMPLATE_VERSION)} | テンプレートの形式のバージョン。省略すると警告付きで補う。新しいバージョンは読み込めない |
| \`body.settings\` | オブジェクト | ボディ設定（下記） |
| \`body.rows\` | 配列 | 行の並び（上から順） |
| \`text\` | オブジェクト | テキストパート（下記） |

## ボディ設定（\`body.settings\`）

${table(bodySettingsSchema, /** @type {any} */ (defaultBodySettings()), 'body')}

## 行（\`body.rows[]\`）

| キー | 型 | 説明 |
| --- | --- | --- |
| \`id\` | 文字列 | テンプレート内で重複しない ID（空や重複は振り直して警告）。慣例は \`r_\` で始める |
| \`layout\` | 下のレイアウト | カラムの分け方 |
| \`settings\` | オブジェクト | 行の設定（下記） |
| \`columns\` | 配列 | カラム。数はレイアウトと同じ（合わなければ警告して合わせる） |

### レイアウト

幅は 12 分割で、カラムの間隔（\`columnGap\`）は内側にだけ入ります。

| \`layout\` | カラム数 | 幅の比（12 分割） |
| --- | --- | --- |
${layouts}

### 行の設定（\`settings\`）

${table(rowSettingsSchema, /** @type {any} */ (defaultRowSettings()), 'row')}

## カラム（\`columns[]\`）

| キー | 型 | 説明 |
| --- | --- | --- |
| \`id\` | 文字列 | 重複しない ID。慣例は \`c_\` で始める |
| \`settings\` | オブジェクト | カラムの設定（下記） |
| \`blocks\` | 配列 | ブロックの並び（上から順） |

${table(columnSettingsSchema, /** @type {any} */ (defaultColumnSettings()), 'column')}

## ブロック（\`blocks[]\`）

| キー | 型 | 説明 |
| --- | --- | --- |
| \`id\` | 文字列 | 重複しない ID。慣例は \`b_\` で始める |
| \`type\` | 文字列 | ブロックの種類（${BLOCK_TYPES.map((t) => `\`${t}\``).join(' / ')}）。未知の種類はデータを残したまま出力しない |
| \`values\` | オブジェクト | 種類ごとの値（下記）。省略した項目は既定値 |
| \`style\` | オブジェクト | 背景と余白（下記） |
| \`hideOn\` | \`"mobile"\` \\| \`null\` | \`"mobile"\` でスマホでは表示しない |

### 共通のスタイル（\`style\`）

${table(blockStyleSchema, /** @type {any} */ (defaultBlockStyle()), 'style')}

${blocks}

## リッチテキスト（\`text.html\` / \`imageText.html\`）

- 段落: ${[...BLOCK_TAGS].map((t) => `\`<${t}>\``).join(' ')}、リスト: ${[...LIST_TAGS].map((t) => `\`<${t}>\``).join(' ')} と \`<li>\`、改行: \`<br>\`
- 文字の装飾: ${[...INLINE_TAGS].map((t) => `\`<${t}>\``).join(' ')}
- \`<a>\` の \`href\` は \`http:\` \`https:\` \`mailto:\` \`tel:\` \`#\` とマージタグだけ。\`<span>\` の \`style\` は \`color\` と \`background-color\` だけ。段落の \`style\` は \`text-align\` だけ
- 読み替え: ${renamed}。\`<div>\` や \`<table>\` などは段落に、許可していないタグは外して中身の文字だけ残す。\`<script>\` \`<style>\` \`<img>\` などは中身ごと削除
- 文字サイズやフォントは文字単位では指定できません（ブロックの \`fontSize\` などを使う）

## SNS のサービス（\`social.items[].service\`）

${services}

## マージタグ

既定の区切りは \`{{\` と \`}}\` です（エディタの \`mergeTagDelimiters\` で変更可）。キーは英数字・\`_\`・\`.\`・\`-\` で、上の「マージタグを使える項目」とボディ設定の \`preheader\` / \`title\` に書けます。

## テキストパート（\`text\`）

${table(textPartSchema, { mode: 'auto', content: null, sourceHash: null }, 'text')}

\`mode: "manual"\` のとき、\`sourceHash\` が今の本文から作ったハッシュと違えば「手編集の後に本文が変わった」と判定します（\`resolveTextPart\` の \`stale\`）。
`;
}

/** Prettier で整形した結果 */
export async function formattedReference() {
  const config = (await prettier.resolveConfig(`${root}/README.md`)) ?? {};
  return prettier.format(buildReference(), { ...config, parser: 'markdown' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const content = await formattedReference();
  const check = process.argv.includes('--check');
  let stale = false;
  for (const file of REFERENCE_FILES) {
    const path = `${root}/${file}`;
    if (check) {
      let current = '';
      try {
        current = readFileSync(path, 'utf8');
      } catch {
        // 無ければ古い扱い
      }
      if (current !== content) {
        console.error(`${file} is out of date. Run: npm run docs:reference`);
        stale = true;
      }
    } else {
      writeFileSync(path, content);
      console.log(`wrote ${file}`);
    }
  }
  if (stale) process.exit(1);
}
