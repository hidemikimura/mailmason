// キャンバス上のブロック 1 つ。見た目は core の出力 HTML をそのまま使う（配信結果とずれないように）
import { LitElement, css, html, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { styleMap } from 'lit/directives/style-map.js';
import { getBlockDef } from '../../core/blocks/registry.js';
import { renderBlockContent } from '../../core/render-html/index.js';
import { resolveTextStyle } from '../../core/render-html/styles.js';
import { getEditorBlockDef } from '../blocks/index.js';
import { clearHighlights, highlightMergeTags } from '../richtext/highlight.js';
import { chromeStyles, renderChrome } from './chrome.js';
import { define } from '../context.js';
import './mm-text-editor.js';

/** キャンバス上で直接編集できるブロック */
export const EDITABLE_TYPES = new Set(['text', 'imageText']);

/** @import { Block, BodySettings } from '../../core/model/types.js' */
/** @import { EditorContext } from '../context.js' */

export class MmBlock extends LitElement {
  static properties = {
    block: { attribute: false },
    width: { type: Number },
    body: { attribute: false },
    ctx: { attribute: false },
    columnId: { attribute: false },
    index: { type: Number },
    count: { type: Number },
    selected: { type: Boolean, reflect: true },
    editing: { type: Boolean, reflect: true },
    upload: { attribute: false },
  };

  static styles = [
    chromeStyles,
    css`
      :host {
        display: block;
        position: relative;
        cursor: default;
        outline-offset: -1px;
      }
      :host(:hover) {
        outline: 1px dashed var(--mm-color-accent);
      }
      :host([selected]) {
        outline: 2px solid var(--mm-color-accent);
        z-index: 2;
      }
      :host([dragging]) {
        opacity: 0.35;
      }
      :host([editing]) {
        outline: 2px solid var(--mm-color-accent);
        z-index: 4;
        cursor: auto;
      }
      .image-text {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .image-text-image {
        flex: none;
      }
      .image-text-image img {
        display: block;
        width: 100%;
        height: auto;
      }
      .image-text-body {
        flex: 1;
        min-width: 0;
      }
      ::highlight(mm-merge-tag) {
        background-color: rgba(47, 111, 237, 0.18);
      }
      .content {
        overflow: hidden;
      }
      :host([editing]) .content {
        overflow: visible;
      }
      .placeholder {
        padding: 12px;
        border: 1px dashed #c5cad1;
        border-radius: 4px;
        color: #8a939d;
        font: 12px/1.4 var(--mm-font-family);
        text-align: center;
        background: repeating-linear-gradient(
          45deg,
          rgba(0, 0, 0, 0.02),
          rgba(0, 0, 0, 0.02) 6px,
          transparent 6px,
          transparent 12px
        );
      }
      iframe {
        display: block;
        width: 100%;
        border: 0;
      }
      .uploading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.6);
        pointer-events: none;
      }
      .uploading span {
        padding: 4px 10px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.65);
        color: #fff;
        font: 12px/1.5 var(--mm-font-family);
      }
      .upload-preview {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
        opacity: 0.6;
      }
      .badge {
        position: absolute;
        right: 4px;
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
    /** @type {Block} */
    this.block = /** @type {any} */ (null);
    this.width = 0;
    /** @type {BodySettings} */
    this.body = /** @type {any} */ (null);
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    this.columnId = '';
    this.index = 0;
    this.count = 1;
    this.selected = false;
    this.editing = false;
    /** @type {import('../upload.js').UploadState | null} このブロックのアップロードの状態 */
    this.upload = null;
    this.addEventListener('click', (event) => {
      event.stopPropagation();
      // キャンバス内のリンクで画面遷移しないようにする
      if (event.composedPath().some((node) => node instanceof HTMLAnchorElement)) {
        event.preventDefault();
      }
      if (this.editing) return;
      // 選択中のテキストをもう一度クリックすると直接編集に入る
      if (this.selected && EDITABLE_TYPES.has(this.block.type)) this.ctx.edit(this.block.id);
      else this.ctx.store.select(this.block.id);
    });
    this.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      if (!this.editing && EDITABLE_TYPES.has(this.block.type)) {
        this.ctx.store.select(this.block.id);
        this.ctx.edit(this.block.id);
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearHighlights(this);
  }

  updated() {
    // 編集していないブロックのマージタグもハイライトする
    const content = this.renderRoot.querySelector('.content');
    if (this.editing || !this.ctx) clearHighlights(this);
    else highlightMergeTags(this, content, this.ctx.delimiters);
  }

  /** 直接編集の表示（テキスト・画像＋テキスト） */
  _renderEditor() {
    const { block, body, ctx } = this;
    const values = /** @type {any} */ (block.values);
    if (block.type === 'text') {
      return html`<mm-text-editor
        .value=${values.html}
        .blockId=${block.id}
        .field=${'html'}
        .textStyle=${resolveTextStyle(body, values)}
        .linkColor=${body.linkColor}
        .ctx=${ctx}
      ></mm-text-editor>`;
    }
    // 画像＋テキスト: 画像は見た目だけ置き、テキストを編集する
    const right = values.imagePosition === 'right';
    return html`<div
      class="image-text"
      style=${styleMap({ 'flex-direction': right ? 'row-reverse' : 'row' })}
    >
      <div class="image-text-image" style=${styleMap({ width: `${values.imageWidthPercent}%` })}>
        ${
          values.image.src
            ? html`<img src=${values.image.src} alt=${values.image.alt} />`
            : html`<div class="placeholder">${ctx.t('placeholder.image')}</div>`
        }
      </div>
      <mm-text-editor
        class="image-text-body"
        .value=${values.html}
        .blockId=${block.id}
        .field=${'html'}
        .textStyle=${resolveTextStyle(body)}
        .linkColor=${body.linkColor}
        .ctx=${ctx}
      ></mm-text-editor>
    </div>`;
  }

  /** @param {Event} event */
  _resizeFrame(event) {
    const frame = /** @type {HTMLIFrameElement} */ (event.target);
    const height = frame.contentDocument?.documentElement.scrollHeight;
    if (height) frame.style.height = `${height}px`;
  }

  /** @param {number} to */
  _move(to) {
    this.ctx.store.dispatch({
      type: 'moveBlock',
      blockId: this.block.id,
      columnId: this.columnId,
      index: to,
    });
  }

  _duplicate() {
    const { store } = this.ctx;
    store.dispatch({ type: 'duplicateBlock', blockId: this.block.id });
    for (const row of store.getState().template.body.rows) {
      const column = row.columns.find((c) => c.id === this.columnId);
      const copy = column?.blocks[this.index + 1];
      if (copy) store.select(copy.id);
    }
  }

  render() {
    const { block, ctx, body } = this;
    if (!block || !ctx) return nothing;
    const def = getBlockDef(block.type);
    const edef = getEditorBlockDef(block.type);
    const { padding, backgroundColor } = block.style;
    const contentWidth = Math.max(1, this.width - padding.left - padding.right);
    const content = def ? renderBlockContent(block, contentWidth, body, ctx.htmlOptions) : '';
    const label = edef ? ctx.t(edef.labelKey) : ctx.t('block.unknown', { type: block.type });

    const uploading = this.upload?.status === 'uploading';
    let inner;
    if (uploading && this.upload?.preview && block.type === 'image') {
      // アップロード中は手元のファイルを仮表示する
      const width = /** @type {any} */ (block.values).width;
      const size = width?.unit === 'px' ? `${width.value}px` : `${width?.value ?? 100}%`;
      inner = html`<img
        class="upload-preview"
        src=${this.upload.preview}
        alt=""
        style=${styleMap({ width: size })}
      />`;
    } else if (this.editing && def && EDITABLE_TYPES.has(block.type)) {
      inner = this._renderEditor();
    } else if (!def) {
      inner = html`<div class="placeholder">${label}<br />${ctx.t('placeholder.unknown')}</div>`;
    } else if (!content) {
      inner = html`<div class="placeholder">
        ${ctx.t(edef?.placeholderKey ?? 'placeholder.text')}
      </div>`;
    } else if (block.type === 'html') {
      // 生 HTML はエディタを壊さないよう iframe に隔離する（スクリプトは実行しない）
      inner = html`<iframe
        sandbox="allow-same-origin"
        title=${label}
        .srcdoc=${`<!doctype html><html><body style="margin:0">${content}</body></html>`}
        @load=${this._resizeFrame}
      ></iframe>`;
    } else {
      inner = unsafeHTML(content);
    }

    const style = {
      padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
      'background-color': backgroundColor ?? '',
      'text-align': def?.cellAlign?.(block) ?? '',
    };

    return html`<div class="content" style=${styleMap(style)}>${inner}</div>
      ${block.hideOn === 'mobile' ? html`<span class="badge">${ctx.t('badge.hiddenOnMobile')}</span>` : nothing}
      ${
        uploading
          ? html`<div class="uploading" role="status">
              <span>${ctx.t('image.uploading')}</span>
            </div>`
          : nothing
      }
      ${
        this.selected && !this.editing
          ? renderChrome(
              label,
              {
                moveUp: this.index > 0 ? () => this._move(this.index - 1) : null,
                moveDown: this.index < this.count - 1 ? () => this._move(this.index + 1) : null,
                duplicate: () => this._duplicate(),
                remove: () => ctx.store.dispatch({ type: 'removeBlock', blockId: block.id }),
              },
              ctx.t,
              (/** @type {PointerEvent} */ event) =>
                ctx.dnd.start(event, { kind: 'move-block', blockId: block.id }),
            )
          : nothing
      }`;
  }
}

define('mm-block', MmBlock);
