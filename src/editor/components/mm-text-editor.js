// キャンバス上でテキストを直接編集する部品。
// - 入力のたびに許可タグへ整えてストアに反映する（mergeKey で 1 つの履歴にまとめる）
// - 書式は document.execCommand で付け、結果の揺れは正規化器（sanitizeHtml）で吸収する
// - 自分が出した値以外（Undo など）が来たときだけ中身を置き換え、入力中のキャレットを動かさない
import { LitElement, css, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { sanitizeHtml } from '../../core/richtext/sanitize.js';
import { escapeText } from '../../core/richtext/entities.js';
import { patchAt } from '../util.js';
import { getRangeIn, placeCaretAtEnd, restoreRange } from '../richtext/selection.js';
import { clearHighlights, highlightMergeTags } from '../richtext/highlight.js';
import { controls } from '../styles.js';
import { define } from '../context.js';

/** @import { EditorContext } from '../context.js' */
/** @import { TextStyle } from '../../core/render-html/styles.js' */

/** 文字色の候補 */
export const TEXT_COLORS = [
  '#333333',
  '#888888',
  '#cc0000',
  '#e8590c',
  '#2f9e44',
  '#1971c2',
  '#6741d9',
  '#ffffff',
];

/**
 * プレーンテキストの貼り付けを段落と改行にする
 * @param {string} text
 */
function textToHtml(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeText(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export class MmTextEditor extends LitElement {
  static properties = {
    value: { attribute: false },
    blockId: { attribute: false },
    field: { attribute: false },
    textStyle: { attribute: false },
    linkColor: { attribute: false },
    ctx: { attribute: false },
    _linkOpen: { state: true },
    _colorOpen: { state: true },
  };

  static styles = [
    controls,
    css`
      :host {
        display: block;
        position: relative;
      }
      .toolbar {
        position: absolute;
        left: -2px;
        bottom: calc(100% + 4px);
        z-index: 5;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px;
        padding: 4px;
        background: var(--mm-color-surface);
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: var(--mm-font-family);
        font-size: 12px;
        min-width: max-content;
      }
      .toolbar button {
        min-width: 26px;
        height: 26px;
        padding: 0 6px;
        border-color: transparent;
        background: transparent;
      }
      .toolbar button:hover {
        border-color: var(--mm-color-border);
      }
      .toolbar select {
        height: 26px;
        padding: 0 4px;
        font-size: 12px;
      }
      .color-a {
        border-bottom: 3px solid #cc0000;
        line-height: 1;
      }
      .sep {
        width: 1px;
        height: 18px;
        background: var(--mm-color-border);
        margin: 0 2px;
      }
      .popover {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        display: flex;
        gap: 4px;
        padding: 6px;
        background: var(--mm-color-surface);
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .popover input {
        width: 240px;
      }
      .swatch {
        width: 22px !important;
        min-width: 22px !important;
        height: 22px !important;
        padding: 0 !important;
        border: 1px solid rgba(0, 0, 0, 0.2) !important;
        border-radius: 50% !important;
      }
      .editable {
        outline: none;
        min-height: 1.5em;
        cursor: text;
        word-break: break-word;
      }
      .editable:empty::before {
        content: attr(data-placeholder);
        color: #9aa1a9;
      }
      .editable > :first-child {
        margin-top: 0;
      }
      .editable > :last-child {
        margin-bottom: 0 !important;
      }
      .editable p {
        margin: 0 0 1em;
      }
      .editable h1,
      .editable h2,
      .editable h3 {
        margin: 0 0 0.5em;
        line-height: 1.4;
        font-weight: bold;
      }
      .editable h1 {
        font-size: 1.75em;
      }
      .editable h2 {
        font-size: 1.4em;
      }
      .editable h3 {
        font-size: 1.2em;
      }
      .editable ul,
      .editable ol {
        margin: 0 0 1em;
        padding-left: 1.5em;
      }
      .editable li {
        margin: 0 0 0.25em;
      }
      .editable a {
        color: var(--mm-link-color);
        text-decoration: underline;
      }
      ::highlight(mm-merge-tag) {
        background-color: rgba(47, 111, 237, 0.18);
        color: #1a4fb8;
      }
    `,
  ];

  constructor() {
    super();
    this.value = '';
    this.blockId = '';
    this.field = 'html';
    /** @type {TextStyle} */
    this.textStyle = /** @type {any} */ (null);
    this.linkColor = '#0066cc';
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    this._linkOpen = false;
    this._colorOpen = false;
    /** 最後にストアへ送った値（外部からの変更と区別するため） */
    this._lastHtml = /** @type {string | null} */ (null);
    /** @type {Range | null} ツールバー操作のために保存した選択範囲 */
    this._savedRange = null;
    this._onSelectionChange = () => this._captureSelection();
  }

  /** @returns {HTMLElement} */
  get editable() {
    return /** @type {HTMLElement} */ (this.renderRoot.querySelector('.editable'));
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('selectionchange', this._onSelectionChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('selectionchange', this._onSelectionChange);
    clearHighlights(this);
  }

  firstUpdated() {
    this._setContent(this.value);
    this.focus();
  }

  /** 編集領域にフォーカスし、キャレットを末尾に置く */
  focus() {
    const el = this.editable;
    if (!el) return;
    el.focus();
    // Enter で <div> ではなく <p> を作らせる（整形でも直すが、見た目のちらつきを防ぐ）
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // 未対応でも正規化で p になる
    }
    placeCaretAtEnd(el);
    this._captureSelection();
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (changed.has('value') && this.value !== this._lastHtml && this.editable) {
      // Undo など外部からの変更
      this._setContent(this.value);
    }
  }

  /** @param {string} value */
  _setContent(value) {
    const el = this.editable;
    if (!el) return;
    el.innerHTML = value;
    this._lastHtml = value;
    highlightMergeTags(this, el, this.ctx.delimiters);
  }

  _captureSelection() {
    const root = /** @type {ShadowRoot} */ (this.renderRoot);
    const range = getRangeIn(root);
    if (range && this.editable?.contains(range.commonAncestorContainer)) {
      this._savedRange = range;
    }
  }

  /** 入力内容を整えてストアに送る */
  _commit() {
    const clean = sanitizeHtml(this.editable.innerHTML, { delimiters: this.ctx.delimiters });
    highlightMergeTags(this, this.editable, this.ctx.delimiters);
    if (clean === this._lastHtml) return;
    this._lastHtml = clean;
    this.ctx.store.dispatch({
      type: 'updateBlockValues',
      blockId: this.blockId,
      patch: patchAt(this.field, clean),
      mergeKey: `${this.blockId}:${this.field}`,
    });
  }

  /**
   * 書式コマンドを実行する（ツールバーでフォーカスが移っていても選択範囲を戻してから）
   * @param {string} command
   * @param {string} [value]
   */
  exec(command, value) {
    const el = this.editable;
    // 今の選択範囲が編集領域の中ならそれを使い、外（リンク入力欄など）なら保存しておいた範囲に戻す
    const current = getRangeIn(/** @type {ShadowRoot} */ (this.renderRoot));
    const range =
      current && el.contains(current.commonAncestorContainer) ? current : this._savedRange;
    el.focus();
    if (range) restoreRange(range);
    document.execCommand(command, false, value);
    this._captureSelection();
    this._commit();
  }

  /** @param {KeyboardEvent} event */
  _onKeydown(event) {
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._commit();
      this.ctx.edit(null);
      return;
    }
    // ブラウザ標準の Undo は使わず、ストアの Undo に一本化する
    if (mod && (key === 'z' || key === 'y')) {
      event.preventDefault();
      event.stopPropagation();
      this._commit();
      if (key === 'y' || event.shiftKey) this.ctx.store.redo();
      else this.ctx.store.undo();
      return;
    }
    if (mod && key === 'b') {
      event.preventDefault();
      this.exec('bold');
    } else if (mod && key === 'i') {
      event.preventDefault();
      this.exec('italic');
    } else if (mod && key === 'u') {
      event.preventDefault();
      this.exec('underline');
    } else if (mod && key === 'k') {
      event.preventDefault();
      this._openLink();
    }
    event.stopPropagation();
  }

  /** @param {InputEvent} event */
  _onBeforeInput(event) {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      if (event.inputType === 'historyUndo') this.ctx.store.undo();
      else this.ctx.store.redo();
    }
  }

  /** @param {ClipboardEvent} event */
  _onPaste(event) {
    const data = event.clipboardData;
    if (!data) return;
    event.preventDefault();
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    const clean = html ? sanitizeHtml(html, { delimiters: this.ctx.delimiters }) : textToHtml(text);
    if (clean) document.execCommand('insertHTML', false, clean);
    this._commit();
  }

  /** @param {FocusEvent} event */
  _onFocusOut(event) {
    const next = /** @type {Node | null} */ (event.relatedTarget);
    // ツールバー（同じ Shadow DOM 内）へ移るときは編集を続ける
    if (next && (this.renderRoot.contains(next) || this.contains(next))) return;
    this._commit();
    // 別の要素をクリックした場合は、選択の変化でも終了する。ここではフォーカスが外れたことだけで終える
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      const active = /** @type {ShadowRoot} */ (this.renderRoot).activeElement;
      if (!active) this.ctx.edit(null);
    });
  }

  _openLink() {
    this._captureSelection();
    this._colorOpen = false;
    this._linkOpen = true;
    this.updateComplete.then(() => {
      /** @type {HTMLInputElement | null} */ (
        this.renderRoot.querySelector('.link-input')
      )?.focus();
    });
  }

  /** @param {Event} event */
  _applyLink(event) {
    event.preventDefault();
    const input = /** @type {HTMLInputElement} */ (this.renderRoot.querySelector('.link-input'));
    const url = input.value.trim();
    this._linkOpen = false;
    if (url) this.exec('createLink', url);
    else this.exec('unlink');
  }

  /**
   * ツールバーのボタン。押したときにフォーカス（＝選択範囲）を奪わない
   * @param {unknown} label
   * @param {string} title
   * @param {() => void} action
   * @param {string} [name]
   */
  _button(label, title, action, name = '') {
    return html`<button
      type="button"
      title=${title}
      aria-label=${title}
      data-command=${name}
      @pointerdown=${(/** @type {Event} */ e) => e.preventDefault()}
      @click=${action}
    >
      ${label}
    </button>`;
  }

  render() {
    const { ctx } = this;
    if (!ctx || !this.textStyle) return nothing;
    const { t } = ctx;
    const s = this.textStyle;
    const style = {
      'font-family': s.fontFamily,
      'font-size': `${s.fontSize}px`,
      'line-height': String(s.lineHeight),
      color: s.color,
      '--mm-link-color': this.linkColor,
    };

    return html`<div class="toolbar" role="toolbar" aria-label=${t('text.toolbar')}>
        <select
          aria-label=${t('text.block')}
          @change=${(/** @type {Event} */ e) => {
            const select = /** @type {HTMLSelectElement} */ (e.target);
            this.exec('formatBlock', `<${select.value}>`);
            select.value = '';
          }}
        >
          <option value="">${t('text.block')}</option>
          <option value="p">${t('text.paragraph')}</option>
          <option value="h1">${t('text.h1')}</option>
          <option value="h2">${t('text.h2')}</option>
          <option value="h3">${t('text.h3')}</option>
        </select>
        <span class="sep"></span>
        ${this._button(html`<b>B</b>`, t('text.bold'), () => this.exec('bold'), 'bold')}
        ${this._button(html`<i>I</i>`, t('text.italic'), () => this.exec('italic'), 'italic')}
        ${this._button(html`<u>U</u>`, t('text.underline'), () => this.exec('underline'), 'underline')}
        ${this._button(html`<s>S</s>`, t('text.strike'), () => this.exec('strikeThrough'), 'strikeThrough')}
        <span class="sep"></span>
        ${this._button('🔗', t('text.link'), () => this._openLink(), 'link')}
        ${this._button(
          'A',
          t('text.color'),
          () => {
            this._linkOpen = false;
            this._colorOpen = !this._colorOpen;
          },
          'color',
        )}
        <span class="sep"></span>
        ${this._button('•', t('text.bulletList'), () => this.exec('insertUnorderedList'), 'ul')}
        ${this._button('1.', t('text.numberedList'), () => this.exec('insertOrderedList'), 'ol')}
        <span class="sep"></span>
        ${this._button('⇤', t('align.left'), () => this.exec('justifyLeft'), 'left')}
        ${this._button('↔', t('align.center'), () => this.exec('justifyCenter'), 'center')}
        ${this._button('⇥', t('align.right'), () => this.exec('justifyRight'), 'right')}
        <span class="sep"></span>
        ${this._button('⌫', t('text.clear'), () => this.exec('removeFormat'), 'clear')}
        ${
          ctx.mergeTags.length > 0
            ? html`<select
                aria-label=${t('mergeTag.insert')}
                @change=${(/** @type {Event} */ e) => {
                  const select = /** @type {HTMLSelectElement} */ (e.target);
                  const key = select.value;
                  select.value = '';
                  if (key)
                    this.exec('insertText', `${ctx.delimiters.open}${key}${ctx.delimiters.close}`);
                }}
              >
                <option value="">${t('mergeTag.insert')}</option>
                ${ctx.mergeTags.map((tag) => html`<option value=${tag.key}>${tag.label}</option>`)}
              </select>`
            : nothing
        }
        ${
          this._linkOpen
            ? html`<form class="popover" @submit=${this._applyLink}>
                <input class="link-input" type="text" inputmode="url" placeholder="https://" />
                <button type="submit">${t('text.apply')}</button>
              </form>`
            : nothing
        }
        ${
          this._colorOpen
            ? html`<div class="popover" role="group" aria-label=${t('text.color')}>
                ${TEXT_COLORS.map(
                  (color) =>
                    html`<button
                      type="button"
                      class="swatch"
                      title=${color}
                      aria-label=${color}
                      style=${styleMap({ background: color })}
                      @pointerdown=${(/** @type {Event} */ e) => e.preventDefault()}
                      @click=${() => {
                        this._colorOpen = false;
                        this.exec('foreColor', color);
                      }}
                    ></button>`,
                )}
              </div>`
            : nothing
        }
      </div>
      <div
        class="editable"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-placeholder=${t('placeholder.text')}
        style=${styleMap(style)}
        @input=${() => this._commit()}
        @keydown=${this._onKeydown}
        @beforeinput=${this._onBeforeInput}
        @paste=${this._onPaste}
        @focusout=${this._onFocusOut}
        @click=${(/** @type {Event} */ e) => {
          e.stopPropagation();
          if (e.composedPath().some((n) => n instanceof HTMLAnchorElement)) e.preventDefault();
        }}
      ></div>`;
  }
}

define('mm-text-editor', MmTextEditor);
