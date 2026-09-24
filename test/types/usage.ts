// 型定義の使い方の検査（npm run typecheck で tsc にかける。実行はしない）。
// 利用者と同じくパッケージ名で import し、通るべき書き方と、エラーになるべき書き方（@ts-expect-error）を並べる
import {
  MailmasonEditor,
  MailmasonError,
  createBlock,
  createRow,
  createTemplate,
  defineBlock,
  migrate,
  renderHtml,
  resolveTextPart,
  type Block,
  type BlockOf,
  type EditorWarning,
  type ImageUploadHook,
  type MergeTag,
  type Template,
} from '@hidemikimura/mailmason';
import * as core from '@hidemikimura/mailmason/core';

// ---- テンプレートとブロック ----

const template: Template = createTemplate({ width: 640 });
const table = createBlock('table', {
  cells: [
    ['サイズ', '着丈'],
    ['S', '64 cm'],
  ],
  columns: [{ align: 'left' }, { width: 40, align: 'right' }],
});
const tableCells: string[][] = table.values.cells;
const button = createBlock('button', { label: '購入する', innerPadding: { top: 16 } });
template.body.rows.push(createRow('1:1', [[table], [button]]));

// @ts-expect-error 標準ブロックの values にない項目
createBlock('table', { rows: 3 });
// @ts-expect-error 選択肢にない値
createBlock('video', { ratio: '21:9' });
// @ts-expect-error 型の違う値
createBlock('spacer', { height: '24px' });
// @ts-expect-error 行のレイアウトにない値
createRow('1:3');

// カスタムブロックは type にハイフンを含む任意の文字列、values は任意
const coupon: Block = createBlock('acme-coupon', { code: 'A1' });

// block.type で values の型が絞り込まれる
function describeBlock(block: Block): string {
  switch (block.type) {
    case 'table':
      return `${block.values.cells.length} 行 × ${block.values.columns.length} 列`;
    case 'video':
      return block.values.thumbnail.src || block.values.url;
    case 'gallery':
      return block.values.items.map((item) => item.image.alt).join(', ');
    case 'text':
      // @ts-expect-error テキストのブロックに cells は無い
      return block.values.cells;
    default:
      return block.type;
  }
}
describeBlock(coupon);

const video: BlockOf<'video'> = createBlock('video', { playButton: 'light' });
const ratio: '16:9' | '4:3' | '1:1' = video.values.ratio;

// ---- 読み込みと書き出し ----

const { template: loaded, warnings } = migrate('{"version":1}');
const codes: string[] = warnings.map((warning) => warning.code);
const html: string = renderHtml(loaded, { minify: true, mergeValues: { name: '山田' } });
const { text, mode, stale } = resolveTextPart(loaded, { wrapWidth: 72 });
// @ts-expect-error オプションにない項目
renderHtml(loaded, { minified: true });

try {
  migrate('not json');
} catch (error) {
  if (error instanceof MailmasonError) {
    const code: string = error.code;
    const path: string | null = error.path;
    void [code, path];
  }
}

// ---- カスタムブロック ----

const productBlock = defineBlock({
  type: 'acme-product',
  label: { ja: '商品', en: 'Product' },
  fields: [
    { key: 'name', kind: 'text', label: '商品名', mergeTags: true },
    { key: 'items', kind: 'list', label: '項目', fields: [{ key: 'x', kind: 'text', label: 'x' }] },
    {
      kind: 'action',
      label: '読み込む',
      run: async ({ values }) => ({ name: String(values.name) }),
    },
  ],
  renderHtml: (values, ctx) =>
    `<p style="font-family:${ctx.body.fontFamily}">${ctx.escape(values.name)}</p>` +
    ctx.button({ label: '見る', href: 'https://example.com/' }),
  renderText: (values) => String(values.name),
});
renderHtml(template, { blocks: [productBlock] });
defineBlock({
  type: 'acme-bad',
  label: 'x',
  // @ts-expect-error 設定項目の種類にない値
  fields: [{ key: 'a', kind: 'date', label: 'a' }],
  renderHtml: () => '',
});

// ---- エディタ ----

const editor = document.querySelector('mailmason-editor');
if (editor) {
  const same: MailmasonEditor = editor;
  editor.locale = 'en';
  editor.colorMode = 'auto';
  // @ts-expect-error 配色にない値
  editor.colorMode = 'sepia';
  editor.blocks = [productBlock];
  editor.mergeTags = [{ key: 'name', label: '氏名', sample: '山田 太郎' }] satisfies MergeTag[];

  const upload: ImageUploadHook = async (file, { blockId }) => ({
    url: `https://cdn.example.com/${blockId}/${file.name}`,
    data: { id: 1 },
  });
  editor.onImageUpload = upload;
  editor.onSaveComponent = async (component) => ({ ...component, id: 'c1' });

  editor.addEventListener('mm-change', (event) => {
    const saved: Template = event.detail.template;
    const actions: string[] = event.detail.actions;
    void [saved, actions];
  });
  editor.addEventListener('mm-select', (event) => {
    const kind: 'row' | 'column' | 'block' | null = event.detail.kind;
    void kind;
  });
  editor.addEventListener('mm-warning', (event) => {
    const warning: EditorWarning = event.detail;
    const bytes: number | undefined = warning.bytes;
    void bytes;
  });
  editor.addEventListener('mm-view', (event) => {
    // @ts-expect-error view は 'edit' | 'preview'
    const view: 'print' = event.detail.view;
    void view;
  });
  // 標準のイベントもそのまま使える
  editor.addEventListener('click', (event) => void event.clientX);

  const warningsOnLoad = editor.loadJson(template);
  const current: Template = editor.getJson();
  const exported: { html: string; text: string } = editor.export({ html: { minify: true } });
  const inserted: string | null = editor.insertComponent({
    name: 'ヘッダー',
    kind: 'block',
    version: 1,
    content: button,
  });
  editor.select(null);
  // @ts-expect-error 内部の状態は公開しない
  editor._store;
  void [same, warningsOnLoad, current, exported, inserted];
}

// core だけでも同じ型を使える（DOM・Lit なし）
const coreTemplate: core.Template = core.createTemplate();
const tableBlock: core.BlockOf<'table'> = core.createBlock('table');
void [tableCells, ratio, codes, html, text, mode, stale, coreTemplate, tableBlock];
