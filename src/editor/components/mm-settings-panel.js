// 設定パネル: 選択中の要素（なし＝メール全体 / 行 / カラム / ブロック）の項目を FieldSpec から描画する
import { LitElement, css, html, nothing } from 'lit';
import { findRowIndex, locateBlock, locateColumn } from '../../core/model/tree.js';
import { getBlockDef } from '../../core/blocks/registry.js';
import { blockLabel, getEditorBlockDef } from '../blocks/index.js';
import { renderField } from '../fields/fields.js';
import { controls } from '../styles.js';
import { getIn, isComposing, patchAt } from '../util.js';
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
  { key: 'backgroundImage', kind: 'backgroundImage', labelKey: 'field.outerBackgroundImage' },
  { key: 'contentBackgroundColor', kind: 'color', labelKey: 'field.contentBackgroundColor' },
  {
    key: 'contentBackgroundImage',
    kind: 'backgroundImage',
    labelKey: 'field.contentBackgroundImage',
    helpKey: 'field.backgroundImageNestHelp',
  },
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
  { key: 'backgroundImage', kind: 'backgroundImage', labelKey: 'field.backgroundImage' },
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
  { key: 'backgroundImage', kind: 'backgroundImage', labelKey: 'field.backgroundImage' },
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
    _actions: { state: true },
    _component: { state: true },
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
      .with-menu input,
      .with-menu textarea {
        flex: 1;
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
      .image .error,
      .qr .status,
      .qr .error,
      .qr .warning {
        margin: 0;
        font-size: 11px;
      }
      .image .status,
      .qr .status {
        color: var(--mm-color-muted);
      }
      .image .error,
      .qr .error {
        color: var(--mm-color-danger);
      }
      .qr {
        display: grid;
        gap: 6px;
      }
      .list {
        display: grid;
        gap: 8px;
      }
      .list-item {
        display: grid;
        gap: 8px;
        padding: 8px;
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        background: var(--mm-color-surface-2);
      }
      .list-head {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
      }
      .list-head span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .list-head button {
        padding: 0 6px;
        min-width: 24px;
      }
      .action {
        display: grid;
        gap: 4px;
      }
      .save-component .field {
        grid-template-columns: 1fr auto;
      }
      .save-component .field > label,
      .save-component .field > p {
        grid-column: 1 / -1;
      }
      .save-component .error {
        margin: 0;
        font-size: 11px;
        color: var(--mm-color-danger);
      }
      .action .error {
        margin: 0;
        font-size: 11px;
        color: var(--mm-color-danger);
      }
      .qr .warning {
        color: #b45309;
        font-weight: 500;
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
      .background-image {
        display: grid;
        gap: 8px;
      }
      .background-options {
        display: grid;
        gap: 8px;
        padding: 8px;
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        background: var(--mm-color-surface-2);
      }
      .background-option {
        display: grid;
        grid-template-columns: 56px 1fr;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--mm-color-muted);
      }
      .background-option.inline {
        grid-template-columns: auto 1fr;
      }
      .position-grid {
        display: grid;
        grid-template-columns: repeat(3, 22px);
        gap: 3px;
      }
      .position-grid button {
        width: 22px;
        height: 22px;
        padding: 0;
        position: relative;
      }
      .position-grid button::after {
        content: '';
        position: absolute;
        inset: 8px;
        border-radius: 50%;
        background: var(--mm-color-border);
      }
      .position-grid button[aria-pressed='true']::after {
        background: var(--mm-color-accent);
      }
      .table-columns {
        display: grid;
        gap: 6px;
      }
      .table-column {
        display: grid;
        grid-template-columns: 44px auto 1fr;
        align-items: center;
        gap: 6px;
      }
      .table-column .number input {
        width: 64px;
      }
      .table-column-name {
        font-size: 11px;
        color: var(--mm-color-muted);
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
    /** @type {ReadonlyMap<string, { busy: boolean, error: string | null }>} カスタムブロックの action の状態（`${blockId}:${key}`） */
    this._actions = new Map();
    /** @type {{ id: string, name: string, status: 'idle' | 'saving' | 'saved' | 'error', message: string }} 「コンポーネントとして保存」の入力と状態（選択中の行・ブロックごと） */
    this._component = { id: '', name: '', status: 'idle', message: '' };
  }

  /**
   * 「コンポーネントとして保存」（行・ブロックを選択中、onSaveComponent があるとき）
   * @param {string} id 行またはブロックの ID
   * @param {string} fallbackName 名前が空のときの名前
   */
  _renderSaveComponent(id, fallbackName) {
    const { t } = this.ctx;
    if (!this.ctx.canSaveComponents) return nothing;
    const state =
      this._component.id === id
        ? this._component
        : { id, name: '', status: /** @type {const} */ ('idle'), message: '' };
    const save = async () => {
      const name = state.name.trim() || fallbackName;
      this._component = { ...state, status: 'saving', message: '' };
      try {
        const saved = await this.ctx.saveComponent(id, name);
        this._component = {
          id,
          name: '',
          status: 'saved',
          message: t('component.saved', { name: saved.name || name }),
        };
      } catch (error) {
        const detail = error instanceof Error && error.message ? `: ${error.message}` : '';
        this._component = {
          ...state,
          status: 'error',
          message: `${t('component.saveFailed')}${detail}`,
        };
      }
    };
    return html`<section class="save-component">
      <h3>${t('section.component')}</h3>
      <div class="field">
        <label for="mm-component-name">${t('component.name')}</label>
        <input
          id="mm-component-name"
          type="text"
          .value=${state.name}
          placeholder=${fallbackName}
          ?disabled=${state.status === 'saving'}
          @input=${(/** @type {Event} */ e) =>
            (this._component = {
              ...state,
              name: /** @type {HTMLInputElement} */ (e.target).value,
              status: 'idle',
              message: '',
            })}
          @keydown=${(/** @type {KeyboardEvent} */ e) => {
            if (e.key === 'Enter' && !isComposing(e)) {
              e.preventDefault();
              void save();
            }
          }}
        />
        <button
          type="button"
          data-action="save-component"
          ?disabled=${state.status === 'saving'}
          @click=${() => void save()}
        >
          ${t('component.save')}
        </button>
        ${
          state.status === 'saving'
            ? html`<p class="help" role="status">${t('component.saving')}</p>`
            : state.status === 'saved'
              ? html`<p class="help" role="status">${state.message}</p>`
              : state.status === 'error'
                ? html`<p class="error" role="alert">${state.message}</p>`
                : html`<p class="help">${t('component.help')}</p>`
        }
      </div>
    </section>`;
  }

  /**
   * カスタムブロックの action を実行し、返った値をブロックに入れる
   * @param {import('../../core/model/types.js').Block} block
   * @param {FieldSpec} spec
   */
  async _runAction(block, spec) {
    const id = `${block.id}:${spec.key}`;
    if (!spec.run || this._actions.get(id)?.busy) return;
    /** @param {{ busy: boolean, error: string | null } | null} state */
    const set = (state) => {
      const next = new Map(this._actions);
      if (state) next.set(id, state);
      else next.delete(id);
      this._actions = next;
    };
    set({ busy: true, error: null });
    try {
      const patch = await spec.run({
        values: structuredClone(block.values),
        blockId: block.id,
        locale: this.ctx.locale,
      });
      set(null);
      if (
        patch &&
        typeof patch === 'object' &&
        locateBlock(this.ctx.store.getState().template, block.id)
      ) {
        this.ctx.store.dispatch({
          type: 'updateBlockValues',
          blockId: block.id,
          patch: /** @type {Record<string, unknown>} */ (patch),
        });
      }
    } catch (error) {
      const detail = error instanceof Error && error.message ? `: ${error.message}` : '';
      set({ busy: false, error: `${this.ctx.t('action.failed')}${detail}` });
      this.dispatchEvent(
        new CustomEvent('mm-warning', {
          detail: {
            code: 'block-action-failed',
            path: `block(${block.id})`,
            message: `Custom block action failed${detail}`,
            blockId: block.id,
            error,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
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
      mergeTagTrigger: ctx.mergeTagTrigger,
      onImageSelect: ctx.onImageSelect,
      change: (key, value, options = {}) => onChange(key, value, options.merge ?? false),
    };
  }

  /**
   * 背景画像のアップロード（ボディ・行・カラム）
   * @param {string} id 行・カラムの ID（ボディは 'body'）
   * @param {'body' | 'row' | 'column'} scope
   * @returns {Pick<FieldContext, 'upload' | 'uploadState'>}
   */
  _backgroundUpload(id, scope) {
    const { ctx } = this;
    return {
      upload: ctx.onImageUpload
        ? (key, file) => ctx.upload(file, { blockId: id, field: key, scope })
        : null,
      uploadState: this.uploads.get(id) ?? null,
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
      const def = getEditorBlockDef(target.block.type, this.ctx.blocks);
      items.push({
        id: target.block.id,
        label: def ? blockLabel(def, this.ctx) : t('block.unknown', { type: target.block.type }),
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
      const fieldCtx = {
        ...this._fieldContext('mm-body', template.body.settings, (key, value, merge) =>
          store.dispatch({
            type: 'updateBodySettings',
            patch: patchAt(key, value),
            mergeKey: merge ? mergeKey('body', key) : undefined,
          }),
        ),
        ...this._backgroundUpload('body', 'body'),
      };
      body = html`<section>
        <h3>${t('section.body')}</h3>
        ${this._fields(BODY_FIELDS, fieldCtx)}
      </section>`;
    } else if (target.kind === 'row') {
      const { row } = target;
      const values = { ...row.settings, layout: row.layout };
      const rowCtx = this._fieldContext(`mm-${row.id}`, values, (key, value, merge) => {
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
      const fieldCtx = { ...rowCtx, ...this._backgroundUpload(row.id, 'row') };
      body = html`<section>
          <h3>${t('section.layout')}</h3>
          ${this._fields(ROW_FIELDS, fieldCtx)}
        </section>
        ${this._renderSaveComponent(row.id, t('crumb.row'))}`;
    } else if (target.kind === 'column') {
      const { column } = target;
      const fieldCtx = {
        ...this._fieldContext(`mm-${column.id}`, column.settings, (key, value, merge) =>
          store.dispatch({
            type: 'updateColumnSettings',
            columnId: column.id,
            patch: patchAt(key, value),
            mergeKey: merge ? mergeKey(column.id, key) : undefined,
          }),
        ),
        ...this._backgroundUpload(column.id, 'column'),
      };
      body = html`<section>
        <h3>${t('section.style')}</h3>
        ${this._fields(COLUMN_FIELDS, fieldCtx)}
      </section>`;
    } else {
      const { block } = target;
      const edef = getEditorBlockDef(block.type, this.ctx.blocks);
      const known = Boolean(getBlockDef(block.type, this.ctx.blocks));
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
        generateQr: this.ctx.onImageUpload ? () => this.ctx.generateQr(block.id) : null,
        blockId: block.id,
        runAction: (/** @type {FieldSpec} */ spec) => void this._runAction(block, spec),
        actionState: new Map(
          [...this._actions]
            .filter(([id]) => id.startsWith(`${block.id}:`))
            .map(([id, state]) => [id.slice(block.id.length + 1), state]),
        ),
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
              </section>
              ${this._renderSaveComponent(block.id, blockLabel(edef, this.ctx))}`
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
