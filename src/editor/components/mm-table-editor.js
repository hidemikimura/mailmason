// キャンバス上で表を直接編集する部品。
// 選んだセル 1 つだけを mm-text-editor（inline モード）にし、他のセルは出力と同じ内容を表示する。
// Tab / Shift+Tab でセルを移動し、最後のセルで Tab を押すと行を足す。行・列の追加と削除は下のツールバーで行う
import { LitElement, css, html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { styleMap } from 'lit/directives/style-map.js';
import { resolveTextStyle } from '../../core/render-html/styles.js';
import { tableColumnWidths, tableOps } from '../../core/blocks/table.js';
import { setIn } from '../util.js';
import { controls } from '../styles.js';
import { define } from '../context.js';
import './mm-text-editor.js';

/** @import { Block, BodySettings } from '../../core/model/types.js' */
/** @import { EditorContext } from '../context.js' */
/** @import { TableValues } from '../../core/blocks/table.js' */

export class MmTableEditor extends LitElement {
  static properties = {
    block: { attribute: false },
    body: { attribute: false },
    ctx: { attribute: false },
    width: { type: Number },
    initialCell: { attribute: false },
    _active: { state: true },
  };

  static styles = [
    controls,
    css`
      :host {
        display: block;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th,
      td {
        vertical-align: top;
        cursor: text;
        word-break: break-word;
        position: relative;
      }
      td > .cell,
      th > .cell {
        min-height: 1.5em;
      }
      .active {
        outline: 2px solid var(--mm-color-accent);
        outline-offset: -2px;
      }
      .cell a {
        color: var(--mm-link-color);
        text-decoration: underline;
      }
      .ops {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
        font-family: var(--mm-font-family);
        font-size: 12px;
      }
      .ops button {
        height: 26px;
        padding: 0 8px;
        font-size: 12px;
      }
      .ops .sep {
        width: 1px;
        align-self: stretch;
        background: var(--mm-color-border);
        margin: 0 2px;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {Block} */
    this.block = /** @type {any} */ (null);
    /** @type {BodySettings} */
    this.body = /** @type {any} */ (null);
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    this.width = 0;
    /** @type {{ row: number, column: number } | null} 編集を始めるセル */
    this.initialCell = null;
    /** @type {{ row: number, column: number }} */
    this._active = { row: 0, column: 0 };
  }

  /** @returns {TableValues} */
  get values() {
    return /** @type {TableValues} */ (/** @type {unknown} */ (this.block.values));
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.initialCell) this._active = { ...this.initialCell };
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (changed.has('initialCell') && this.initialCell) this._active = { ...this.initialCell };
    // Undo や行の削除でセルが無くなったら、範囲の中に戻す（行を足した直後は、足した値が届くまで待つ）
    if (!changed.has('block')) return;
    const { cells, columns } = this.values;
    const row = Math.max(0, Math.min(this._active.row, cells.length - 1));
    const column = Math.max(0, Math.min(this._active.column, columns.length - 1));
    if (row !== this._active.row || column !== this._active.column) {
      this._active = { row, column };
    }
  }

  /** 表示中のセルの編集部品 */
  get cellEditor() {
    return /** @type {import('./mm-text-editor.js').MmTextEditor | null} */ (
      this.renderRoot.querySelector('mm-text-editor')
    );
  }

  /**
   * @param {number} row
   * @param {number} column
   */
  _activate(row, column) {
    if (row === this._active.row && column === this._active.column) return;
    this._active = { row, column };
  }

  /** @param {CustomEvent<{ direction: 1 | -1 }>} event */
  _onNav(event) {
    event.stopPropagation();
    const { cells, columns } = this.values;
    const count = columns.length;
    const index = this._active.row * count + this._active.column + event.detail.direction;
    if (index < 0) return;
    if (index >= cells.length * count) {
      // 最後のセルで Tab: 行を足して移る
      if (!this._apply(tableOps(this.block).insertRow(cells.length))) return;
    }
    this._active = { row: Math.floor(index / count), column: index % count };
  }

  /**
   * 行・列の操作の結果をストアに入れる
   * @param {Record<string, unknown> | null} patch
   * @returns {boolean}
   */
  _apply(patch) {
    if (!patch) return false;
    this.ctx.store.dispatch({ type: 'updateBlockValues', blockId: this.block.id, patch });
    return true;
  }

  /** @param {'rowAbove' | 'rowBelow' | 'removeRow' | 'columnLeft' | 'columnRight' | 'removeColumn'} op */
  _op(op) {
    const ops = tableOps(this.block);
    const { row, column } = this._active;
    switch (op) {
      case 'rowAbove':
        if (this._apply(ops.insertRow(row))) this._active = { row, column };
        break;
      case 'rowBelow':
        if (this._apply(ops.insertRow(row + 1))) this._active = { row: row + 1, column };
        break;
      case 'removeRow':
        this._apply(ops.removeRow(row));
        break;
      case 'columnLeft':
        if (this._apply(ops.insertColumn(column))) this._active = { row, column };
        break;
      case 'columnRight':
        if (this._apply(ops.insertColumn(column + 1))) this._active = { row, column: column + 1 };
        break;
      case 'removeColumn':
        this._apply(ops.removeColumn(column));
        break;
    }
    // 操作の後もセルの編集を続ける
    this.updateComplete.then(() => this.cellEditor?.focus());
  }

  /**
   * ツールバーのボタン。押してもセルのフォーカス（＝編集中の状態）を奪わない
   * @param {string} label
   * @param {() => void} action
   * @param {string} name
   * @param {boolean} [disabled]
   */
  _button(label, action, name, disabled = false) {
    return html`<button
      type="button"
      data-op=${name}
      ?disabled=${disabled}
      @pointerdown=${(/** @type {Event} */ e) => e.preventDefault()}
      @click=${action}
    >
      ${label}
    </button>`;
  }

  render() {
    const { block, body, ctx } = this;
    if (!block || !body || !ctx) return nothing;
    const { t } = ctx;
    const v = this.values;
    const style = resolveTextStyle(body, {
      fontFamily: null,
      fontSize: v.fontSize,
      lineHeight: Math.min(body.lineHeight, 1.5),
      color: v.color,
    });
    const widths = tableColumnWidths(v.columns, Math.max(1, this.width));
    const border = v.borderWidth > 0 ? `${v.borderWidth}px solid ${v.borderColor}` : 'none';
    const ops = tableOps(block);
    const { row: activeRow, column: activeColumn } = this._active;

    const rows = v.cells.map((cells, r) => {
      const header = v.headerRow && r === 0;
      const stripe = v.striped && !header && (r - (v.headerRow ? 1 : 0)) % 2 === 1;
      const cellStyle = styleMap({
        padding: `${v.cellPadding}px`,
        border,
        'background-color': header ? v.headerBackgroundColor : stripe ? v.stripeColor : '',
        color: header && v.headerColor ? v.headerColor : style.color,
        'font-weight': header ? 'bold' : '',
      });
      return html`<tr>
        ${cells.map((cell, c) => {
          const active = r === activeRow && c === activeColumn;
          const align = v.columns[c]?.align ?? 'left';
          const content = active
            ? html`<mm-text-editor
                inline
                .value=${cell}
                .blockId=${block.id}
                .field=${`cells.${r}.${c}`}
                .makePatch=${(/** @type {string} */ value) => ({
                  cells: setIn(this.values.cells, `${r}.${c}`, value),
                })}
                .placeholder=${''}
                .textStyle=${{ ...style, color: header && v.headerColor ? v.headerColor : style.color }}
                .linkColor=${body.linkColor}
                .ctx=${ctx}
                style=${styleMap({ 'text-align': align })}
              ></mm-text-editor>`
            : html`<div class="cell">${unsafeHTML(cell)}</div>`;
          /** @param {PointerEvent} e */
          const onPointerDown = (e) => {
            if (active) return;
            // 他のセルを押してもフォーカスを外さない（外すと編集が終わる）
            e.preventDefault();
            this._activate(r, c);
          };
          return header
            ? html`<th
                scope="col"
                class=${active ? 'active' : ''}
                style=${cellStyle}
                data-row=${r}
                data-column=${c}
                width=${widths[c]}
                @pointerdown=${onPointerDown}
              >
                <div style=${styleMap({ 'text-align': align })}>${content}</div>
              </th>`
            : html`<td
                class=${active ? 'active' : ''}
                style=${cellStyle}
                data-row=${r}
                data-column=${c}
                width=${widths[c]}
                @pointerdown=${onPointerDown}
              >
                <div style=${styleMap({ 'text-align': align })}>${content}</div>
              </td>`;
        })}
      </tr>`;
    });

    return html`<table
        style=${styleMap({
          'font-family': style.fontFamily,
          'font-size': `${style.fontSize}px`,
          'line-height': String(style.lineHeight),
          color: style.color,
          '--mm-link-color': body.linkColor,
        })}
        @mm-cell-nav=${this._onNav}
      >
        <colgroup>
          ${widths.map((w) => html`<col style=${styleMap({ width: `${w}px` })} />`)}
        </colgroup>
        ${rows}
      </table>
      <div class="ops" role="toolbar" aria-label=${t('table.toolbar')}>
        ${this._button(t('table.rowAbove'), () => this._op('rowAbove'), 'row-above', !ops.insertRow(0))}
        ${this._button(t('table.rowBelow'), () => this._op('rowBelow'), 'row-below', !ops.insertRow(0))}
        ${this._button(t('table.removeRow'), () => this._op('removeRow'), 'remove-row', !ops.removeRow(0))}
        <span class="sep"></span>
        ${this._button(t('table.columnLeft'), () => this._op('columnLeft'), 'column-left', !ops.insertColumn(0))}
        ${this._button(t('table.columnRight'), () => this._op('columnRight'), 'column-right', !ops.insertColumn(0))}
        ${this._button(
          t('table.removeColumn'),
          () => this._op('removeColumn'),
          'remove-column',
          !ops.removeColumn(0),
        )}
      </div>`;
  }
}

define('mm-table-editor', MmTableEditor);
