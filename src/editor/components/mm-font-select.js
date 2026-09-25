// フォントの選択（全体設定・テキストブロック）: 端末のフォント・登録した Web フォント・直接入力。
// Shadow DOM を使わない（設定パネルのスタイルをそのまま使うため）。変更は mm-font-change（detail: font-family の値、null は全体設定に従う）で伝える
import { LitElement, html, nothing } from 'lit';
import { SYSTEM_FONTS, fallbackOf, leadingWebFont, webFontStack } from '../web-fonts.js';
import { define } from '../context.js';

/** @import { WebFont } from '../../core/model/types.js' */
/** @import { WebFontOption } from '../web-fonts.js' */
/** @import { Translate } from '../i18n.js' */

const INHERIT = '__inherit';
const CUSTOM = '__custom';

export class MmFontSelect extends LitElement {
  static properties = {
    value: { attribute: false },
    nullable: { type: Boolean },
    webFonts: { attribute: false },
    options: { attribute: false },
    inputId: { attribute: false },
    t: { attribute: false },
    _custom: { state: true },
  };

  constructor() {
    super();
    /** @type {string | null} */
    this.value = null;
    /** null（全体設定に従う）を選べる */
    this.nullable = false;
    /** @type {readonly WebFont[]} 登録した Web フォント */
    this.webFonts = [];
    /** @type {readonly WebFontOption[]} 候補（読み込めないときのフォントに使う） */
    this.options = [];
    this.inputId = '';
    /** @type {Translate} */
    this.t = (key) => key;
    /** 「直接入力」を選んだ（端末のフォントと同じ値でも入力欄を出す） */
    this._custom = false;
  }

  createRenderRoot() {
    return this;
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    // 別の要素の設定に切り替わったら、直接入力の状態を戻す
    if (changed.has('inputId') && changed.get('inputId') !== undefined) this._custom = false;
  }

  /** 選択中の項目 */
  get selected() {
    if (this._custom) return CUSTOM;
    if (this.value === null) return this.nullable ? INHERIT : CUSTOM;
    const system = SYSTEM_FONTS.findIndex((font) => font.value === this.value);
    if (system !== -1) return `system:${system}`;
    const web = leadingWebFont(this.value, this.webFonts);
    if (web) return `web:${web.family}`;
    return CUSTOM;
  }

  /** @param {string | null} value */
  _emit(value) {
    this.dispatchEvent(new CustomEvent('mm-font-change', { detail: value, bubbles: true }));
  }

  /** @param {Event} event */
  _onSelect(event) {
    const { value } = /** @type {HTMLSelectElement} */ (event.target);
    this._custom = value === CUSTOM;
    if (value === INHERIT) this._emit(null);
    else if (value.startsWith('system:')) this._emit(SYSTEM_FONTS[Number(value.slice(7))].value);
    else if (value.startsWith('web:')) {
      const family = value.slice(4);
      // 同じ Web フォントのまま後ろのフォントを直していたら、それを残す
      const current = leadingWebFont(this.value, this.webFonts);
      const rest = current && this.value ? fallbackOf(this.value) : '';
      const stack = webFontStack(family, this.options);
      this._emit(rest && current?.family === family ? this.value : stack);
    } else if (value === CUSTOM && this.value === null) {
      this._emit('');
    }
  }

  render() {
    const { t } = this;
    const selected = this.selected;
    const web = leadingWebFont(this.value, this.webFonts);
    const fallback = web && this.value ? fallbackOf(this.value) : '';
    return html`<select
        id=${this.inputId}
        data-action="font"
        .value=${selected}
        @change=${this._onSelect}
      >
        ${
          this.nullable
            ? html`<option value=${INHERIT} ?selected=${selected === INHERIT}>
                ${t('font.inherit')}
              </option>`
            : nothing
        }
        <optgroup label=${t('font.system')}>
          ${SYSTEM_FONTS.map(
            (font, i) =>
              html`<option value=${`system:${i}`} ?selected=${selected === `system:${i}`}>
                ${t(font.labelKey)}
              </option>`,
          )}
        </optgroup>
        <optgroup label=${t('font.web')}>
          ${
            this.webFonts.length > 0
              ? this.webFonts.map(
                  (font) =>
                    html`<option
                      value=${`web:${font.family}`}
                      ?selected=${selected === `web:${font.family}`}
                    >
                      ${font.family}
                    </option>`,
                )
              : html`<option disabled>${t('font.noWebFonts')}</option>`
          }
        </optgroup>
        <option value=${CUSTOM} ?selected=${selected === CUSTOM}>${t('font.custom')}</option>
      </select>
      ${
        selected === CUSTOM
          ? html`<input
              type="text"
              data-input="font-family"
              aria-label=${t('font.customLabel')}
              placeholder=${t('font.customPlaceholder')}
              .value=${this.value ?? ''}
              @input=${(/** @type {Event} */ e) =>
                this._emit(/** @type {HTMLInputElement} */ (e.target).value)}
            />`
          : nothing
      }
      ${
        web
          ? html`<p class="help" data-help="web-font">
              ${t('font.webFontHelp', { fallback: fallback || t('font.noFallback') })}
            </p>`
          : nothing
      }`;
  }
}

define('mm-font-select', MmFontSelect);
