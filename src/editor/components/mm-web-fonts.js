// 全体設定の「Web フォント」: このメールで読み込む Web フォントの一覧と、候補・URL からの追加。
// Shadow DOM を使わない（設定パネルのスタイルをそのまま使うため）。変更は mm-web-fonts-change（detail: 新しい一覧）で伝える
import { LitElement, html, nothing } from 'lit';
import { labelText } from '../../core/blocks/custom.js';
import { isWebFontUrl, quoteFamily } from '../web-fonts.js';
import { define } from '../context.js';

/** @import { WebFont } from '../../core/model/types.js' */
/** @import { WebFontOption } from '../web-fonts.js' */
/** @import { Translate } from '../i18n.js' */

const CUSTOM = '__custom';

export class MmWebFonts extends LitElement {
  static properties = {
    value: { attribute: false },
    options: { attribute: false },
    inputId: { attribute: false },
    t: { attribute: false },
    locale: { attribute: false },
    _custom: { state: true },
    _error: { state: true },
  };

  constructor() {
    super();
    /** @type {readonly WebFont[]} */
    this.value = [];
    /** @type {readonly WebFontOption[]} */
    this.options = [];
    this.inputId = '';
    /** @type {Translate} */
    this.t = (key) => key;
    this.locale = 'ja';
    /** URL を指定して追加する欄を開いているか */
    this._custom = false;
    /** @type {string | null} */
    this._error = null;
  }

  createRenderRoot() {
    return this;
  }

  /** @param {WebFont[]} next */
  _emit(next) {
    this.dispatchEvent(new CustomEvent('mm-web-fonts-change', { detail: next, bubbles: true }));
  }

  /** @param {WebFont} font */
  _add(font) {
    const family = font.family.trim();
    const exists = this.value.some((f) => f.family.trim().toLowerCase() === family.toLowerCase());
    if (exists) return;
    this._emit([...this.value, { family, url: font.url }]);
  }

  /** @param {Event} event */
  _onSelect(event) {
    const select = /** @type {HTMLSelectElement} */ (event.target);
    const { value } = select;
    select.value = '';
    if (value === CUSTOM) {
      this._custom = true;
      this._error = null;
      this.updateComplete.then(() =>
        /** @type {HTMLInputElement | null} */ (
          this.querySelector('[data-input="family"]')
        )?.focus(),
      );
      return;
    }
    const option = this.options[Number(value)];
    if (option) this._add(option);
  }

  _addCustom() {
    const family = /** @type {HTMLInputElement} */ (this.querySelector('[data-input="family"]'));
    const url = /** @type {HTMLInputElement} */ (this.querySelector('[data-input="url"]'));
    const name = family.value.trim();
    const href = url.value.trim();
    if (!name) {
      this._error = this.t('webFont.errorFamily');
      return;
    }
    if (!isWebFontUrl(href)) {
      this._error = this.t('webFont.errorUrl');
      return;
    }
    if (this.value.some((f) => f.family.trim().toLowerCase() === name.toLowerCase())) {
      this._error = this.t('webFont.errorDuplicate');
      return;
    }
    this._add({ family: name, url: href });
    this._custom = false;
    this._error = null;
  }

  render() {
    const { t } = this;
    const registered = new Set(this.value.map((f) => f.family.trim().toLowerCase()));
    /** @type {Map<string, Array<[number, WebFontOption]>>} */
    const groups = new Map();
    this.options.forEach((option, i) => {
      if (registered.has(option.family.toLowerCase())) return;
      const group = option.group ? labelText(option.group, this.locale) : t('webFont.otherGroup');
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)?.push([i, option]);
    });
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        this._addCustom();
      }
    };

    return html`<div class="web-fonts">
      ${
        this.value.length > 0
          ? html`<ul class="web-font-list">
              ${this.value.map(
                (font, i) =>
                  html`<li class="web-font" data-family=${font.family}>
                    <span
                      class="web-font-name"
                      style="font-family:${quoteFamily(font.family)}, sans-serif"
                      >${font.family}</span
                    >
                    <span class="web-font-url" title=${font.url}>${hostOf(font.url)}</span>
                    <button
                      type="button"
                      class="icon-button"
                      data-action="remove-web-font"
                      title=${t('webFont.remove', { family: font.family })}
                      aria-label=${t('webFont.remove', { family: font.family })}
                      @click=${() => this._emit(this.value.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </li>`,
              )}
            </ul>`
          : nothing
      }
      <select id=${this.inputId} data-action="add-web-font" @change=${this._onSelect}>
        <option value="">${t('webFont.add')}</option>
        ${[...groups].map(
          ([group, items]) =>
            html`<optgroup label=${group}>
              ${items.map(([i, option]) => html`<option value=${String(i)}>${option.family}</option>`)}
            </optgroup>`,
        )}
        <option value=${CUSTOM}>${t('webFont.custom')}</option>
      </select>
      ${
        this._custom
          ? html`<div class="web-font-custom">
              <input
                type="text"
                data-input="family"
                placeholder=${t('webFont.familyPlaceholder')}
                aria-label=${t('webFont.family')}
                @keydown=${onKey}
              />
              <input
                type="url"
                data-input="url"
                placeholder="https://"
                aria-label=${t('webFont.url')}
                @keydown=${onKey}
              />
              <div class="web-font-custom-actions">
                <button type="button" data-action="add-custom-web-font" @click=${this._addCustom}>
                  ${t('webFont.addCustom')}
                </button>
                <button
                  type="button"
                  @click=${() => {
                    this._custom = false;
                    this._error = null;
                  }}
                >
                  ${t('webFont.cancel')}
                </button>
              </div>
              ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
            </div>`
          : nothing
      }
    </div>`;
  }
}

/** @param {string} url */
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

define('mm-web-fonts', MmWebFonts);
