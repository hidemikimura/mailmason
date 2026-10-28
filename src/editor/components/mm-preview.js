// プレビュー。配信用 HTML を iframe に表示し、テキストパートの確認と手編集もここで行う。
// - 表示中のときだけ出力を作る。本文が変わったら最後の変更から 300ms 後に作り直す
// - HTML とテキストは本文（template.body）だけから決まるので、本文が同じなら作り直さない
// - iframe はスクリプト不可。高さを測るために same-origin だけ許可し、リンクは新しいタブで開く
import { LitElement, css, html, nothing } from 'lit';
import { HTML_SIZE_WARNING_BYTES, renderHtml } from '../../core/render-html/index.js';
import { usedWebFonts } from '../../core/render-html/web-fonts.js';
import { renderText } from '../../core/render-text/index.js';
import { escapeText } from '../../core/richtext/entities.js';
import { fnv1a } from '../../core/hash.js';
import { applyHunk, applyHunkToBase, diffLines } from '../../core/text-diff.js';
import { replaceMergeTags } from '../../core/merge-tags.js';
import { mergeTagValues } from '../util.js';
import { controls } from '../styles.js';
import { define } from '../context.js';
import './mm-text-input.js';

/** @import { Template } from '../../core/model/types.js' */
/** @import { EditorContext } from '../context.js' */

/** 本文が変わってから作り直すまでの待ち時間（ms） */
export const PREVIEW_DEBOUNCE_MS = 300;

/** 表示幅（px）。PC はメーラーの本文領域相当 */
export const PREVIEW_WIDTHS = Object.freeze({ desktop: 900, mobile: 375 });

/**
 * iframe 内のリンクを新しいタブで開くよう、head に base を入れる
 * @param {string} source
 */
function withBaseTarget(source) {
  const base = '<base target="_blank" />';
  return /<head[^>]*>/i.test(source)
    ? source.replace(/<head[^>]*>/i, (head) => `${head}${base}`)
    : `${base}${source}`;
}

/**
 * @typedef {Object} PreviewOutput
 * @property {Template['body']} body 作ったときの本文（同じなら作り直さない）
 * @property {string} key 作ったときのオプション
 * @property {string} html
 * @property {number} bytes
 * @property {string} text 自動生成のテキスト（サンプル値を差し込み済み）
 * @property {string} source 自動生成のテキスト（差し込み前。手編集の差分の比べる先）
 * @property {string} hash 自動生成のテキストのハッシュ（手編集の古さ判定用）
 */

/**
 * 差分の 1 行。変わった行は、行の中の違う部分に印を付ける（行ごとに要素を分け、テンプレートの空白を入れない）
 * @param {'removed' | 'added'} kind
 * @param {string} line
 * @param {import('../../core/text-diff.js').TextDiffLineChange | undefined} change
 */
function diffLine(kind, line, change) {
  if (!change) return html`<div class=${kind}>${line}</div>`;
  const part = kind === 'removed' ? change.removed : change.added;
  const mark = kind === 'removed' ? html`<del>${part}</del>` : html`<ins>${part}</ins>`;
  return html`<div class=${kind}>${change.prefix}${mark}${change.suffix}</div>`;
}

export class MmPreview extends LitElement {
  static properties = {
    template: { attribute: false },
    ctx: { attribute: false },
    active: { type: Boolean, reflect: true },
    device: { type: String, reflect: true },
    _tab: { state: true },
    _useSamples: { state: true },
    _useWebFonts: { state: true },
    _output: { state: true },
    _confirmEdit: { state: true },
  };

  static styles = [
    controls,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--mm-color-bg);
      }
      :host([hidden]) {
        display: none;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 12px;
        background: var(--mm-color-surface);
        border-bottom: 1px solid var(--mm-color-border);
        flex-wrap: wrap;
      }
      .tabs {
        display: flex;
        gap: 2px;
      }
      .tabs button {
        border-color: transparent;
        background: transparent;
        padding: 4px 12px;
      }
      .tabs button[aria-selected='true'] {
        border-color: var(--mm-color-accent);
        background: var(--mm-color-accent-soft);
      }
      .spacer {
        flex: 1;
      }
      .meta {
        color: var(--mm-color-muted);
        font-size: 12px;
      }
      .meta.warn {
        color: var(--mm-color-danger);
      }
      label.check {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        cursor: pointer;
      }
      .stage {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 24px;
        box-sizing: border-box;
      }
      .device {
        margin: 0 auto;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
      }
      :host([device='mobile']) .device {
        border: 10px solid #1f2328;
        border-radius: 28px;
        overflow: hidden;
      }
      .preheader {
        padding: 8px 12px;
        font: 12px/1.5 var(--mm-font-family);
        color: #57606a;
        background: #f6f8fa;
        border-bottom: 1px solid #e3e6ea;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      iframe {
        display: block;
        width: 100%;
        height: 480px;
        border: 0;
        background: #fff;
      }
      .text {
        max-width: 760px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .text-head {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .text-head .status {
        flex: 1;
        color: var(--mm-color-muted);
      }
      .notice {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border: 1px solid #d4a72c;
        border-radius: var(--mm-radius);
        background: #fff8c5;
        color: #4d2d00;
        line-height: 1.5;
      }
      .notice p {
        margin: 0;
        flex: 1;
      }
      .diff {
        display: grid;
        gap: 6px;
      }
      .diff-summary {
        margin: 0;
        color: var(--mm-color-muted);
      }
      .hunk {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .hunk .lines {
        flex: 1;
        min-width: 0;
        padding: 6px 10px;
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        background: var(--mm-color-surface);
        font:
          12px/1.6 ui-monospace,
          SFMono-Regular,
          Menlo,
          Consolas,
          monospace;
      }
      .hunk .lines > div {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .hunk .removed::before {
        content: '− ';
      }
      .hunk .added::before {
        content: '+ ';
      }
      .hunk .removed {
        color: #82071e;
      }
      .hunk .added {
        color: #116329;
      }
      .hunk del {
        background: #ffd7d5;
        text-decoration: none;
      }
      .hunk ins {
        background: #ccffd8;
        text-decoration: none;
      }
      pre,
      .text textarea {
        margin: 0;
        padding: 16px;
        box-sizing: border-box;
        width: 100%;
        min-height: 360px;
        background: var(--mm-color-surface);
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        font:
          13px/1.7 ui-monospace,
          SFMono-Regular,
          Menlo,
          Consolas,
          'Hiragino Kaku Gothic ProN',
          monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .text textarea {
        min-height: 480px;
        resize: vertical;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {Template} */
    this.template = /** @type {any} */ (null);
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    /** 表示中か（表示中のときだけ出力を作る） */
    this.active = false;
    /** @type {'desktop' | 'mobile'} */
    this.device = 'desktop';
    /** @type {'html' | 'text'} */
    this._tab = 'html';
    /** サンプル値を差し込んで表示するか */
    this._useSamples = true;
    /** Web フォントを読み込むか（オフで Gmail などでの見え方を確かめる） */
    this._useWebFonts = true;
    /** @type {PreviewOutput | null} */
    this._output = null;
    /** 全文編集の前の案内を出している */
    this._confirmEdit = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._timer = null;
    /** 古さの警告を通知済みか（同じ状態で何度も出さない） */
    this._staleNotified = false;
    /** @type {(() => void) | null} iframe の高さ追従の後始末 */
    this._unobserve = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cancel();
    this._unobserve?.();
    this._unobserve = null;
  }

  _cancel() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
  }

  /** 差し込みに使う値（サンプル値 → 既定値）。使わないときは null */
  _values() {
    if (!this._useSamples) return null;
    const values = mergeTagValues(this.ctx.mergeTags, 'sample');
    return Object.keys(values).length > 0 ? values : null;
  }

  /** 出力の作り方を決めるオプション（変わったらすぐ作り直す） */
  _key() {
    const { htmlOptions, locale, delimiters, textOptions } = this.ctx;
    // カスタムブロックの定義は関数を含むので type だけを比べる
    /** @param {{ blocks?: readonly { type: string }[] | null }} o */
    const comparable = (o) => ({ ...o, blocks: o.blocks?.map((def) => def.type) ?? null });
    return JSON.stringify([
      comparable(htmlOptions),
      comparable(textOptions),
      locale,
      delimiters,
      this._values(),
      this._useWebFonts,
    ]);
  }

  /** 出力を作る */
  _build() {
    this._cancel();
    const { template, ctx } = this;
    const values = this._values();
    const { textOptions } = ctx;
    // 差し込み前の自動生成（手編集の古さの判定と差分に使う。core の textSourceHash と同じ）
    const source = renderText(template, { ...textOptions, mergeValues: null });
    let output;
    try {
      output = renderHtml(template, {
        ...ctx.htmlOptions,
        mergeValues: values,
        webFonts: this._useWebFonts,
      });
    } catch (error) {
      // カスタムブロックの renderHtml の例外などでプレビューを止めない
      console.error('[mailmason] プレビューを作れませんでした', error);
      output = `<p style="font-family:sans-serif;color:#b91c1c;padding:16px">${escapeText(String(error))}</p>`;
    }
    this._output = {
      body: template.body,
      key: this._key(),
      html: output,
      bytes: new TextEncoder().encode(output).length,
      text: renderText(template, { ...textOptions, mergeValues: values }),
      source,
      hash: fnv1a(source),
    };
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (!this.active || !this.template || !this.ctx) {
      this._cancel();
      return;
    }
    const output = this._output;
    const key = this._key();
    if (!output || output.key !== key || changed.has('active')) {
      // 表示し始めたとき・オプションが変わったときはすぐ作る
      if (!output || output.key !== key || output.body !== this.template.body) this._build();
    } else if (output.body !== this.template.body) {
      // 編集中は最後の変更から少し待つ
      this._cancel();
      this._timer = setTimeout(() => {
        this._timer = null;
        if (this.isConnected && this.active) this._build();
      }, PREVIEW_DEBOUNCE_MS);
    }
  }

  updated() {
    if (!this.active) return;
    const stale = this._isStale();
    if (stale && !this._staleNotified) {
      this.dispatchEvent(
        new CustomEvent('mm-warning', {
          detail: {
            code: 'stale-text',
            path: 'text',
            message: 'The manual text part was edited before the latest HTML changes.',
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
    this._staleNotified = stale;
  }

  /** 手編集のテキストが、今の本文より古いか */
  _isStale() {
    const { text } = this.template ?? {};
    if (!text || text.mode !== 'manual' || text.content === null || !this._output) return false;
    return text.sourceHash !== this._output.hash;
  }

  // ---- iframe ---------------------------------------------------------------

  /** @param {Event} event */
  _onFrameLoad(event) {
    const frame = /** @type {HTMLIFrameElement} */ (event.target);
    this._unobserve?.();
    this._unobserve = null;
    const doc = frame.contentDocument;
    if (!doc) return;
    const fit = () => {
      const height = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      if (height) frame.style.height = `${height}px`;
    };
    fit();
    // 画像の読み込みなどで高さが変わったら追従する
    const onLoad = () => fit();
    doc.addEventListener('load', onLoad, true);
    /** @type {ResizeObserver | null} */
    let observer = null;
    if (typeof ResizeObserver === 'function' && doc.body) {
      observer = new ResizeObserver(fit);
      observer.observe(doc.body);
    }
    this._unobserve = () => {
      doc.removeEventListener('load', onLoad, true);
      observer?.disconnect();
    };
  }

  // ---- テキストパート -------------------------------------------------------

  /** 「編集する」。全文編集は本文と切れるので、先に部品ごとの設定を案内する（textEditConfirm） */
  _requestEditing() {
    if (this.ctx.textEditConfirm) this._confirmEdit = true;
    else this._startEditing();
  }

  /** 自動生成のテキストを元に手編集を始める */
  _startEditing() {
    const { template, ctx } = this;
    this._confirmEdit = false;
    // 保存するのは差し込み前のテキスト（マージタグのまま）。差分を見せるため、始めた時点の自動生成も残す
    const source = renderText(template, { ...ctx.textOptions, mergeValues: null });
    ctx.store.dispatch({
      type: 'setTextPart',
      content: source,
      sourceHash: fnv1a(source),
      sourceText: source,
    });
  }

  /** @param {CustomEvent<{ value: string }>} event */
  _onTextInput(event) {
    const { value } = event.detail;
    this.ctx.store.dispatch({ type: 'setTextPart', content: value, mergeKey: 'text-part' });
  }

  _resetText() {
    this.ctx.store.dispatch({ type: 'resetTextPart' });
  }

  /** 今の本文を確認したことにして、古さの警告と差分を消す */
  _acknowledge() {
    const { template, ctx } = this;
    const output = /** @type {PreviewOutput} */ (this._output);
    ctx.store.dispatch({
      type: 'setTextPart',
      content: template.text.content ?? '',
      sourceHash: output.hash,
      sourceText: output.source,
    });
  }

  /**
   * 本文の変更を 1 つ、手編集の文に取り込む。差分の比べる元（sourceText）にも同じ変更を当て、
   * 全部取り込むと古さの警告も消える
   * @param {import('../../core/text-diff.js').TextDiffHunk} hunk
   * @param {string} content 取り込んだ後の手編集の文
   */
  _importHunk(hunk, content) {
    const { template, ctx } = this;
    const output = /** @type {PreviewOutput} */ (this._output);
    const sourceText = applyHunkToBase(template.text.sourceText ?? '', hunk);
    ctx.store.dispatch({
      type: 'setTextPart',
      content,
      sourceText,
      sourceHash: sourceText === output.source ? output.hash : template.text.sourceHash,
    });
  }

  /**
   * 手編集を始めてからの本文の変更（sourceText が無い古いテンプレートでは出さない）
   * @param {Template['text']} text
   */
  _renderDiff(text) {
    const { t } = this.ctx;
    const output = /** @type {PreviewOutput} */ (this._output);
    if (text.sourceText === undefined) return nothing;
    const diff = diffLines(text.sourceText, output.source);
    if (diff.hunks.length === 0) return nothing;
    return html`<div class="diff">
      <p class="diff-summary">
        ${t('preview.diffSummary', { added: diff.added, removed: diff.removed })}
      </p>
      ${diff.hunks.map((hunk) => {
        const applied = applyHunk(
          text.content ?? '',
          hunk,
          /** @type {string} */ (text.sourceText),
        );
        return html`<div class="hunk">
          <div class="lines">
            ${hunk.removed.map((line, i) => diffLine('removed', line, hunk.changes[i]))}
            ${hunk.added.map((line, i) => diffLine('added', line, hunk.changes[i]))}
          </div>
          <button
            type="button"
            data-action="import-hunk"
            ?disabled=${applied === null}
            title=${applied === null ? t('preview.diffNotFound') : ''}
            @click=${() => applied !== null && this._importHunk(hunk, applied)}
          >
            ${t('preview.diffImport')}
          </button>
        </div>`;
      })}
    </div>`;
  }

  // ---- 描画 -----------------------------------------------------------------

  _renderHtmlTab() {
    const output = /** @type {PreviewOutput} */ (this._output);
    const { t } = this.ctx;
    const settings = this.template.body.settings;
    const values = this._values();
    const preheader = values
      ? replaceMergeTags(settings.preheader, values, { delimiters: this.ctx.delimiters })
      : settings.preheader;
    return html`<div class="stage">
      <div class="device" style=${`width:${PREVIEW_WIDTHS[this.device]}px`}>
        ${
          preheader
            ? html`<div class="preheader" title=${t('preview.preheader')}>
                ${t('preview.preheader')}: ${preheader}
              </div>`
            : nothing
        }
        <iframe
          title=${t('preview.frame')}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          .srcdoc=${withBaseTarget(output.html)}
          @load=${this._onFrameLoad}
        ></iframe>
      </div>
    </div>`;
  }

  _renderTextTab() {
    const { t } = this.ctx;
    const { text } = this.template;
    const output = /** @type {PreviewOutput} */ (this._output);
    const manual = text.mode === 'manual' && text.content !== null;
    return html`<div class="stage">
      <div class="text">
        <div class="text-head">
          <span class="status">${t(manual ? 'preview.textManual' : 'preview.textAuto')}</span>
          ${
            manual
              ? html`<button type="button" data-action="reset-text" @click=${this._resetText}>
                  ${t('preview.resetText')}
                </button>`
              : html`<button
                  type="button"
                  data-action="edit-text"
                  ?disabled=${this._confirmEdit}
                  @click=${this._requestEditing}
                >
                  ${t('preview.editText')}
                </button>`
          }
        </div>
        ${
          !manual && this._confirmEdit
            ? html`<div
                class="notice confirm"
                role="alertdialog"
                aria-label=${t('preview.editText')}
              >
                <p>${t('preview.editConfirm')}</p>
                <button type="button" data-action="confirm-edit-text" @click=${this._startEditing}>
                  ${t('preview.editConfirmOk')}
                </button>
                <button
                  type="button"
                  data-action="cancel-edit-text"
                  @click=${() => (this._confirmEdit = false)}
                >
                  ${t('preview.editCancel')}
                </button>
              </div>`
            : nothing
        }
        ${
          manual && this._isStale()
            ? html`<div class="notice" role="alert">
                  <p>${t('preview.stale')}</p>
                  <button type="button" data-action="acknowledge" @click=${this._acknowledge}>
                    ${t('preview.acknowledge')}
                  </button>
                </div>
                ${this._renderDiff(text)}`
            : nothing
        }
        ${
          manual
            ? html`<mm-text-input
                multiline
                display-labels
                spellcheck="false"
                aria-label=${t('preview.textLabel')}
                .value=${text.content ?? ''}
                .tags=${this.ctx.mergeTags}
                .delimiters=${this.ctx.delimiters}
                .mergeTagTrigger=${this.ctx.mergeTagTrigger}
                .t=${t}
                @mm-value-input=${this._onTextInput}
              ></mm-text-input>`
            : html`<pre aria-label=${t('preview.textLabel')}>
${output.text || t('preview.empty')}</pre>`
        }
      </div>
    </div>`;
  }

  render() {
    const { ctx } = this;
    if (!this.active || !ctx || !this.template || !this._output) return nothing;
    const { t } = ctx;
    const output = this._output;
    const hasSamples = Object.keys(mergeTagValues(ctx.mergeTags, 'sample')).length > 0;
    const hasWebFonts = usedWebFonts(this.template).length > 0;
    const tooBig = output.bytes > HTML_SIZE_WARNING_BYTES;
    const tab = (/** @type {'html' | 'text'} */ name) =>
      html`<button
        type="button"
        role="tab"
        data-tab=${name}
        aria-selected=${this._tab === name ? 'true' : 'false'}
        @click=${() => (this._tab = name)}
      >
        ${t(`preview.${name}`)}
      </button>`;

    return html`<div class="bar">
        <div class="tabs" role="tablist" aria-label=${t('preview.tabs')}>
          ${tab('html')} ${tab('text')}
        </div>
        <span class="spacer"></span>
        ${
          hasSamples
            ? html`<label class="check">
                <input
                  type="checkbox"
                  data-action="samples"
                  .checked=${this._useSamples}
                  @change=${(/** @type {Event} */ e) =>
                    (this._useSamples = /** @type {HTMLInputElement} */ (e.target).checked)}
                />
                ${t('preview.samples')}
              </label>`
            : nothing
        }
        ${
          hasWebFonts
            ? html`<label class="check" title=${t('preview.webFontsHelp')}>
                <input
                  type="checkbox"
                  data-action="web-fonts"
                  .checked=${this._useWebFonts}
                  @change=${(/** @type {Event} */ e) =>
                    (this._useWebFonts = /** @type {HTMLInputElement} */ (e.target).checked)}
                />
                ${t('preview.webFonts')}
              </label>`
            : nothing
        }
        <span
          class=${tooBig ? 'meta warn' : 'meta'}
          title=${tooBig ? t('preview.sizeWarning') : ''}
          data-size
        >
          ${t('preview.size', { size: (output.bytes / 1024).toFixed(1) })}
        </span>
      </div>
      ${this._tab === 'html' ? this._renderHtmlTab() : this._renderTextTab()}`;
  }
}

define('mm-preview', MmPreview);
