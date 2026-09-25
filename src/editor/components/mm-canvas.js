// 編集領域。メール本文の幅で行を並べ、選択状態を各行へ配る
import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { computeLayout } from '../../core/model/layout.js';
import { define } from '../context.js';
import { backgroundStyles } from '../util.js';
import './mm-row.js';

/** @import { Template, Row } from '../../core/model/types.js' */
/** @import { RowBox } from '../../core/model/layout.js' */
/** @import { EditorContext } from '../context.js' */
/** @import { UploadState } from '../upload.js' */

/** @type {ReadonlyMap<string, UploadState>} アップロード中のブロックが無い行に渡す（再描画を避けるため同じ参照） */
const NO_UPLOADS = new Map();

export class MmCanvas extends LitElement {
  static properties = {
    template: { attribute: false },
    selection: { attribute: false },
    selectedIds: { attribute: false },
    editing: { attribute: false },
    uploads: { attribute: false },
    ctx: { attribute: false },
  };

  static styles = css`
    :host {
      display: block;
      overflow: auto;
      outline: none;
    }
    .surface {
      min-height: 100%;
      box-sizing: border-box;
      padding: 32px 24px 64px;
    }
    .mail {
      margin: 0 auto;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
    .empty {
      padding: 48px 24px;
      text-align: center;
      color: #8a939d;
      font: 13px/1.6 var(--mm-font-family);
      border: 2px dashed #c5cad1;
      margin: 16px;
      border-radius: 8px;
    }
  `;

  constructor() {
    super();
    /** @type {Template} */
    this.template = /** @type {any} */ (null);
    /** @type {string | null} */
    this.selection = null;
    /** @type {readonly string[]} まとめて選んだ要素 */
    this.selectedIds = [];
    /** @type {{ ids: readonly string[], set: ReadonlySet<string> }} */
    this._selected = { ids: [], set: new Set() };
    /** @type {string | null} 直接編集中のブロック ID */
    this.editing = null;
    /** @type {ReadonlyMap<string, UploadState>} アップロードの状態（ブロック ID ごと） */
    this.uploads = NO_UPLOADS;
    // OS からの画像ファイルのドロップ
    this.addEventListener('dragover', (event) => this.ctx?.dnd.fileOver(event));
    this.addEventListener('drop', (event) => this.ctx?.dnd.fileDrop(event));
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    /** 行の寸法のキャッシュ（行と本文幅が同じなら同じオブジェクトを返し、行の再描画を防ぐ） */
    /** @type {Map<string, { row: Row, width: number, box: RowBox }>} */
    this._boxes = new Map();
    /** @type {{ rows: Row[] | null, owner: Map<string, string> }} 要素 ID → 行 ID */
    this._owners = { rows: null, owner: new Map() };
  }

  /** @returns {Map<string, RowBox>} */
  _layout() {
    const { template } = this;
    const width = template.body.settings.width;
    const fresh = computeLayout(template);
    /** @type {Map<string, RowBox>} */
    const result = new Map();
    const next = new Map();
    for (const row of template.body.rows) {
      const cached = this._boxes.get(row.id);
      const box =
        cached && cached.row === row && cached.width === width
          ? cached.box
          : /** @type {RowBox} */ (fresh.get(row.id));
      next.set(row.id, { row, width, box });
      result.set(row.id, box);
    }
    this._boxes = next;
    return result;
  }

  /**
   * 要素がどの行にあるか
   * @param {string | null} id
   */
  _ownerRow(id = this.selection) {
    const { rows } = this.template.body;
    if (this._owners.rows !== rows) {
      const owner = new Map();
      for (const row of rows) {
        owner.set(row.id, row.id);
        for (const column of row.columns) {
          owner.set(column.id, row.id);
          for (const block of column.blocks) owner.set(block.id, row.id);
        }
      }
      this._owners = { rows, owner };
    }
    return id ? (this._owners.owner.get(id) ?? null) : null;
  }

  /**
   * ドラッグ&ドロップ用に、行・カラム・ブロックの画面上の矩形を測る
   * @returns {import('../dnd/target.js').Geometry}
   */
  geometry() {
    /** @param {Element} el */
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const mail = /** @type {Element} */ (this.renderRoot.querySelector('.mail'));
    const rows = [...this.renderRoot.querySelectorAll('mm-row')].map((el, index) => {
      const rowEl = /** @type {import('./mm-row.js').MmRow} */ (el);
      const columns = [...rowEl.renderRoot.querySelectorAll('[data-column]')].map((col) => ({
        id: /** @type {HTMLElement} */ (col).dataset.column ?? '',
        rowId: rowEl.row.id,
        box: box(col),
        blocks: [...col.querySelectorAll(':scope > mm-block')].map((b) => ({
          id: /** @type {import('./mm-block.js').MmBlock} */ (b).block.id,
          box: box(b),
        })),
      }));
      return { id: rowEl.row.id, index, box: box(rowEl), columns };
    });
    return { mail: box(mail), rows };
  }

  /**
   * ID から行またはブロックの要素を探す
   * @param {string} id
   * @returns {HTMLElement | null}
   */
  elementFor(id) {
    for (const el of this.renderRoot.querySelectorAll('mm-row')) {
      const rowEl = /** @type {import('./mm-row.js').MmRow} */ (el);
      if (rowEl.row.id === id) return rowEl;
      for (const b of rowEl.renderRoot.querySelectorAll('mm-block')) {
        if (/** @type {import('./mm-block.js').MmBlock} */ (b).block.id === id) {
          return /** @type {HTMLElement} */ (b);
        }
      }
    }
    return null;
  }

  render() {
    const { template, ctx } = this;
    if (!template || !ctx) return nothing;
    const { settings, rows } = template.body;
    const boxes = this._layout();
    const ownerRow = this._ownerRow();
    if (this._selected.ids !== this.selectedIds) {
      this._selected = { ids: this.selectedIds, set: new Set(this.selectedIds) };
    }
    const selected = this._selected.set;
    const editingRow = this._ownerRow(this.editing);
    /** @type {Map<string, Map<string, UploadState>>} 行 ID → その行のアップロード */
    const uploadsByRow = new Map();
    for (const [blockId, state] of this.uploads) {
      const rowId = this._ownerRow(blockId);
      if (!rowId) continue;
      if (!uploadsByRow.has(rowId)) uploadsByRow.set(rowId, new Map());
      /** @type {Map<string, UploadState>} */ (uploadsByRow.get(rowId)).set(blockId, state);
    }

    return html`<div
      class="surface"
      style=${styleMap({
        'background-color': settings.backgroundColor,
        ...backgroundStyles(settings.backgroundImage),
      })}
      @click=${() => ctx.store.select(null)}
    >
      <div
        class="mail"
        style=${styleMap({
          width: `${settings.width}px`,
          'background-color': settings.contentBackgroundColor,
          ...backgroundStyles(settings.contentBackgroundImage),
        })}
      >
        ${
          rows.length === 0
            ? html`<div class="empty">${ctx.t('placeholder.canvas')}</div>`
            : repeat(
                rows,
                (row) => row.id,
                (row, i) =>
                  html`<mm-row
                    .row=${row}
                    .box=${boxes.get(row.id)}
                    .body=${settings}
                    .ctx=${ctx}
                    .selection=${ownerRow === row.id ? this.selection : null}
                    .selected=${selected}
                    .editing=${editingRow === row.id ? this.editing : null}
                    .uploads=${uploadsByRow.get(row.id) ?? NO_UPLOADS}
                    .index=${i}
                    .count=${rows.length}
                  ></mm-row>`,
              )
        }
      </div>
    </div>`;
  }
}

define('mm-canvas', MmCanvas);
