// テストとデモで使うカスタムブロックの例
import { defineBlock } from '../../src/core/index.js';

/** クーポン: 決まった項目を決まったレイアウトで出す */
export const couponBlock = defineBlock({
  type: 'acme-coupon',
  label: { ja: 'クーポン', en: 'Coupon' },
  icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/></svg>',
  fields: [
    { key: 'title', kind: 'text', label: '見出し', default: '期間限定クーポン', mergeTags: true },
    { key: 'code', kind: 'text', label: 'コード', default: 'AUTUMN2026', mergeTags: true },
    { key: 'note', kind: 'textarea', label: '注意書き', default: '' },
    { key: 'color', kind: 'color', label: '枠の色', default: '#e8590c' },
    { key: 'url', kind: 'url', label: 'リンク先', mergeTags: true },
  ],
  renderHtml(v, ctx) {
    if (!v.code) return '';
    return [
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px dashed ${v.color};">`,
      `<tr><td align="center" style="padding:16px;font-family:${ctx.body.fontFamily};color:${ctx.body.textColor};">`,
      `<p style="margin:0 0 8px;font-size:14px;">${ctx.escape(v.title)}</p>`,
      `<p style="margin:0;font-size:24px;font-weight:bold;letter-spacing:2px;">${ctx.escape(v.code)}</p>`,
      v.note ? `<p style="margin:8px 0 0;font-size:12px;">${ctx.text(v.note)}</p>` : '',
      v.url
        ? `<div style="padding-top:12px;">${ctx.button({ label: '使う', href: v.url, backgroundColor: v.color })}</div>`
        : '',
      '</td></tr></table>',
    ];
  },
  renderText: (v) => (v.code ? `${v.title}: ${v.code}${v.url ? ` ( ${v.url} )` : ''}` : ''),
});

/** 商品リスト: 件数が変わる項目の配列 */
export const productListBlock = defineBlock({
  type: 'acme-products',
  label: '商品リスト',
  fields: [
    {
      key: 'items',
      kind: 'list',
      label: '商品',
      min: 1,
      max: 6,
      itemLabel: (item, i) => String(item.name || `商品 ${i + 1}`),
      default: [{ name: 'ニット' }],
      fields: [
        { key: 'image', kind: 'image', label: '画像' },
        { key: 'name', kind: 'text', label: '商品名', mergeTags: true },
        { key: 'price', kind: 'number', label: '価格', min: 0, unit: '円' },
        { key: 'url', kind: 'url', label: 'リンク先' },
      ],
    },
    {
      key: 'columns',
      kind: 'select',
      label: '1 行の数',
      choices: [
        { value: '2', label: '2 つ' },
        { value: '3', label: '3 つ' },
      ],
    },
    {
      kind: 'action',
      label: '商品を選ぶ…',
      run: async () => null,
    },
  ],
  renderHtml(v, ctx) {
    const items = v.items.filter((/** @type {any} */ item) => item.name);
    if (items.length === 0) return '';
    const per = Number(v.columns);
    const width = Math.floor(ctx.width / per);
    const cells = items.map(
      (/** @type {any} */ item) =>
        `<td class="mm-col" width="${width}" valign="top" style="width:${width}px;padding:4px;">` +
        ctx.image({ ...item.image, href: item.url, width: width - 8 }) +
        `<p style="margin:4px 0 0;">${ctx.escape(item.name)}</p>` +
        `<p style="margin:0;">¥${item.price.toLocaleString('ja-JP')}</p></td>`,
    );
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells.join('')}</tr></table>`;
  },
  renderText: (v) =>
    v.items
      .filter((/** @type {any} */ item) => item.name)
      .map(
        (/** @type {any} */ item) =>
          `${item.name} ¥${item.price}${item.url ? ` ( ${item.url} )` : ''}`,
      )
      .join('\n'),
});

export const customBlocks = [couponBlock, productListBlock];
