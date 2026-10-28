// 設定パネルの「テキストパート」（部品・行ごとの扱い）。使うときだけ読み込む（lazy.js）。
// テキストパートは HTML を表示しないメールソフト向けの文字だけの版。
// Shadow DOM を使わない（設定パネルの欄・切り替えボタンのスタイルをそのまま使うため）。
// core の書き出し（render-text）は直接 import せず ctx.blockText を使う。import すると、バンドラーが本体の
// 共通のコードを別ファイルに分けてしまい、最初に読み込むファイルが増える
import { LitElement, css, html, nothing } from 'lit';
import { getBlockDef } from '../../core/blocks/registry.js';
import { AUTO_TEXT_REF, blockRefs, fillRefs } from '../../core/text-override.js';
import { adoptStyles } from '../styles.js';
import { define } from '../context.js';
import './mm-text-input.js';

/** @import { Block, Row } from '../../core/model/types.js' */
/** @import { EditorContext } from '../context.js' */

const styles = css`
  /* 4 つの選択肢を設定パネルの幅に収める（パネルの .segmented button より詳細度を上げる） */
  mm-text-part-settings .segmented button {
    padding-inline: 4px;
    font-size: 12px;
    white-space: nowrap;
  }
  :where(mm-text-part-settings .text-preview .hint) {
    display: block;
    margin-bottom: 2px;
    font-size: 11px;
    color: var(--mm-color-muted);
  }
  :where(mm-text-part-settings .text-preview pre) {
    margin: 0;
    padding: 6px 8px;
    max-height: 120px;
    overflow: auto;
    border-radius: var(--mm-radius);
    background: var(--mm-color-surface-2);
    font:
      11px/1.5 ui-monospace,
      SFMono-Regular,
      Menlo,
      Consolas,
      monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  :where(mm-text-part-settings .refs) {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  :where(mm-text-part-settings .refs button) {
    padding: 0 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
  }
  :where(mm-text-part-settings .stale) {
    padding: 6px 8px;
    margin-bottom: 8px;
    border: 1px solid #d4a72c;
    border-radius: var(--mm-radius);
    background: #fff8c5;
    color: #4d2d00;
    font-size: 12px;
  }
  :where(mm-text-part-settings .stale p) {
    margin: 0 0 6px;
  }
  :where(mm-text-part-settings .warning) {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--mm-color-danger);
  }
`;

const BLOCK_MODES = ['auto', 'hidden', 'only', 'custom'];
const ROW_MODES = ['auto', 'hidden'];

export class MmTextPartSettings extends LitElement {
  static properties = {
    element: { attribute: false },
    kind: { type: String },
    ctx: { attribute: false },
  };

  constructor() {
    super();
    /** @type {Block | Row} */
    this.element = /** @type {any} */ (null);
    /** @type {'block' | 'row'} */
    this.kind = 'block';
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    adoptStyles(this.getRootNode(), styles);
  }

  get _block() {
    return this.kind === 'block' ? /** @type {Block} */ (this.element) : null;
  }

  /**
   * @param {{ mode: string, content?: string, sourceHash?: string } | null} text
   * @param {string} [mergeKey]
   */
  _set(text, mergeKey) {
    this.ctx.store.dispatch({ type: 'setElementText', id: this.element.id, text, mergeKey });
  }

  /** @param {string} mode */
  _setMode(mode) {
    const block = this._block;
    if (mode !== 'custom' || !block) {
      this._set({ mode });
      return;
    }
    if (block.text?.mode === 'custom') return;
    // 指定の文は、自動生成の参照から始める（本文と連動したまま、前後に文を足せる）
    this._set({
      mode,
      content: `{@${AUTO_TEXT_REF}}`,
      sourceHash: this.ctx.blockText.sourceHash(block),
    });
  }

  /** @param {string} content */
  _setContent(content) {
    const block = /** @type {Block} */ (this._block);
    const { sourceHash } = block.text ?? {};
    this._set({ mode: 'custom', content, sourceHash }, `${block.id}:text.content`);
  }

  /** 今の本文を確認したことにして、古さの印を消す */
  _acknowledge() {
    const block = /** @type {Block} */ (this._block);
    this._set({
      mode: 'custom',
      content: block.text?.content ?? '',
      sourceHash: this.ctx.blockText.sourceHash(block),
    });
  }

  /** @param {string} name */
  _insertRef(name) {
    const input = /** @type {import('./mm-text-input.js').MmTextInput | null} */ (
      this.querySelector('mm-text-input')
    );
    input?.insertText(`{@${name}}`);
  }

  /** @param {Block} block */
  _renderCustom(block) {
    const { ctx } = this;
    const { t } = ctx;
    const def = getBlockDef(block.type, ctx.blocks);
    const names = [AUTO_TEXT_REF, ...Object.keys(def ? blockRefs(block, def) : {})];
    const content = block.text?.content ?? '';
    const unknown = def ? fillRefs(content, blockRefs(block, def), () => '').unknown : [];
    const id = `mm-${block.id}-text-content`;
    return html`<div class="field" data-key="content">
      <label for=${id}>${t('textPart.content')}</label>
      ${
        ctx.blockText.isStale(block)
          ? html`<div class="stale" role="alert">
              <p>${t('textPart.stale')}</p>
              <button type="button" data-action="acknowledge-text" @click=${this._acknowledge}>
                ${t('preview.acknowledge')}
              </button>
            </div>`
          : nothing
      }
      <mm-text-input
        multiline
        display-labels
        .rows=${3}
        .inputId=${id}
        .value=${content}
        .tags=${ctx.mergeTags}
        .delimiters=${ctx.delimiters}
        .mergeTagTrigger=${ctx.mergeTagTrigger}
        .t=${t}
        @mm-value-input=${(/** @type {CustomEvent<{ value: string }>} */ e) =>
          this._setContent(e.detail.value)}
      ></mm-text-input>
      <div class="refs" role="group" aria-label=${t('textPart.refs')}>
        ${names.map(
          (name) =>
            html`<button type="button" data-ref=${name} @click=${() => this._insertRef(name)}>
              {@${name}}
            </button>`,
        )}
      </div>
      <p class="help">${t('textPart.contentHelp')}</p>
      ${
        unknown.length > 0
          ? html`<p class="warning" role="status">
              ${t('textPart.unknownRef', { names: unknown.map((n) => `{@${n}}`).join(' ') })}
            </p>`
          : nothing
      }
    </div>`;
  }

  render() {
    const { element, ctx } = this;
    if (!element || !ctx) return nothing;
    const { t } = ctx;
    const block = this._block;
    const mode = element.text?.mode ?? 'auto';
    const modes = block ? BLOCK_MODES : ROW_MODES;
    return html`<div class="field" data-key="mode">
        <label>${t('field.textPart')}</label>
        <div class="segmented" role="group">
          ${modes.map(
            (value) =>
              html`<button
                type="button"
                aria-pressed=${value === mode ? 'true' : 'false'}
                @click=${() => this._setMode(value)}
              >
                ${t(!block && value === 'hidden' ? 'textPart.hiddenRow' : `textPart.${value}`)}
              </button>`,
          )}
        </div>
        <p class="help">${t(block ? 'field.textPartHelp' : 'field.rowTextPartHelp')}</p>
      </div>
      ${block && mode === 'custom' ? this._renderCustom(block) : nothing}
      ${
        block && mode !== 'hidden'
          ? html`<div class="text-preview">
              <span class="hint">${t('textPart.preview')}</span>
              <pre>${ctx.blockText.render(block) || t('textPart.empty')}</pre>
            </div>`
          : nothing
      }`;
  }
}

define('mm-text-part-settings', MmTextPartSettings);
