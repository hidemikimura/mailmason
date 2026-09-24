// テンプレート → 配信用 HTML（テーブル＋インライン CSS、最大互換）。DOM を使わない純粋関数
import { getBlockDef } from '../blocks/registry.js';
import { migrate } from '../migrate/index.js';
import { computeLayout } from '../model/layout.js';
import { DEFAULT_DELIMITERS, replaceMergeTags } from '../merge-tags.js';
import { escapeAttr } from '../richtext/entities.js';
import { TABLE_OPEN, paddingDecl, styleAttr } from './styles.js';
import { renderLines, wrap } from './lines.js';
import { skeleton } from './skeleton.js';

/** @import { Lines } from './lines.js' */
/** @import { ResolvedHtmlOptions } from '../blocks/types.js' */
/** @import { MergeTagDelimiters } from '../merge-tags.js' */
/** @import { Block, Row, Template } from '../model/types.js' */
/** @import { RowBox } from '../model/layout.js' */

/**
 * @typedef {Object} RenderHtmlOptions
 * @property {boolean} [minify] 改行・インデントを入れない（本番配信向け。既定 false）
 * @property {Record<string, string> | null} [mergeValues] 指定するとマージタグを値に置き換える（プレビュー用）
 * @property {MergeTagDelimiters} [mergeTagDelimiters] 既定 `{{` `}}`
 * @property {string} [socialIconBaseUrl] SNS アイコン PNG の置き場所。`{base}/{service}-{color|mono}.png` を参照する
 * @property {string} [locale] 既定 'ja'
 * @property {string} [lang] html 要素の lang（既定は locale）
 * @property {string} [outlookFontFamily] Outlook（Windows）で使うフォント（既定 'Arial, sans-serif'）
 * @property {readonly import('../blocks/types.js').CoreBlockDef[] | null} [blocks] カスタムブロックの定義（defineBlock() の戻り値の配列）
 */

/** Gmail が本文を途中で切る目安（約 102KB）に対する警告のしきい値（バイト） */
export const HTML_SIZE_WARNING_BYTES = 90 * 1024;

/**
 * @param {RenderHtmlOptions} options
 * @returns {ResolvedHtmlOptions}
 */
export function resolveHtmlOptions(options) {
  const locale = options.locale ?? 'ja';
  return {
    minify: options.minify ?? false,
    mergeValues: options.mergeValues ?? null,
    mergeTagDelimiters: options.mergeTagDelimiters ?? DEFAULT_DELIMITERS,
    socialIconBaseUrl: (options.socialIconBaseUrl ?? '').replace(/\/+$/, ''),
    locale,
    lang: options.lang ?? locale,
    outlookFontFamily: options.outlookFontFamily ?? 'Arial, sans-serif',
    blocks: options.blocks ?? null,
  };
}

/**
 * ブロック 1 つ分の行（<tr>）。余白と背景はセルに付ける（Outlook は div の padding を無視するため）
 * @param {Block} block
 * @param {number} width ブロックを置く幅
 * @param {Template} template
 * @param {ResolvedHtmlOptions} options
 * @returns {Lines}
 */
function renderBlock(block, width, template, options) {
  const def = getBlockDef(block.type, options.blocks);
  if (!def) return []; // 未知のブロックは出力しない
  const { padding, backgroundColor } = block.style;
  const contentWidth = Math.max(1, width - padding.left - padding.right);
  const content = def.renderHtml(block, {
    width: contentWidth,
    body: template.body.settings,
    options,
  });
  if (content.length === 0) return [];
  const hide = block.hideOn === 'mobile' ? ' class="mm-hide-mobile"' : '';
  const align = def.cellAlign ? ` align="${def.cellAlign(block)}"` : '';
  return [
    wrap(
      `<tr${hide}>`,
      [
        wrap(
          `<td${align}${styleAttr(paddingDecl(padding), backgroundColor && `background-color:${backgroundColor}`)}>`,
          content,
          '</td>',
        ),
      ],
      '</tr>',
    ),
  ];
}

/**
 * カラム内のブロックを 1 つのテーブルにまとめる（ブロックごとに 1 行）
 * @param {Block[]} blocks
 * @param {number} width
 * @param {Template} template
 * @param {ResolvedHtmlOptions} options
 * @returns {Lines}
 */
function renderBlocks(blocks, width, template, options) {
  const rows = blocks.flatMap((block) => renderBlock(block, width, template, options));
  return rows.length > 0 ? [wrap(`${TABLE_OPEN}>`, rows, '</table>')] : [];
}

/**
 * ブロックの中身だけの HTML（エディタのキャンバス表示用。余白・背景のラッパーは含めない）
 * @param {Block} block
 * @param {number} width ブロックの内容幅（px、ブロックの余白を除く）
 * @param {import('../model/types.js').BodySettings} body
 * @param {ResolvedHtmlOptions} options
 * @returns {string} 出力が無いブロック（画像未設定など）は空文字
 */
export function renderBlockContent(block, width, body, options) {
  const def = getBlockDef(block.type, options.blocks);
  if (!def) return '';
  return renderLines(def.renderHtml(block, { width, body, options }), false);
}

/**
 * @param {{ top: number, right: number, bottom: number, left: number }} a
 * @param {{ top: number, right: number, bottom: number, left: number }} b
 */
function addPadding(a, b) {
  return {
    top: a.top + b.top,
    right: a.right + b.right,
    bottom: a.bottom + b.bottom,
    left: a.left + b.left,
  };
}

/** @param {{ top: number, right: number, bottom: number, left: number }} p */
const hasPadding = (p) => p.top > 0 || p.right > 0 || p.bottom > 0 || p.left > 0;

/**
 * 行を出力する。入れ子のテーブルは必要なときだけ作る:
 * - 1 カラムで、カラムに余白・背景・縦位置の指定が無ければ、行のセルに直接ブロックを並べる
 * - カラムの余白・背景は、カラム間の余白（gap）と混ざらないときはカラムのセルに直接付ける
 * @param {Row} row
 * @param {RowBox} box
 * @param {Template} template
 * @param {ResolvedHtmlOptions} options
 * @returns {Lines}
 */
function renderRow(row, box, template, options) {
  const stack = row.settings.stackOnMobile && row.columns.length > 1;
  const rowCell = (/** @type {Lines} */ children) => {
    const hide = row.settings.hideOn === 'mobile' ? ' class="mm-hide-mobile"' : '';
    return [
      wrap(
        '<tr>',
        [
          wrap(
            `<td${hide}${styleAttr(paddingDecl(row.settings.padding), row.settings.backgroundColor && `background-color:${row.settings.backgroundColor}`)}>`,
            children,
            '</td>',
          ),
        ],
        '</tr>',
      ),
    ];
  };

  if (row.columns.length === 1) {
    const [column] = row.columns;
    const { settings } = column;
    const plain =
      !hasPadding(settings.padding) &&
      !settings.backgroundColor &&
      settings.verticalAlign === 'top';
    if (plain) {
      return rowCell(renderBlocks(column.blocks, box.columns[0].contentWidth, template, options));
    }
  }

  const cells = row.columns.map((column, i) => {
    const size = box.columns[i];
    const { settings } = column;
    const valign = settings.verticalAlign;
    const gap = { top: 0, right: size.gapRight, bottom: 0, left: size.gapLeft };
    const hasGap = size.gapLeft > 0 || size.gapRight > 0;
    const blocks = renderBlocks(column.blocks, size.contentWidth, template, options);
    const col = stack ? ' class="mm-col"' : '';
    // スマホで縦に並べるとき .mm-col は左右の余白を 0 にするので、カラム自身の左右の余白は分けて持つ
    const sidePadding = settings.padding.left > 0 || settings.padding.right > 0;
    const merge = !hasGap || (!settings.backgroundColor && !(stack && sidePadding));
    if (merge) {
      return wrap(
        `<td${col} width="${size.outerWidth}" valign="${valign}"${styleAttr(
          `width:${size.outerWidth}px`,
          hasPadding(addPadding(gap, settings.padding)) &&
            paddingDecl(addPadding(gap, settings.padding)),
          settings.backgroundColor && `background-color:${settings.backgroundColor}`,
          `vertical-align:${valign}`,
        )}>`,
        blocks,
        '</td>',
      );
    }
    return wrap(
      `<td${col} width="${size.outerWidth}" valign="${valign}"${styleAttr(
        `width:${size.outerWidth}px`,
        hasGap && paddingDecl(gap),
        `vertical-align:${valign}`,
      )}>`,
      [
        wrap(
          `${TABLE_OPEN}>`,
          [
            wrap(
              '<tr>',
              [
                wrap(
                  `<td valign="${valign}"${styleAttr(paddingDecl(settings.padding), settings.backgroundColor && `background-color:${settings.backgroundColor}`)}>`,
                  blocks,
                  '</td>',
                ),
              ],
              '</tr>',
            ),
          ],
          '</table>',
        ),
      ],
      '</td>',
    );
  });

  return rowCell([wrap(`${TABLE_OPEN}>`, [wrap('<tr>', cells, '</tr>')], '</table>')]);
}

/**
 * テンプレートから配信用 HTML を作る。
 * 入力は migrate() で正規化してから使うので、保存済みの JSON をそのまま渡してよい
 * （警告を知りたいときは validate() を使う）。同じ入力からは常に同じ出力になる。
 *
 * @param {unknown} input テンプレート（オブジェクトまたは JSON 文字列）
 * @param {RenderHtmlOptions} [options]
 * @returns {string}
 */
export function renderHtml(input, options = {}) {
  const resolved = resolveHtmlOptions(options);
  const { template } = migrate(input, {
    mergeTagDelimiters: resolved.mergeTagDelimiters,
    blocks: resolved.blocks,
  });
  const layout = computeLayout(template);
  const rows = template.body.rows.map((row) =>
    renderRow(row, /** @type {RowBox} */ (layout.get(row.id)), template, resolved),
  );
  const html = renderLines(skeleton(template.body.settings, resolved, rows), !resolved.minify);
  return resolved.mergeValues
    ? replaceMergeTags(html, resolved.mergeValues, {
        delimiters: resolved.mergeTagDelimiters,
        escape: escapeAttr,
      })
    : html;
}
