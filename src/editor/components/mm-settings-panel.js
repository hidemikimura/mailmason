// 設定パネル: 選択中の要素（なし＝メール全体 / 行 / カラム / ブロック）の項目を FieldSpec から描画する
import { LitElement, css, html, nothing } from 'lit';
import { findRowIndex, locateBlock, locateColumn } from '../../core/model/tree.js';
import { getBlockDef } from '../../core/blocks/registry.js';
import { getEditorBlockDef } from '../blocks/index.js';
import { renderField } from '../fields/fields.js';
import { controls } from '../styles.js';
import { getIn, patchAt } from '../util.js';
import { define } from '../context.js';

/** @import { Template, Block, Row, Column } from '../../core/model/types.js' */
/** @import { FieldSpec, FieldContext } from '../fields/fields.js' */
/** @import { EditorContext } from '../context.js' */

/** @type {FieldSpec[]} */
const BODY_FIELDS = [
  {
    key: 'width',
    kind: 'number',
    labelKey: 'field.bodyWidth',
    options: { min: 320, max: 1200, unit: 'px' },
  },
  { key: 'backgroundColor', kind: 'color', labelKey: 'field.outerBackgroundColor' },
  { key: 'contentBackgroundColor', kind: 'color', labelKey: 'field.contentBackgroundColor' },
  { key: 'fontFamily', kind: 'text', labelKey: 'field.fontFamily' },
  {
    key: 'fontSize',
    kind: 'number',
    labelKey: 'field.fontSize',
    options: { min: 8, max: 72, unit: 'px' },
  },
  {
    key: 'lineHeight',
    kind: 'number',
    labelKey: 'field.lineHeight',
    options: { min: 0.8, max: 3, step: 0.1 },
  },
  { key: 'textColor', kind: 'color', labelKey: 'field.textColor' },
  { key: 'linkColor', kind: 'color', labelKey: 'field.linkColor' },
  {
    key: 'preheader',
    kind: 'text',
    labelKey: 'field.preheader',
    helpKey: 'field.preheaderHelp',
    options: { mergeTags: true },
  },
  { key: 'title', kind: 'text', labelKey: 'field.title', options: { mergeTags: true } },
];

/** @type {FieldSpec[]} */
const ROW_FIELDS = [
  { key: 'layout', kind: 'layout', labelKey: 'field.layout' },
  {
    key: 'backgroundColor',
    kind: 'color',
    labelKey: 'field.backgroundColor',
    options: { nullable: true },
  },
  { key: 'padding', kind: 'spacing', labelKey: 'field.padding' },
  {
    key: 'columnGap',
    kind: 'number',
    labelKey: 'field.columnGap',
    options: { min: 0, max: 200, unit: 'px' },
    visible: (v) => v.layout !== '1',
  },
  {
    key: 'stackOnMobile',
    kind: 'toggle',
    labelKey: 'field.stackOnMobile',
    visible: (v) => v.layout !== '1',
  },
  {
    key: 'hideOn',
    kind: 'toggle',
    labelKey: 'field.hideOnMobile',
    options: { on: 'mobile', off: null },
  },
];

/** @type {FieldSpec[]} */
const COLUMN_FIELDS = [
  {
    key: 'backgroundColor',
    kind: 'color',
    labelKey: 'field.backgroundColor',
    options: { nullable: true },
  },
  { key: 'padding', kind: 'spacing', labelKey: 'field.padding' },
  {
    key: 'verticalAlign',
    kind: 'align',
    labelKey: 'field.verticalAlign',
    options: {
      choices: [
        { value: 'top', labelKey: 'valign.top' },
        { value: 'middle', labelKey: 'valign.middle' },
        { value: 'bottom', labelKey: 'valign.bottom' },
      ],
    },
  },
];

/** @type {FieldSpec[]} */
const BLOCK_STYLE_FIELDS = [
  {
    key: 'backgroundColor',
    kind: 'color',
    labelKey: 'field.backgroundColor',
    options: { nullable: true },
  },
  { key: 'padding', kind: 'spacing', labelKey: 'field.padding' },
];

/** @type {FieldSpec} */
const HIDE_FIELD = {
  key: 'hideOn',
  kind: 'toggle',
  labelKey: 'field.hideOnMobile',
  options: { on: 'mobile', off: null },
};

/**
 * @typedef {{ kind: 'body' }
 *   | { kind: 'row', row: Row }
 *   | { kind: 'column', row: Row, column: Column }
 *   | { kind: 'block', row: Row, column: Column, block: Block }} Target
 */

/**
 * @param {Template} template
 * @param {string | null} selection
 * @returns {Target}
 */
function resolveTarget(template, selection) {
  if (!selection) return { kind: 'body' };
  const { rows } = template.body;
  const b = locateBlock(template, selection);
  if (b) {
    const row = rows[b.rowIndex];
    const column = row.columns[b.columnIndex];
    return { kind: 'block', row, column, block: column.blocks[b.blockIndex] };
  }
  const c = locateColumn(template, selection);
  if (c)
    return {
      kind: 'column',
      row: rows[c.rowIndex],
      column: rows[c.rowIndex].columns[c.columnIndex],
    };
  const r = findRowIndex(template, selection);
  if (r !== -1) return { kind: 'row', row: rows[r] };
  return { kind: 'body' };
}

export class MmSettingsPanel extends LitElement {
  static properties = {
    template: { attribute: false },
    selection: { attribute: false },
    uploads: { attribute: false },
    ctx: { attribute: false },
  };

  static styles = [
    controls,
    css`
      :host {
        display: block;
        background: var(--mm-color-surface);
        border-left: 1px solid var(--mm-color-border);
        overflow: auto;
      }
      nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--mm-color-border);
        position: sticky;
        top: 0;
        background: var(--mm-color-surface);
        z-index: 1;
      }
      nav button {
        border: 0;
        padding: 2px 6px;
        background: transparent;
        color: var(--mm-color-accent);
      }
      nav button[aria-current='true'] {
        color: var(--mm-color-text);
        font-weight: 600;
      }
      nav .sep {
        color: var(--mm-color-muted);
      }
      section {
        padding: 8px 12px 12px;
        border-bottom: 1px solid var(--mm-color-border);
      }
      h3 {
        margin: 4px 0 8px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--mm-color-muted);
      }
      .field {
        display: grid;
        gap: 4px;
        margin-bottom: 12px;
      }
      .field.inline {
        grid-template-columns: 1fr auto;
        align-items: center;
      }
      .field > label {
        font-weight: 500;
      }
      .help {
        margin: 0;
        font-size: 11px;
        color: var(--mm-color-muted);
      }
      .field input[type='text'],
      .field select,
      .field textarea {
        width: 100%;
      }
      .with-menu {
        display: flex;
        gap: 4px;
      }
      .with-menu input {
        flex: 1;
      }
      .merge-tags {
        width: auto !important;
        max-width: 96px;
      }
      .number {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .number input {
        width: 88px;
      }
      .unit {
        color: var(--mm-color-muted);
      }
      .color {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .color input[type='color'] {
        width: 32px;
        height: 28px;
        padding: 2px;
      }
      .color .hex {
        width: 96px !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .segmented {
        display: flex;
      }
      .segmented button {
        flex: 1;
        border-radius: 0;
      }
      .segmented button:first-child {
        border-radius: var(--mm-radius) 0 0 var(--mm-radius);
      }
      .segmented button:last-child {
        border-radius: 0 var(--mm-radius) var(--mm-radius) 0;
      }
      .segmented button + button {
        margin-left: -1px;
      }
      .spacing {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
      }
      .spacing label {
        display: grid;
        gap: 2px;
        font-size: 11px;
        color: var(--mm-color-muted);
      }
      .spacing input {
        width: 100%;
        color: var(--mm-color-text);
      }
      .color input.unset {
        opacity: 0.35;
      }
      .toggle {
        width: 18px;
        height: 18px;
      }
      .image {
        display: grid;
        gap: 6px;
        border-radius: var(--mm-radius);
        outline-offset: 4px;
      }
      .image-actions {
        display: flex;
        gap: 4px;
      }
      .image.drop-over {
        outline: 2px dashed var(--mm-color-accent);
        background: var(--mm-color-accent-soft);
      }
      .image.uploading .thumb {
        opacity: 0.5;
      }
      .image .status,
      .image .error {
        margin: 0;
        font-size: 11px;
      }
      .image .status {
        color: var(--mm-color-muted);
      }
      .image .error {
        color: var(--mm-color-danger);
      }
      .thumb {
        max-width: 100%;
        max-height: 96px;
        object-fit: contain;
        justify-self: start;
        border: 1px solid var(--mm-color-border);
        border-radius: 4px;
        background: repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 12px 12px;
      }
      .social-items {
        display: grid;
        gap: 6px;
      }
      .social-item {
        display: grid;
        grid-template-columns: 96px 1fr auto;
        gap: 4px;
      }
      .layouts {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .layout {
        display: flex;
        gap: 3px;
        height: 28px;
        padding: 4px;
      }
      .layout span {
        background: var(--mm-color-accent-soft);
        border: 1px solid var(--mm-color-accent);
        border-radius: 2px;
      }
      .message {
        color: var(--mm-color-muted);
      }
      .danger {
        color: var(--mm-color-danger);
      }
    `,
  ];

  constructor() {
    super();
    /** @type {Template} */
    this.template = /** @type {any} */ (null);
    /** @type {string | null} */
    this.selection = null;
    /** @type {ReadonlyMap<string, import('../upload.js').UploadState>} アップロードの状態（ブロック ID ごと） */
    this.uploads = new Map();
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
  }

  /**
   * @param {string} idPrefix
   * @param {Record<string, unknown>} values
   * @param {(key: string, value: unknown, merge: boolean) => void} onChange
   * @returns {FieldContext}
   */
  _fieldContext(idPrefix, values, onChange) {
    const { ctx } = this;
    return {
      t: ctx.t,
      locale: ctx.locale,
      idPrefix,
      values,
      mergeTags: ctx.mergeTags,
      delimiters: ctx.delimiters,
      onImageSelect: ctx.onImageSelect,
      change: (key, value, options = {}) => onChange(key, value, options.merge ?? false),
    };
  }

  /**
   * @param {FieldSpec[]} specs
   * @param {FieldContext} fieldCtx
   */
  _fields(specs, fieldCtx) {
    return specs.map((spec) => renderField(spec, getIn(fieldCtx.values, spec.key), fieldCtx));
  }

  /** @param {Target} target */
  _breadcrumb(target) {
    const { t, store } = this.ctx;
    /** @type {Array<{ id: string | null, label: string }>} */
    const items = [{ id: null, label: t('crumb.body') }];
    if (target.kind !== 'body') items.push({ id: target.row.id, label: t('crumb.row') });
    if (target.kind === 'column' || target.kind === 'block') {
      const index = target.row.columns.indexOf(target.column) + 1;
      items.push({ id: target.column.id, label: `${t('crumb.column')} ${index}` });
    }
    if (target.kind === 'block') {
      const def = getEditorBlockDef(target.block.type);
      items.push({
        id: target.block.id,
        label: def ? t(def.labelKey) : t('block.unknown', { type: target.block.type }),
      });
    }
    return html`<nav aria-label="breadcrumb">
      ${items.map(
        (item, i) =>
          html`${i > 0 ? html`<span class="sep">›</span>` : nothing}
            <button
              type="button"
              aria-current=${i === items.length - 1 ? 'true' : 'false'}
              @click=${() => store.select(item.id)}
            >
              ${item.label}
            </button>`,
      )}
    </nav>`;
  }

  render() {
    const { template, ctx } = this;
    if (!template || !ctx) return nothing;
    const { t, store } = ctx;
    const target = resolveTarget(template, this.selection);
    /** @param {string} id @param {string} key */
    const mergeKey = (id, key) => `${id}:${key}`;

    let body;
    if (target.kind === 'body') {
      const fieldCtx = this._fieldContext('mm-body', template.body.settings, (key, value, merge) =>
        store.dispatch({
          type: 'updateBodySettings',
          patch: patchAt(key, value),
          mergeKey: merge ? mergeKey('body', key) : undefined,
        }),
      );
      body = html`<section>
        <h3>${t('section.body')}</h3>
        ${this._fields(BODY_FIELDS, fieldCtx)}
      </section>`;
    } else if (target.kind === 'row') {
      const { row } = target;
      const values = { ...row.settings, layout: row.layout };
      const fieldCtx = this._fieldContext(`mm-${row.id}`, values, (key, value, merge) => {
        if (key === 'layout') {
          store.dispatch({
            type: 'setRowLayout',
            rowId: row.id,
            layout: /** @type {any} */ (value),
          });
        } else {
          store.dispatch({
            type: 'updateRowSettings',
            rowId: row.id,
            patch: patchAt(key, value),
            mergeKey: merge ? mergeKey(row.id, key) : undefined,
          });
        }
      });
      body = html`<section>
        <h3>${t('section.layout')}</h3>
        ${this._fields(ROW_FIELDS, fieldCtx)}
      </section>`;
    } else if (target.kind === 'column') {
      const { column } = target;
      const fieldCtx = this._fieldContext(`mm-${column.id}`, column.settings, (key, value, merge) =>
        store.dispatch({
          type: 'updateColumnSettings',
          columnId: column.id,
          patch: patchAt(key, value),
          mergeKey: merge ? mergeKey(column.id, key) : undefined,
        }),
      );
      body = html`<section>
        <h3>${t('section.style')}</h3>
        ${this._fields(COLUMN_FIELDS, fieldCtx)}
      </section>`;
    } else {
      const { block } = target;
      const edef = getEditorBlockDef(block.type);
      const known = Boolean(getBlockDef(block.type));
      const valuesCtx = {
        ...this._fieldContext(`mm-${block.id}`, block.values, (key, value, merge) =>
          store.dispatch({
            type: 'updateBlockValues',
            blockId: block.id,
            patch: patchAt(key, value),
            mergeKey: merge ? mergeKey(block.id, key) : undefined,
          }),
        ),
        upload: this.ctx.onImageUpload
          ? (/** @type {string} */ key, /** @type {File} */ file) =>
              this.ctx.upload(file, { blockId: block.id, field: key })
          : null,
        uploadState: this.uploads.get(block.id) ?? null,
      };
      const styleCtx = this._fieldContext(
        `mm-${block.id}-style`,
        block.style,
        (key, value, merge) =>
          store.dispatch({
            type: 'updateBlockStyle',
            blockId: block.id,
            patch: patchAt(key, value),
            mergeKey: merge ? mergeKey(block.id, `style.${key}`) : undefined,
          }),
      );
      const hideCtx = this._fieldContext(
        `mm-${block.id}-hide`,
        { hideOn: block.hideOn },
        (_key, value) =>
          store.dispatch({
            type: 'setBlockHideOn',
            blockId: block.id,
            hideOn: /** @type {any} */ (value),
          }),
      );
      body =
        known && edef
          ? html`<section>
                <h3>${t('section.content')}</h3>
                ${this._fields(edef.fields, valuesCtx)}
              </section>
              <section>
                <h3>${t('section.style')}</h3>
                ${this._fields(BLOCK_STYLE_FIELDS, styleCtx)}
              </section>
              <section>
                <h3>${t('section.visibility')}</h3>
                ${this._fields([HIDE_FIELD], hideCtx)}
              </section>`
          : html`<section>
              <p class="message">${t('placeholder.unknown')}</p>
              <button
                type="button"
                class="danger"
                @click=${() => store.dispatch({ type: 'removeBlock', blockId: block.id })}
              >
                ${t('action.delete')}
              </button>
            </section>`;
    }

    return html`${this._breadcrumb(target)}${body}`;
  }
}

define('mm-settings-panel', MmSettingsPanel);
