// パレット: ブロックと行レイアウトの一覧。クリックで追加する（ドラッグ&ドロップは M5）
import { LitElement, css, html, nothing } from 'lit';
import { createBlock, createRow } from '../../core/model/factory.js';
import { ROW_LAYOUT_NAMES, getLayoutSpans } from '../../core/model/layout.js';
import { findRowIndex, locateBlock, locateColumn } from '../../core/model/tree.js';
import { PALETTE_BLOCKS, getEditorBlockDef } from '../blocks/index.js';
import { controls } from '../styles.js';
import { define } from '../context.js';

/** @import { RowLayout } from '../../core/model/types.js' */
/** @import { EditorContext } from '../context.js' */

/**
 * 選択中の要素を基準にブロックを追加する。
 * ブロック選択中 → その直後 / カラム選択中 → カラムの末尾 / 行選択中 → 先頭カラムの末尾 /
 * 何も選択していない → 1 カラムの行を末尾に作って入れる
 * @param {EditorContext} ctx
 * @param {string} type
 * @returns {string} 追加したブロックの ID
 */
export function insertBlock(ctx, type) {
  const { store, t } = ctx;
  const def = getEditorBlockDef(type);
  const block = createBlock(type, def?.initialValues?.(t) ?? {});
  const { template, selection } = store.getState();

  const inBlock = selection ? locateBlock(template, selection) : null;
  const inColumn = selection ? locateColumn(template, selection) : null;
  const rowIndex = selection ? findRowIndex(template, selection) : -1;

  if (inBlock) {
    const column = template.body.rows[inBlock.rowIndex].columns[inBlock.columnIndex];
    store.dispatch({ type: 'addBlock', columnId: column.id, index: inBlock.blockIndex + 1, block });
  } else if (inColumn) {
    store.dispatch({ type: 'addBlock', columnId: /** @type {string} */ (selection), block });
  } else if (rowIndex !== -1) {
    store.dispatch({
      type: 'addBlock',
      columnId: template.body.rows[rowIndex].columns[0].id,
      block,
    });
  } else {
    store.dispatch({ type: 'addRow', row: createRow('1', [[block]]) });
  }
  store.select(block.id);
  return block.id;
}

/**
 * 選択中の要素を含む行の直後（無ければ末尾）に行を追加する
 * @param {EditorContext} ctx
 * @param {RowLayout} layout
 * @returns {string} 追加した行の ID
 */
export function insertRow(ctx, layout) {
  const { store } = ctx;
  const { template, selection } = store.getState();
  let index = template.body.rows.length;
  if (selection) {
    const hit =
      locateBlock(template, selection)?.rowIndex ??
      locateColumn(template, selection)?.rowIndex ??
      findRowIndex(template, selection);
    if (hit !== -1) index = hit + 1;
  }
  const row = createRow(layout);
  store.dispatch({ type: 'addRow', row, index });
  store.select(row.id);
  return row.id;
}

export class MmPalette extends LitElement {
  static properties = {
    ctx: { attribute: false },
    _tab: { state: true },
  };

  static styles = [
    controls,
    css`
      :host {
        display: flex;
        flex-direction: column;
        background: var(--mm-color-surface);
        border-right: 1px solid var(--mm-color-border);
        overflow: auto;
      }
      .tabs {
        display: flex;
        border-bottom: 1px solid var(--mm-color-border);
      }
      .tabs button {
        flex: 1;
        border: 0;
        border-radius: 0;
        padding: 10px 8px;
        background: transparent;
        border-bottom: 2px solid transparent;
      }
      .tabs button[aria-selected='true'] {
        border-bottom-color: var(--mm-color-accent);
        font-weight: 600;
      }
      .hint {
        margin: 10px 12px 4px;
        color: var(--mm-color-muted);
        font-size: 11px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 8px 12px 16px;
      }
      .item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 4px;
        font-size: 12px;
      }
      .item {
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .item svg {
        width: 22px;
        height: 22px;
      }
      .preview {
        display: flex;
        gap: 3px;
        width: 64px;
        height: 22px;
      }
      .preview span {
        background: var(--mm-color-accent-soft);
        border: 1px solid var(--mm-color-accent);
        border-radius: 2px;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    /** @type {'blocks' | 'rows'} */
    this._tab = 'blocks';
  }

  render() {
    const { ctx } = this;
    if (!ctx) return nothing;
    const { t } = ctx;
    const tab = (/** @type {'blocks' | 'rows'} */ name, /** @type {string} */ key) =>
      html`<button
        type="button"
        role="tab"
        aria-selected=${this._tab === name ? 'true' : 'false'}
        @click=${() => (this._tab = name)}
      >
        ${t(key)}
      </button>`;

    return html`<div class="tabs" role="tablist">
        ${tab('blocks', 'palette.blocks')} ${tab('rows', 'palette.rows')}
      </div>
      <p class="hint">${t('palette.hint')}</p>
      ${
        this._tab === 'blocks'
          ? html`<div class="grid" role="tabpanel">
              ${PALETTE_BLOCKS.map((type) => {
                const def = /** @type {import('../blocks/index.js').EditorBlockDef} */ (
                  getEditorBlockDef(type)
                );
                return html`<button
                  type="button"
                  class="item"
                  data-block-type=${type}
                  @pointerdown=${(/** @type {PointerEvent} */ e) =>
                    ctx.dnd.start(e, { kind: 'new-block', type })}
                  @click=${() => insertBlock(ctx, type)}
                >
                  ${def.icon}<span>${t(def.labelKey)}</span>
                </button>`;
              })}
            </div>`
          : html`<div class="grid" role="tabpanel">
              ${ROW_LAYOUT_NAMES.map(
                (layout) =>
                  html`<button
                    type="button"
                    class="item"
                    data-layout=${layout}
                    @pointerdown=${(/** @type {PointerEvent} */ e) =>
                      ctx.dnd.start(e, { kind: 'new-row', layout })}
                    @click=${() => insertRow(ctx, layout)}
                  >
                    <span class="preview">
                      ${getLayoutSpans(layout).map((span) => html`<span style="flex:${span}"></span>`)}
                    </span>
                    <span>${t(`layout.${layout}`)}</span>
                  </button>`,
              )}
            </div>`
      }`;
  }
}

define('mm-palette', MmPalette);
