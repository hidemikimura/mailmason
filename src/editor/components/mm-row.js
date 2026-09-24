// キャンバス上の行。カラムの幅は computeLayout の結果（配信 HTML と同じ px）を使う
import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { chromeStyles, renderChrome } from './chrome.js';
import { define } from '../context.js';
import './mm-block.js';

/** @import { Row, BodySettings, Spacing } from '../../core/model/types.js' */
/** @import { RowBox } from '../../core/model/layout.js' */
/** @import { EditorContext } from '../context.js' */

/** @param {Spacing} p */
const pad = (p) => `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;

export class MmRow extends LitElement {
  static properties = {
    row: { attribute: false },
    box: { attribute: false },
    body: { attribute: false },
    ctx: { attribute: false },
    selection: { attribute: false },
    editing: { attribute: false },
    uploads: { attribute: false },
    index: { type: Number },
    count: { type: Number },
  };

  static styles = [
    chromeStyles,
    css`
      :host {
        display: block;
        position: relative;
        outline-offset: -1px;
      }
      :host(:hover) {
        outline: 1px dashed rgba(47, 111, 237, 0.45);
      }
      :host([data-selected]) {
        outline: 2px solid var(--mm-color-accent);
        z-index: 1;
      }
      :host([dragging]) {
        opacity: 0.35;
      }
      .columns {
        display: flex;
        align-items: stretch;
      }
      .column {
        box-sizing: border-box;
        flex: none;
        display: flex;
      }
      .column-inner {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 40px;
        box-sizing: border-box;
        position: relative;
      }
      .column-inner.selected {
        outline: 2px solid var(--mm-color-accent);
        outline-offset: -2px;
      }
      .column-inner:hover:not(.selected) {
        outline: 1px dotted rgba(47, 111, 237, 0.6);
        outline-offset: -1px;
      }
      .empty {
        flex: 1;
        display: grid;
        place-items: center;
        margin: 6px;
        border: 1px dashed #c5cad1;
        border-radius: 4px;
        color: #8a939d;
        font: 12px/1.4 var(--mm-font-family);
        min-height: 48px;
      }
      .badge {
        position: absolute;
        left: 4px;
        bottom: 4px;
        font: 10px/1.6 var(--mm-font-family);
        padding: 0 6px;
        border-radius: 9px;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        pointer-events: none;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {Row} */
    this.row = /** @type {any} */ (null);
    /** @type {RowBox} */
    this.box = /** @type {any} */ (null);
    /** @type {BodySettings} */
    this.body = /** @type {any} */ (null);
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    /** @type {string | null} この行の中の要素が選択されているときだけ、その ID */
    this.selection = null;
    /** @type {string | null} この行の中で直接編集中のブロック ID */
    this.editing = null;
    /** @type {ReadonlyMap<string, import('../upload.js').UploadState>} この行のブロックのアップロード */
    this.uploads = new Map();
    this.index = 0;
    this.count = 1;
    this.addEventListener('click', (event) => {
      event.stopPropagation();
      this.ctx.store.select(this.row.id);
    });
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (changed.has('selection'))
      this.toggleAttribute('data-selected', this.selection === this.row.id);
  }

  /** @param {number} to */
  _move(to) {
    this.ctx.store.dispatch({ type: 'moveRow', rowId: this.row.id, index: to });
  }

  _duplicate() {
    const { store } = this.ctx;
    store.dispatch({ type: 'duplicateRow', rowId: this.row.id });
    const copy = store.getState().template.body.rows[this.index + 1];
    if (copy) store.select(copy.id);
  }

  render() {
    const { row, box, ctx, body } = this;
    if (!row || !box || !ctx) return nothing;
    const { settings } = row;
    const selectedRow = this.selection === row.id;

    const columns = row.columns.map((column, i) => {
      const size = box.columns[i];
      const valign = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[
        column.settings.verticalAlign
      ];
      return html`<div
        class="column"
        style=${styleMap({ width: `${size.outerWidth}px`, padding: `0 ${size.gapRight}px 0 ${size.gapLeft}px` })}
      >
        <div
          class="column-inner ${this.selection === column.id ? 'selected' : ''}"
          data-column=${column.id}
          style=${styleMap({
            padding: pad(column.settings.padding),
            'background-color': column.settings.backgroundColor ?? '',
            'justify-content': valign,
          })}
          @click=${(/** @type {Event} */ e) => {
            e.stopPropagation();
            ctx.store.select(column.id);
          }}
        >
          ${
            column.blocks.length === 0
              ? html`<div class="empty">${ctx.t('placeholder.column')}</div>`
              : repeat(
                  column.blocks,
                  (block) => block.id,
                  (block, j) =>
                    html`<mm-block
                      .block=${block}
                      .width=${size.contentWidth}
                      .body=${body}
                      .ctx=${ctx}
                      .columnId=${column.id}
                      .index=${j}
                      .count=${column.blocks.length}
                      ?selected=${this.selection === block.id}
                      ?editing=${this.editing === block.id}
                      .upload=${this.uploads.get(block.id) ?? null}
                    ></mm-block>`,
                )
          }
        </div>
      </div>`;
    });

    return html`<div
        class="row"
        style=${styleMap({
          padding: pad(settings.padding),
          'background-color': settings.backgroundColor ?? '',
        })}
      >
        <div class="columns">${columns}</div>
      </div>
      ${settings.hideOn === 'mobile' ? html`<span class="badge">${ctx.t('badge.hiddenOnMobile')}</span>` : nothing}
      ${
        selectedRow
          ? renderChrome(
              ctx.t('crumb.row'),
              {
                moveUp: this.index > 0 ? () => this._move(this.index - 1) : null,
                moveDown: this.index < this.count - 1 ? () => this._move(this.index + 1) : null,
                duplicate: () => this._duplicate(),
                remove: () => ctx.store.dispatch({ type: 'removeRow', rowId: row.id }),
              },
              ctx.t,
              (/** @type {PointerEvent} */ event) =>
                ctx.dnd.start(event, { kind: 'move-row', rowId: row.id }),
            )
          : nothing
      }`;
  }
}

define('mm-row', MmRow);
