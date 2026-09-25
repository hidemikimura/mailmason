// キャンバス上で表を直接編集する部品。
// 選んだセル 1 つだけを mm-text-editor（inline モード）にし、他のセルは出力と同じ内容を表示する。
// Tab / Shift+Tab でセルを移動し、最後のセルで Tab を押すと行を足す。
// Shift を押しながらセルを押すと範囲を選び、下のツールバーで結合・解除できる。
// 行・列の追加・削除・移動は下のツールバーで行い、選んだセルの行と列の端のつまみをドラッグしても移動できる
import { LitElement, css, html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { styleMap } from 'lit/directives/style-map.js';
import { resolveTextStyle } from '../../core/render-html/styles.js';
import { tableColumnWidths, tableOps, tableRowKind } from '../../core/blocks/table.js';
import {
  cellRange,
  isCovered,
  lineGroup,
  rangeBetween,
  rangesIntersect,
} from '../../core/blocks/table-layout.js';
import { setIn } from '../util.js';
import { controls } from '../styles.js';
import { define } from '../context.js';
import './mm-text-editor.js';

/** @import { Block, BodySettings } from '../../core/model/types.js' */
/** @import { EditorContext } from '../context.js' */
/** @import { TableValues } from '../../core/blocks/table.js' */
/** @import { TableRange } from '../../core/blocks/table-layout.js' */

/**
 * ドラッグ中の行・列の移動
 * @typedef {Object} LineDrag
 * @property {'row' | 'column'} axis
 * @property {number} start 動かす最初の行（列）
 * @property {number} count 動かす行（列）の数
 * @property {number | null} gap 落とす位置（元の位置で数えた、その行（列）の前）。落とせなければ null
 */

export class MmTableEditor extends LitElement {
  static properties = {
    block: { attribute: false },
    body: { attribute: false },
    ctx: { attribute: false },
    width: { type: Number },
    initialCell: { attribute: false },
    _active: { state: true },
    _selection: { state: true },
    _drag: { state: true },
  };

  static styles = [
    controls,
    css`
      :host {
        display: block;
      }
      .frame {
        position: relative;
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
      .selected::after {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--mm-color-accent);
        opacity: 0.14;
        pointer-events: none;
      }
      .cell a {
        color: var(--mm-link-color);
        text-decoration: underline;
      }
      .handle {
        position: absolute;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        border: 1px solid var(--mm-color-accent);
        border-radius: 4px;
        background: var(--mm-color-surface, #fff);
        color: var(--mm-color-accent);
        cursor: grab;
        touch-action: none;
      }
      .handle svg {
        width: 10px;
        height: 10px;
        fill: currentColor;
      }
      .handle[data-axis='row'] {
        left: -8px;
        width: 14px;
      }
      .handle[data-axis='column'] {
        top: -8px;
        height: 14px;
      }
      .dragging .handle {
        cursor: grabbing;
      }
      .drop {
        position: absolute;
        z-index: 3;
        background: var(--mm-color-accent);
        pointer-events: none;
      }
      .drop[data-axis='row'] {
        left: 0;
        right: 0;
        height: 3px;
        margin-top: -1.5px;
      }
      .drop[data-axis='column'] {
        top: 0;
        bottom: 0;
        width: 3px;
        margin-left: -1.5px;
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
    /** @type {{ row: number, column: number }} 編集中のセル（結合したセルは左上） */
    this._active = { row: 0, column: 0 };
    /** @type {TableRange | null} Shift+クリックで選んだ範囲（null なら編集中のセル） */
    this._selection = null;
    /** @type {LineDrag | null} */
    this._drag = null;
    /** @type {Array<{ top: number, height: number }>} 行の位置（つまみと落とす位置の表示に使う） */
    this._rowBoxes = [];
  }

  /** @returns {TableValues} */
  get values() {
    return /** @type {TableValues} */ (/** @type {unknown} */ (this.block.values));
  }

  /** 表の中に収めた結合 */
  get merges() {
    return tableOps(this.block).merges;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.initialCell) this._active = this._anchorOf(this.initialCell);
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (changed.has('initialCell') && this.initialCell) {
      this._active = this._anchorOf(this.initialCell);
      this._selection = null;
    }
    // Undo や行の削除でセルが無くなったら、範囲の中に戻す（行を足した直後は、足した値が届くまで待つ）
    if (!changed.has('block')) return;
    const { cells, columns } = this.values;
    const row = Math.max(0, Math.min(this._active.row, cells.length - 1));
    const column = Math.max(0, Math.min(this._active.column, columns.length - 1));
    const next = this._anchorOf({ row, column });
    if (next.row !== this._active.row || next.column !== this._active.column) {
      this._active = next;
    }
    const s = this._selection;
    if (s && (s.row + s.rowSpan > cells.length || s.column + s.colSpan > columns.length)) {
      this._selection = null;
    }
  }

  updated() {
    // 行の位置を測り、行のつまみを選んだ行の横に置く（再描画せずに位置だけ変える）
    const rows = /** @type {HTMLTableRowElement[]} */ ([
      ...this.renderRoot.querySelectorAll('tbody > tr, table > tr'),
    ]);
    this._rowBoxes = rows.map((tr) => ({ top: tr.offsetTop, height: tr.offsetHeight }));
    const handle = /** @type {HTMLElement | null} */ (
      this.renderRoot.querySelector('.handle[data-axis="row"]')
    );
    if (!handle || this._rowBoxes.length === 0) return;
    const r = this.range;
    const group = lineGroup(this.merges, 'row', r.row, r.row + r.rowSpan - 1);
    const edges = this._edges('row');
    const top = edges[group.start] ?? 0;
    const bottom = edges[group.end + 1] ?? top;
    const height = Math.min(24, bottom - top);
    handle.style.top = `${top + (bottom - top - height) / 2}px`;
    handle.style.height = `${height}px`;
  }

  /** 表示中のセルの編集部品 */
  get cellEditor() {
    return /** @type {import('./mm-text-editor.js').MmTextEditor | null} */ (
      this.renderRoot.querySelector('mm-text-editor')
    );
  }

  /**
   * セルを含む結合の左上のセル
   * @param {{ row: number, column: number }} cell
   */
  _anchorOf(cell) {
    const range = cellRange(this.merges, cell.row, cell.column);
    return { row: range.row, column: range.column };
  }

  /** 操作の対象: 選んだ範囲、無ければ編集中のセル（結合したセルは結合の全体） */
  get range() {
    return this._selection ?? cellRange(this.merges, this._active.row, this._active.column);
  }

  /**
   * @param {number} row
   * @param {number} column
   * @param {boolean} [extend] Shift: 編集中のセルから範囲を選ぶ
   */
  _activate(row, column, extend = false) {
    if (extend) {
      const range = rangeBetween(this.merges, this._active, { row, column });
      this._selection = range.rowSpan * range.colSpan > 1 ? range : null;
      return;
    }
    this._selection = null;
    if (row === this._active.row && column === this._active.column) return;
    this._active = this._anchorOf({ row, column });
  }

  /** @param {CustomEvent<{ direction: 1 | -1 }>} event */
  _onNav(event) {
    event.stopPropagation();
    const { cells, columns } = this.values;
    const count = columns.length;
    const merges = this.merges;
    // 結合に覆われたセルは飛ばす
    const order = [];
    for (let r = 0; r < cells.length; r += 1) {
      for (let c = 0; c < count; c += 1)
        if (!isCovered(merges, r, c)) order.push({ row: r, column: c });
    }
    const current = order.findIndex(
      (cell) => cell.row === this._active.row && cell.column === this._active.column,
    );
    const index = current + event.detail.direction;
    if (index < 0) return;
    this._selection = null;
    if (index >= order.length) {
      // 最後のセルで Tab: 行を足して移る
      if (!this._apply(tableOps(this.block).insertRow(cells.length))) return;
      this._active = { row: cells.length, column: 0 };
      return;
    }
    this._active = order[index];
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

  /**
   * 行（列）を移したあと、編集中のセルと選んだ範囲も同じだけずらす
   * @param {'row' | 'column'} axis
   * @param {number} start
   * @param {number} count
   * @param {number} gap
   */
  _followMove(axis, start, count, gap) {
    const to = gap < start ? gap : gap - count;
    /** @param {number} i */
    const map = (i) => {
      if (i >= start && i < start + count) return i - start + to;
      if (gap < start && i >= gap && i < start) return i + count;
      if (gap > start && i >= start + count && i < gap) return i - count;
      return i;
    };
    this._active = { ...this._active, [axis]: map(this._active[axis]) };
    if (this._selection)
      this._selection = { ...this._selection, [axis]: map(this._selection[axis]) };
  }

  /**
   * @param {'row' | 'column'} axis
   * @param {-1 | 1} direction
   */
  _shift(axis, direction) {
    const ops = tableOps(this.block);
    const target = this._shiftTarget(axis, direction);
    if (!target) return;
    const patch =
      axis === 'row'
        ? ops.moveRows(target.start, target.count, target.gap)
        : ops.moveColumns(target.start, target.count, target.gap);
    if (this._apply(patch)) this._followMove(axis, target.start, target.count, target.gap);
  }

  /**
   * @param {'row' | 'column'} axis
   * @param {-1 | 1} direction
   */
  _shiftTarget(axis, direction) {
    const ops = tableOps(this.block);
    const r = this.range;
    return axis === 'row'
      ? ops.shiftRows(r.row, r.row + r.rowSpan - 1, direction)
      : ops.shiftColumns(r.column, r.column + r.colSpan - 1, direction);
  }

  /** @param {string} op */
  _op(op) {
    const ops = tableOps(this.block);
    const r = this.range;
    const { row, column } = this._active;
    switch (op) {
      case 'rowAbove':
        if (this._apply(ops.insertRow(r.row))) this._moveActive('row', r.row, 1);
        break;
      case 'rowBelow':
        if (this._apply(ops.insertRow(r.row + r.rowSpan))) {
          this._selection = null;
          this._active = { row: r.row + r.rowSpan, column };
        }
        break;
      case 'removeRow':
        // 編集中のセルは、足りなくなれば willUpdate で表の中に戻す
        if (this._apply(ops.removeRow(r.row, r.rowSpan))) {
          this._selection = null;
          this._active = { row: r.row, column };
        }
        break;
      case 'columnLeft':
        if (this._apply(ops.insertColumn(r.column))) this._moveActive('column', r.column, 1);
        break;
      case 'columnRight':
        if (this._apply(ops.insertColumn(r.column + r.colSpan))) {
          this._selection = null;
          this._active = { row, column: r.column + r.colSpan };
        }
        break;
      case 'removeColumn':
        if (this._apply(ops.removeColumn(r.column, r.colSpan))) {
          this._selection = null;
          this._active = { row, column: r.column };
        }
        break;
      case 'merge':
        // 結合したセルの左上で編集を続ける（範囲を広げたときは willUpdate で左上に合わせる）
        if (this._apply(ops.merge(r))) {
          this._selection = null;
          this._active = { row: r.row, column: r.column };
        }
        break;
      case 'unmerge':
        if (this._apply(ops.unmerge(r))) this._selection = null;
        break;
      case 'moveRowUp':
        this._shift('row', -1);
        break;
      case 'moveRowDown':
        this._shift('row', 1);
        break;
      case 'moveColumnLeft':
        this._shift('column', -1);
        break;
      case 'moveColumnRight':
        this._shift('column', 1);
        break;
    }
    // 操作の後もセルの編集を続ける
    this.updateComplete.then(() => this.cellEditor?.focus());
  }

  /**
   * 前に行（列）を足したとき、編集中のセルと範囲をずらす
   * @param {'row' | 'column'} axis
   * @param {number} index 足した位置
   * @param {number} amount
   */
  _moveActive(axis, index, amount) {
    if (this._active[axis] >= index) {
      this._active = { ...this._active, [axis]: this._active[axis] + amount };
    }
    if (this._selection && this._selection[axis] >= index) {
      this._selection = { ...this._selection, [axis]: this._selection[axis] + amount };
    }
  }

  // ---- つまみのドラッグ ----

  /**
   * @param {PointerEvent} event
   * @param {'row' | 'column'} axis
   */
  _onHandleDown(event, axis) {
    if (event.button !== 0) return;
    // 押してもセルのフォーカス（＝編集中の状態）を奪わない
    event.preventDefault();
    event.stopPropagation();
    const r = this.range;
    const group =
      axis === 'row'
        ? lineGroup(this.merges, 'row', r.row, r.row + r.rowSpan - 1)
        : lineGroup(this.merges, 'column', r.column, r.column + r.colSpan - 1);
    const handle = /** @type {HTMLElement} */ (event.currentTarget);
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // 合成したイベントなど、捕捉できないポインター
    }
    this._drag = { axis, start: group.start, count: group.end - group.start + 1, gap: null };
  }

  /** @param {PointerEvent} event */
  _onHandleMove(event) {
    const drag = this._drag;
    if (!drag) return;
    const frame = /** @type {HTMLElement} */ (this.renderRoot.querySelector('.frame'));
    const rect = frame.getBoundingClientRect();
    const edges = this._edges(drag.axis);
    const at = drag.axis === 'row' ? event.clientY - rect.top : event.clientX - rect.left;
    // いちばん近い境目
    let gap = 0;
    for (let i = 1; i < edges.length; i += 1) {
      if (Math.abs(edges[i] - at) < Math.abs(edges[gap] - at)) gap = i;
    }
    const ops = tableOps(this.block);
    const valid =
      drag.axis === 'row'
        ? ops.moveRows(drag.start, drag.count, gap)
        : ops.moveColumns(drag.start, drag.count, gap);
    const next = valid ? gap : null;
    if (next !== drag.gap) this._drag = { ...drag, gap: next };
  }

  _onHandleUp() {
    const drag = this._drag;
    this._drag = null;
    if (!drag || drag.gap === null) return;
    const ops = tableOps(this.block);
    const patch =
      drag.axis === 'row'
        ? ops.moveRows(drag.start, drag.count, drag.gap)
        : ops.moveColumns(drag.start, drag.count, drag.gap);
    if (this._apply(patch)) this._followMove(drag.axis, drag.start, drag.count, drag.gap);
    this.updateComplete.then(() => this.cellEditor?.focus());
  }

  /**
   * 行（列）の境目の位置（px、表の左上から）。境目 i は i 番目の行（列）の前
   * @param {'row' | 'column'} axis
   * @returns {number[]}
   */
  _edges(axis) {
    if (axis === 'row') {
      const boxes = this._rowBoxes;
      if (boxes.length === 0) return [0];
      const last = boxes[boxes.length - 1];
      return [...boxes.map((b) => b.top), last.top + last.height];
    }
    const widths = tableColumnWidths(this.values.columns, Math.max(1, this.width));
    /** @type {number[]} */
    const edges = [0];
    for (const w of widths) edges.push(edges[edges.length - 1] + w);
    return edges;
  }

  /** つまみ（選んだセルの行と列に 1 つずつ）と、ドラッグ中の落とす位置 */
  _renderHandles() {
    const { t } = this.ctx;
    const r = this.range;
    const columns = lineGroup(this.merges, 'column', r.column, r.column + r.colSpan - 1);
    const rowEdges = this._edges('row');
    const columnEdges = this._edges('column');
    const grip = html`<svg viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="3" cy="2" r="1" />
      <circle cx="7" cy="2" r="1" />
      <circle cx="3" cy="5" r="1" />
      <circle cx="7" cy="5" r="1" />
      <circle cx="3" cy="8" r="1" />
      <circle cx="7" cy="8" r="1" />
    </svg>`;
    /** @param {'row' | 'column'} axis @param {string} label @param {Record<string, string>} position */
    const handle = (axis, label, position) =>
      html`<div
        class="handle"
        data-axis=${axis}
        title=${label}
        aria-hidden="true"
        style=${styleMap(position)}
        @pointerdown=${(/** @type {PointerEvent} */ e) => this._onHandleDown(e, axis)}
        @pointermove=${this._onHandleMove}
        @pointerup=${this._onHandleUp}
        @pointercancel=${() => (this._drag = null)}
      >
        ${grip}
      </div>`;
    const drag = this._drag;
    const left = columnEdges[columns.start] ?? 0;
    const right = columnEdges[columns.end + 1] ?? left;
    const width = Math.min(24, right - left);
    return html`
      ${handle('row', t('table.dragRow'), {})}
      ${handle('column', t('table.dragColumn'), {
        left: `${left + (right - left - width) / 2}px`,
        width: `${width}px`,
      })}
      ${
        drag && drag.gap !== null
          ? html`<div
              class="drop"
              data-axis=${drag.axis}
              style=${styleMap(
                drag.axis === 'row'
                  ? { top: `${rowEdges[drag.gap]}px` }
                  : { left: `${columnEdges[drag.gap]}px` },
              )}
            ></div>`
          : nothing
      }
    `;
  }

  /**
   * ツールバーのボタン。押してもセルのフォーカス（＝編集中の状態）を奪わない
   * @param {string} label
   * @param {string} op
   * @param {string} name
   * @param {boolean} [disabled]
   */
  _button(label, op, name, disabled = false) {
    return html`<button
      type="button"
      data-op=${name}
      ?disabled=${disabled}
      @pointerdown=${(/** @type {Event} */ e) => e.preventDefault()}
      @click=${() => this._op(op)}
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
    const merges = ops.merges;
    const range = this.range;
    const { row: activeRow, column: activeColumn } = this._active;

    const rows = v.cells.map((cells, r) => {
      const { header, stripe } = tableRowKind(v, r);
      const cellStyle = styleMap({
        padding: `${v.cellPadding}px`,
        border,
        'background-color': header ? v.headerBackgroundColor : stripe ? v.stripeColor : '',
        color: header && v.headerColor ? v.headerColor : style.color,
        'font-weight': header ? 'bold' : '',
      });
      return html`<tr>
        ${cells.map((cell, c) => {
          if (isCovered(merges, r, c)) return nothing;
          const own = cellRange(merges, r, c);
          const active = r === activeRow && c === activeColumn;
          const selected = this._selection !== null && rangesIntersect(this._selection, own);
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
            if (active && !e.shiftKey) {
              this._selection = null;
              return;
            }
            // 他のセルを押してもフォーカスを外さない（外すと編集が終わる）
            e.preventDefault();
            this._activate(r, c, e.shiftKey);
          };
          const width = widths.slice(c, c + own.colSpan).reduce((a, b) => a + b, 0);
          const classes = [active ? 'active' : '', selected ? 'selected' : ''].join(' ').trim();
          const inner = html`<div style=${styleMap({ 'text-align': align })}>${content}</div>`;
          return header
            ? html`<th
                scope="col"
                class=${classes}
                style=${cellStyle}
                data-row=${r}
                data-column=${c}
                colspan=${own.colSpan}
                rowspan=${own.rowSpan}
                width=${width}
                @pointerdown=${onPointerDown}
              >
                ${inner}
              </th>`
            : html`<td
                class=${classes}
                style=${cellStyle}
                data-row=${r}
                data-column=${c}
                colspan=${own.colSpan}
                rowspan=${own.rowSpan}
                width=${width}
                @pointerdown=${onPointerDown}
              >
                ${inner}
              </td>`;
        })}
      </tr>`;
    });

    const canMerge = ops.merge(range) !== null;
    const canUnmerge = ops.unmerge(range) !== null;
    return html`<div class="frame ${this._drag ? 'dragging' : ''}">
        <table
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
        ${this._renderHandles()}
      </div>
      <div class="ops" role="toolbar" aria-label=${t('table.toolbar')}>
        ${this._button(t('table.rowAbove'), 'rowAbove', 'row-above', !ops.insertRow(0))}
        ${this._button(t('table.rowBelow'), 'rowBelow', 'row-below', !ops.insertRow(0))}
        ${this._button(
          t('table.removeRow'),
          'removeRow',
          'remove-row',
          !ops.removeRow(range.row, range.rowSpan),
        )}
        <span class="sep"></span>
        ${this._button(t('table.columnLeft'), 'columnLeft', 'column-left', !ops.insertColumn(0))}
        ${this._button(t('table.columnRight'), 'columnRight', 'column-right', !ops.insertColumn(0))}
        ${this._button(
          t('table.removeColumn'),
          'removeColumn',
          'remove-column',
          !ops.removeColumn(range.column, range.colSpan),
        )}
        <span class="sep"></span>
        ${this._button(t('table.merge'), 'merge', 'merge', !canMerge)}
        ${this._button(t('table.unmerge'), 'unmerge', 'unmerge', !canUnmerge)}
        <span class="sep"></span>
        ${this._button(t('table.moveRowUp'), 'moveRowUp', 'move-row-up', !this._shiftTarget('row', -1))}
        ${this._button(
          t('table.moveRowDown'),
          'moveRowDown',
          'move-row-down',
          !this._shiftTarget('row', 1),
        )}
        ${this._button(
          t('table.moveColumnLeft'),
          'moveColumnLeft',
          'move-column-left',
          !this._shiftTarget('column', -1),
        )}
        ${this._button(
          t('table.moveColumnRight'),
          'moveColumnRight',
          'move-column-right',
          !this._shiftTarget('column', 1),
        )}
      </div>`;
  }
}

define('mm-table-editor', MmTableEditor);
