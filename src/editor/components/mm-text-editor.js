// キャンバス上でテキストを直接編集する部品。
// - 入力のたびに許可タグへ整えてストアに反映する（mergeKey で 1 つの履歴にまとめる）
// - 書式は document.execCommand で付け、結果の揺れは正規化器（sanitizeHtml）で吸収する
// - 自分が出した値以外（Undo など）が来たときだけ中身を置き換え、入力中のキャレットを動かさない
// - inline モード（表のセル）: 段落・見出し・リスト・揃えを使わず、Enter は改行、Tab はセルの移動
// - 区切り開始文字（`{{` など）を入力すると差し込み変数の候補を出す（ctx.mergeTagTrigger）
import { LitElement, css, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { sanitizeHtml, sanitizeInlineHtml } from '../../core/richtext/sanitize.js';
import { escapeText } from '../../core/richtext/entities.js';
import { isComposing, patchAt } from '../util.js';
import { findLink, getRangeIn, placeCaretAtEnd, restoreRange } from '../richtext/selection.js';
import { clearHighlights, highlightMergeTags } from '../richtext/highlight.js';
import { controls } from '../styles.js';
import { findMergeTagTrigger, mergeTagText } from '../merge-tag-search.js';
import './mm-merge-tag-list.js';
import './mm-merge-tag-picker.js';
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
    inline: { type: Boolean, reflect: true },
    makePatch: { attribute: false },
    placeholder: { attribute: false },
    _linkOpen: { state: true },
    _linkValue: { state: true },
    _colorOpen: { state: true },
    _suggest: { state: true },
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
      .suggest {
        position: absolute;
        z-index: 6;
        width: 260px;
        background: var(--mm-color-surface);
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: var(--mm-font-family);
        font-size: var(--mm-font-size);
        line-height: normal;
        text-align: left;
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
    /** 段落を持たないテキスト（表のセル）として編集する */
    this.inline = false;
    /** @type {((html: string) => Record<string, unknown>) | null} 値からパッチを作る（省略時は field のパス） */
    this.makePatch = null;
    /** @type {string | null} 空のときの表示（省略時は「テキストが空です」） */
    this.placeholder = null;
    this._linkOpen = false;
    /** リンク入力欄の初期値（選択範囲に既存のリンクがあればその URL） */
    this._linkValue = '';
    /** @type {HTMLAnchorElement | null} 入力欄を開いたときに選択範囲にかかっていたリンク */
    this._linkTarget = null;
    this._colorOpen = false;
    /**
     * 入力中の差し込み変数（区切り開始文字の位置から、キャレットまで）と候補の表示位置
     * @type {{ node: Text, start: number, end: number, query: string, top: number, left: number } | null}
     */
    this._suggest = null;
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
    // 候補を出している間にキャレットが動いたら、入力中の範囲から出たか確かめる
    if (this._suggest) this._detectSuggest();
  }

  /** キャレットの前を見て、入力中の差し込み変数の候補を出す・閉じる */
  _detectSuggest() {
    const { ctx } = this;
    const range = getRangeIn(/** @type {ShadowRoot} */ (this.renderRoot));
    const node = range?.startContainer;
    if (
      !ctx.mergeTagTrigger ||
      ctx.mergeTags.length === 0 ||
      !range ||
      !range.collapsed ||
      !(node instanceof Text) ||
      !this.editable.contains(node)
    ) {
      this._suggest = null;
      return;
    }
    const found = findMergeTagTrigger(node.data.slice(0, range.startOffset), ctx.delimiters);
    if (!found) {
      this._suggest = null;
      return;
    }
    // 候補は区切り開始文字の下に出す
    const marker = document.createRange();
    marker.setStart(node, found.start);
    marker.setEnd(node, Math.min(node.length, found.start + ctx.delimiters.open.length));
    const rect = marker.getBoundingClientRect();
    const host = this.getBoundingClientRect();
    this._suggest = {
      node,
      start: found.start,
      end: range.startOffset,
      query: found.query,
      top: rect.bottom - host.top + 4,
      left: Math.max(0, rect.left - host.left),
    };
  }

  /**
   * 入力中の差し込み変数を、選んだマージタグに置き換える
   * @param {string} key
   */
  _insertSuggestion(key) {
    const suggest = this._suggest;
    this._suggest = null;
    if (!suggest || !suggest.node.isConnected) return;
    const range = document.createRange();
    range.setStart(suggest.node, suggest.start);
    range.setEnd(suggest.node, Math.min(suggest.node.length, suggest.end));
    this.editable.focus();
    restoreRange(range);
    document.execCommand('insertText', false, mergeTagText(key, this.ctx.delimiters));
    this._suggest = null;
    this._captureSelection();
    this._commit();
  }

  /** @returns {import('./mm-merge-tag-list.js').MmMergeTagList | null} */
  get suggestList() {
    return this.renderRoot.querySelector('.suggest mm-merge-tag-list');
  }

  _onInput() {
    this._commit();
    this._detectSuggest();
  }

  /** @param {string} html */
  _sanitize(html) {
    const options = { delimiters: this.ctx.delimiters };
    return this.inline ? sanitizeInlineHtml(html, options) : sanitizeHtml(html, options);
  }

  /** 入力内容を整えてストアに送る */
  _commit() {
    const clean = this._sanitize(this.editable.innerHTML);
    highlightMergeTags(this, this.editable, this.ctx.delimiters);
    if (clean === this._lastHtml) return;
    this._lastHtml = clean;
    this.ctx.store.dispatch({
      type: 'updateBlockValues',
      blockId: this.blockId,
      patch: this.makePatch ? this.makePatch(clean) : patchAt(this.field, clean),
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
    // 日本語入力の変換中（確定の Enter・取り消しの Esc を含む）は、ショートカットや候補の操作をしない
    if (isComposing(event)) {
      event.stopPropagation();
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    // 差し込み変数の候補を出しているときは、上下キー・Enter・Tab・Esc で候補を操作する
    if (this._suggest && !mod) {
      const list = this.suggestList;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        list?.moveActive(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (list?.pickActive()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        this._suggest = null;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this._suggest = null;
        return;
      }
    }
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
    if (this.inline && event.key === 'Tab' && !mod && !event.altKey) {
      // 表のセルの移動は親（mm-table-editor）に任せる
      event.preventDefault();
      event.stopPropagation();
      this._commit();
      this.dispatchEvent(
        new CustomEvent('mm-cell-nav', {
          detail: { direction: event.shiftKey ? -1 : 1 },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    if (this.inline && event.key === 'Enter' && !mod) {
      // 段落を作らず改行にする
      event.preventDefault();
      event.stopPropagation();
      document.execCommand('insertLineBreak');
      this._commit();
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
    const clean = this.inline
      ? html
        ? this._sanitize(html)
        : escapeText(text.replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>')
      : html
        ? sanitizeHtml(html, { delimiters: this.ctx.delimiters })
        : textToHtml(text);
    if (clean) document.execCommand('insertHTML', false, clean);
    this._commit();
  }

  /** @param {FocusEvent} event */
  _onFocusOut(event) {
    const next = /** @type {Node | null} */ (event.relatedTarget);
    // ツールバー（同じ Shadow DOM 内）へ移るときは編集を続ける
    if (next && (this.renderRoot.contains(next) || this.contains(next))) return;
    this._suggest = null;
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
    const range = this._savedRange;
    const link = range ? findLink(range, this.editable) : null;
    this._linkTarget = link;
    this._linkValue = link?.getAttribute('href') ?? '';
    this._colorOpen = false;
    this._linkOpen = true;
    this.updateComplete.then(() => {
      const input = /** @type {HTMLInputElement | null} */ (
        this.renderRoot.querySelector('.link-input')
      );
      if (!input) return;
      input.value = this._linkValue; // 開き直したときも前回の入力ではなく今のリンクを出す
      input.focus();
      input.select();
    });
  }

  /** @param {Event} event */
  _applyLink(event) {
    event.preventDefault();
    const input = /** @type {HTMLInputElement} */ (this.renderRoot.querySelector('.link-input'));
    const url = input.value.trim();
    this._linkOpen = false;
    const link = this._linkTarget;
    this._linkTarget = null;
    // 選択（キャレットだけの場合も）が 1 つのリンクの中に収まっているときは、リンク全体を対象にする
    // （createLink は選択が無いと URL の文字を挿入し、一部だけ選ぶとリンクが分かれてしまう）
    const range = this._savedRange;
    if (link?.isConnected && range && link.contains(range.commonAncestorContainer)) {
      const whole = document.createRange();
      whole.selectNodeContents(link);
      this._savedRange = whole;
      restoreRange(whole);
    }
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

    const blockTools = this.inline
      ? nothing
      : html`<select
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
          <span class="sep"></span>`;
    const paragraphTools = this.inline
      ? nothing
      : html`${this._button('•', t('text.bulletList'), () => this.exec('insertUnorderedList'), 'ul')}
          ${this._button('1.', t('text.numberedList'), () => this.exec('insertOrderedList'), 'ol')}
          <span class="sep"></span>
          ${this._button('⇤', t('align.left'), () => this.exec('justifyLeft'), 'left')}
          ${this._button('↔', t('align.center'), () => this.exec('justifyCenter'), 'center')}
          ${this._button('⇥', t('align.right'), () => this.exec('justifyRight'), 'right')}
          <span class="sep"></span>`;

    return html`<div class="toolbar" role="toolbar" aria-label=${t('text.toolbar')}>
        ${blockTools}
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
        ${paragraphTools}
        ${this._button('⌫', t('text.clear'), () => this.exec('removeFormat'), 'clear')}
        ${
          ctx.mergeTags.length > 0
            ? html`<mm-merge-tag-picker
                align="right"
                .tags=${ctx.mergeTags}
                .delimiters=${ctx.delimiters}
                .t=${t}
                @mm-merge-tag-open=${() => {
                  this._linkOpen = false;
                  this._colorOpen = false;
                  this._suggest = null;
                }}
                @mm-merge-tag-pick=${(/** @type {CustomEvent<{ key: string }>} */ e) => {
                  e.stopPropagation();
                  this.exec('insertText', mergeTagText(e.detail.key, ctx.delimiters));
                }}
              ></mm-merge-tag-picker>`
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
        data-placeholder=${this.placeholder ?? t('placeholder.text')}
        style=${styleMap(style)}
        @input=${this._onInput}
        @keydown=${this._onKeydown}
        @beforeinput=${this._onBeforeInput}
        @paste=${this._onPaste}
        @focusout=${this._onFocusOut}
        @click=${(/** @type {Event} */ e) => {
          e.stopPropagation();
          if (e.composedPath().some((n) => n instanceof HTMLAnchorElement)) e.preventDefault();
        }}
      ></div>
      ${
        this._suggest
          ? html`<div
              class="suggest"
              style=${styleMap({ top: `${this._suggest.top}px`, left: `${this._suggest.left}px` })}
              @mm-merge-tag-pick=${(/** @type {CustomEvent<{ key: string }>} */ e) => {
                e.stopPropagation();
                this._insertSuggestion(e.detail.key);
              }}
            >
              <mm-merge-tag-list
                .tags=${ctx.mergeTags}
                .query=${this._suggest.query}
                .delimiters=${ctx.delimiters}
                .t=${t}
              ></mm-merge-tag-list>
            </div>`
          : nothing
      }`;
  }
}

define('mm-text-editor', MmTextEditor);
