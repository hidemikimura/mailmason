// デモ用のカスタムブロック（開発用デモとドキュメントサイトのデモで使う）
import { defineBlock } from '../src/core/index.js';

/**
 * @param {string} imageBase サンプル画像のフォルダの URL（末尾 /）
 */
export function createDemoBlocks(imageBase) {
  const base = imageBase.endsWith('/') ? imageBase : `${imageBase}/`;
  /** 商品カタログ（実際のアプリでは自社の商品 DB から選ぶ） */
  const catalog = [
    { name: 'ウールのケーブルニット', price: 12800, image: 'knit.jpg' },
    { name: 'ロングチェスターコート', price: 29800, image: 'coat.jpg' },
    { name: 'カシミヤのマフラー', price: 8900, image: 'item1.jpg' },
    { name: 'レザーの手袋', price: 6800, image: 'item2.jpg' },
  ];

  const coupon = defineBlock({
    type: 'demo-coupon',
    label: { ja: 'クーポン', en: 'Coupon' },
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/></svg>',
    fields: [
      { key: 'title', kind: 'text', label: '見出し', default: '期間限定クーポン', mergeTags: true },
      { key: 'code', kind: 'text', label: 'コード', default: '{{coupon}}', mergeTags: true },
      { key: 'note', kind: 'textarea', label: '注意書き', default: '10 月 31 日まで有効です。' },
      { key: 'color', kind: 'color', label: '色', default: '#b45309' },
      { key: 'url', kind: 'url', label: 'ボタンのリンク先', mergeTags: true },
      { key: 'buttonLabel', kind: 'text', label: 'ボタンの文字', default: 'クーポンを使う' },
    ],
    renderHtml(v, ctx) {
      if (!v.code) return '';
      const font = `font-family:${ctx.body.fontFamily};`;
      return [
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px dashed ${v.color};border-radius:8px;">`,
        `<tr><td align="center" style="padding:20px 16px;${font}color:${ctx.body.textColor};">`,
        `<p style="margin:0 0 6px;font-size:14px;">${ctx.escape(v.title)}</p>`,
        `<p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:3px;color:${v.color};">${ctx.escape(v.code)}</p>`,
        v.note ? `<p style="margin:8px 0 0;font-size:12px;">${ctx.text(v.note)}</p>` : '',
        v.url
          ? `<div style="padding-top:14px;">${ctx.button({ label: v.buttonLabel, href: v.url, backgroundColor: v.color })}</div>`
          : '',
        '</td></tr></table>',
      ];
    },
    renderText: (v) =>
      v.code ? `【${v.title}】${v.code}${v.url ? `\n${v.buttonLabel}: ${v.url}` : ''}` : '',
  });

  const products = defineBlock({
    type: 'demo-products',
    label: { ja: '商品リスト', en: 'Products' },
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3.5" y="4" width="7" height="7" rx="1"/><rect x="13.5" y="4" width="7" height="7" rx="1"/><path d="M4 15h6M4 18h4M14 15h6M14 18h4"/></svg>',
    fields: [
      {
        kind: 'action',
        label: 'カタログから商品を追加',
        help: '実際のアプリでは、自社の商品 DB から選ぶ画面を開くなどして値を返します',
        run: ({ values }) => {
          const items = /** @type {any[]} */ (values.items);
          const next = catalog[items.length % catalog.length];
          return {
            items: [
              ...items,
              {
                name: next.name,
                price: next.price,
                url: 'https://example.com/products',
                image: {
                  src: base + next.image,
                  alt: next.name,
                  naturalWidth: 600,
                  naturalHeight: 600,
                },
              },
            ],
          };
        },
      },
      {
        key: 'items',
        kind: 'list',
        label: '商品',
        max: 6,
        itemLabel: (item, i) => String(item.name || `商品 ${i + 1}`),
        fields: [
          { key: 'image', kind: 'image', label: '画像' },
          { key: 'name', kind: 'text', label: '商品名' },
          { key: 'price', kind: 'number', label: '価格（税込）', min: 0, unit: '円' },
          { key: 'url', kind: 'url', label: 'リンク先' },
        ],
      },
      {
        key: 'perRow',
        kind: 'align',
        label: '1 行の数',
        choices: [
          { value: '2', label: '2 つ' },
          { value: '3', label: '3 つ' },
        ],
      },
    ],
    renderHtml(v, ctx) {
      const items = /** @type {any[]} */ (v.items).filter((item) => item.name);
      if (items.length === 0) return '';
      const per = Number(v.perRow);
      const width = Math.floor(ctx.width / per);
      const font = `font-family:${ctx.body.fontFamily};color:${ctx.body.textColor};`;
      /** @type {string[]} */
      const rows = [];
      for (let i = 0; i < items.length; i += per) {
        const cells = items
          .slice(i, i + per)
          .map(
            (item) =>
              `<td class="mm-col" width="${width}" valign="top" style="width:${width}px;padding:6px;${font}">` +
              ctx.image({ ...item.image, href: item.url, width: width - 12 }) +
              `<p style="margin:8px 0 2px;font-size:14px;font-weight:bold;">${ctx.escape(item.name)}</p>` +
              `<p style="margin:0;font-size:13px;">¥${Number(item.price).toLocaleString('ja-JP')}</p></td>`,
          );
        while (cells.length < per)
          cells.push(`<td class="mm-col" width="${width}" style="width:${width}px;"></td>`);
        rows.push(`<tr>${cells.join('')}</tr>`);
      }
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>`;
    },
    renderText: (v) =>
      /** @type {any[]} */ (v.items)
        .filter((item) => item.name)
        .map(
          (item) =>
            `${item.name} ¥${Number(item.price).toLocaleString('ja-JP')}${item.url ? `\n${item.url}` : ''}`,
        )
        .join('\n\n'),
  });

  return [coupon, products];
}
