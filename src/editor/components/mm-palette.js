// パレット: ブロックと行レイアウトの一覧。クリックで追加する（ドラッグ&ドロップは M5）
import { LitElement, css, html, nothing } from 'lit';
import { createBlock, createRow } from '../../core/model/factory.js';
import { ROW_LAYOUT_NAMES, getLayoutSpans } from '../../core/model/layout.js';
import { findRowIndex, locateBlock, locateColumn } from '../../core/model/tree.js';
import { blockLabel, getEditorBlockDef, paletteBlocks } from '../blocks/index.js';
import { controls } from '../styles.js';
import { icons } from '../icons.js';
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
  const def = getEditorBlockDef(type, ctx.blocks);
  const block = createBlock(type, def?.initialValues?.(ctx.t) ?? {}, { blocks: ctx.blocks });
  return placeBlock(ctx, block);
}

/**
 * 作ったブロックを、選択中の要素に合わせた位置に入れる（insertBlock と同じ規則）
 * @param {EditorContext} ctx
 * @param {import('../../core/model/types.js').Block} block
 * @returns {string} 追加したブロックの ID
 */
export function placeBlock(ctx, block) {
  const { store } = ctx;
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
  return placeRow(ctx, createRow(layout));
}

/**
 * 作った行を、選択中の要素を含む行の直後（無ければ末尾）に入れる
 * @param {EditorContext} ctx
 * @param {import('../../core/model/types.js').Row} row
 * @returns {string} 追加した行の ID
 */
export function placeRow(ctx, row) {
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
        padding: 10px 4px;
        white-space: nowrap;
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
      .saved {
        display: grid;
        gap: 6px;
        padding: 8px 12px 16px;
      }
      .saved-item {
        display: flex;
        align-items: stretch;
        gap: 4px;
      }
      .saved-item .insert {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        text-align: left;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .saved-item .insert svg {
        flex: none;
        width: 20px;
        height: 20px;
      }
      .saved-item .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .saved-item .kind {
        flex: none;
        font-size: 10px;
        color: var(--mm-color-muted);
      }
      .saved-item .delete {
        flex: none;
        padding: 0 8px;
      }
      .empty {
        margin: 8px 12px;
        color: var(--mm-color-muted);
        font-size: 12px;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    /** @type {'blocks' | 'rows' | 'saved'} */
    this._tab = 'blocks';
  }

  /** パレットの「保存済み」: 保存したコンポーネントの一覧 */
  _renderSaved() {
    const ctx = /** @type {EditorContext} */ (this.ctx);
    const { t } = ctx;
    if (ctx.components.length === 0) {
      return html`<p class="empty" role="tabpanel">${t('palette.savedEmpty')}</p>`;
    }
    return html`<div class="saved" role="tabpanel">
      ${ctx.components.map(
        (component, i) =>
          html`<div class="saved-item" data-component-id=${component.id ?? String(i)}>
            <button
              type="button"
              class="insert"
              title=${component.name}
              @pointerdown=${(/** @type {PointerEvent} */ e) =>
                ctx.dnd.start(e, { kind: 'component', component })}
              @click=${() => ctx.insertComponent(component)}
            >
              ${component.kind === 'row' ? icons.savedRow : icons.savedBlock}
              <span class="name">${component.name || t('component.untitled')}</span>
              <span class="kind"
                >${t(component.kind === 'row' ? 'crumb.row' : 'component.block')}</span
              >
            </button>
            ${
              ctx.canDeleteComponents
                ? html`<button
                    type="button"
                    class="delete"
                    data-action="delete-component"
                    title=${t('component.delete')}
                    aria-label=${t('component.delete')}
                    @click=${() => ctx.deleteComponent(component)}
                  >
                    ✕
                  </button>`
                : nothing
            }
          </div>`,
      )}
    </div>`;
  }

  render() {
    const { ctx } = this;
    if (!ctx) return nothing;
    const { t } = ctx;
    const showSaved = ctx.canSaveComponents || ctx.components.length > 0;
    const current = this._tab === 'saved' && !showSaved ? 'blocks' : this._tab;
    const tab = (/** @type {'blocks' | 'rows' | 'saved'} */ name, /** @type {string} */ key) =>
      html`<button
        type="button"
        role="tab"
        aria-selected=${current === name ? 'true' : 'false'}
        data-tab=${name}
        @click=${() => (this._tab = name)}
      >
        ${t(key)}
      </button>`;

    return html`<div class="tabs" role="tablist">
        ${tab('blocks', 'palette.blocks')} ${tab('rows', 'palette.rows')}
        ${showSaved ? tab('saved', 'palette.saved') : nothing}
      </div>
      <p class="hint">${t('palette.hint')}</p>
      ${
        current === 'saved'
          ? this._renderSaved()
          : current === 'blocks'
            ? html`<div class="grid" role="tabpanel">
                ${paletteBlocks(ctx.blocks).map((type) => {
                  const def = /** @type {import('../blocks/index.js').EditorBlockDef} */ (
                    getEditorBlockDef(type, ctx.blocks)
                  );
                  if (def.requiresUpload && !ctx.onImageUpload) return nothing;
                  return html`<button
                    type="button"
                    class="item"
                    data-block-type=${type}
                    @pointerdown=${(/** @type {PointerEvent} */ e) =>
                      ctx.dnd.start(e, { kind: 'new-block', type })}
                    @click=${() => insertBlock(ctx, type)}
                  >
                    ${def.icon}<span>${blockLabel(def, ctx)}</span>
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
