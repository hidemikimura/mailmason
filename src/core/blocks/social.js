import { s } from '../model/schema.js';
import { escapeAttr, escapeText } from '../richtext/entities.js';
import { translate } from '../i18n/index.js';
import { fontDecls, resolveTextStyle, styleAttr } from '../render-html/styles.js';

/** 対応する SNS サービス */
export const SOCIAL_SERVICES = Object.freeze([
  'x',
  'facebook',
  'instagram',
  'line',
  'youtube',
  'tiktok',
  'linkedin',
  'website',
  'email',
]);

/** @type {Record<string, string>} ブランド名（翻訳しない） */
const BRAND_NAMES = {
  x: 'X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  line: 'LINE',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

/**
 * @param {string} service
 * @param {string} locale
 * @returns {string}
 */
export function socialLabel(service, locale) {
  return BRAND_NAMES[service] ?? translate(locale, `social.${service}`);
}

/**
 * @param {unknown} items
 * @returns {{ service: string, url: string }[]}
 */
function activeItems(items) {
  return Array.isArray(items) ? items.filter((item) => item.url) : [];
}

/** @type {import('./types.js').CoreBlockDef} */
export const socialBlock = {
  type: 'social',
  defaults: () => ({
    items: [],
    iconSize: 32,
    align: 'center',
    iconStyle: 'color',
  }),
  schema: s.object({
    items: s.arrayOf(s.object({ service: s.oneOf(SOCIAL_SERVICES), url: s.string() }), () => ({
      service: 'website',
      url: '',
    })),
    iconSize: s.number({ min: 16, max: 64, integer: true }),
    align: s.oneOf(['left', 'center', 'right']),
    iconStyle: s.oneOf(['color', 'mono']),
  }),
  mergeTagFields: ['items'],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block, ctx) {
    const v = /** @type {any} */ (block.values);
    const items = activeItems(v.items);
    if (items.length === 0) return [];
    const { locale, socialIconBaseUrl } = ctx.options;

    if (!socialIconBaseUrl) {
      // アイコン画像のホストが無いときはテキストリンクで出す
      const style = resolveTextStyle(ctx.body);
      const links = items.map(
        (item) =>
          `<a href="${escapeAttr(item.url)}" target="_blank"${styleAttr(`color:${ctx.body.linkColor}`, 'text-decoration:underline')}>${escapeText(socialLabel(item.service, locale))}</a>`,
      );
      return [
        `<p${styleAttr('margin:0', ...fontDecls(style), `text-align:${v.align}`)}>${links.join(' | ')}</p>`,
      ];
    }

    const size = v.iconSize;
    const cells = items.map((item, i) => {
      const src = `${socialIconBaseUrl}/${item.service}-${v.iconStyle}.png`;
      const pad = i === items.length - 1 ? 'padding:0' : 'padding:0 8px 0 0';
      return `<td${styleAttr(pad)}><a href="${escapeAttr(item.url)}" target="_blank"><img src="${escapeAttr(src)}" alt="${escapeAttr(socialLabel(item.service, locale))}" width="${size}" height="${size}"${styleAttr('display:block', 'border:0', 'outline:none')} /></a></td>`;
    });
    const margin =
      v.align === 'center' ? 'margin:0 auto' : v.align === 'right' ? 'margin:0 0 0 auto' : null;
    return [
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${v.align === 'center' ? ' align="center"' : ''}${styleAttr(margin)}>`,
      ['<tr>', cells, '</tr>'],
      '</table>',
    ];
  },

  renderText(block, ctx) {
    const items = activeItems(block.values.items);
    return items
      .map(
        (item) =>
          `${socialLabel(item.service, ctx.options.locale)}: ${item.url.replace(/^mailto:/i, '')}`,
      )
      .join('\n');
  },
};
