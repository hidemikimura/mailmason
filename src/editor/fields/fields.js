// 設定パネルの入力部品。FieldSpec から汎用に描画する（ブロックを増やしても部品は増やさない）
import { html, nothing } from 'lit';
import { ROW_LAYOUT_NAMES, getLayoutSpans } from '../../core/model/layout.js';
import { SOCIAL_SERVICES, socialLabel } from '../../core/blocks/social.js';
import { sanitizeHtml } from '../../core/richtext/sanitize.js';
import { getIn, measureImage } from '../util.js';
import { UPLOAD_TYPES, hasFiles } from '../upload.js';

/** @import { TemplateResult } from 'lit' */
/** @import { Translate } from '../i18n.js' */
/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */
/** @import { UploadState } from '../upload.js' */

/**
 * @typedef {{ value: string | null, labelKey: string }} Choice
 */

/**
 * @typedef {Object} FieldSpec
 * @property {string} key values 内のパス（ドット区切り可）
 * @property {'text' | 'textarea' | 'richtext' | 'rawhtml' | 'url' | 'number' | 'color' | 'select' | 'align' | 'spacing' | 'toggle' | 'image' | 'imageWidth' | 'socialItems' | 'layout'} kind
 * @property {string} labelKey
 * @property {string} [helpKey]
 * @property {{ min?: number, max?: number, step?: number, unit?: string, nullable?: boolean, choices?: Choice[], mergeTags?: boolean, on?: unknown, off?: unknown, placeholderKey?: string }} [options]
 * @property {(values: any) => boolean} [visible] 条件付きで表示する
 */

/**
 * @typedef {{ key: string, label: string, sample?: string, fallback?: string }} MergeTag
 */

/**
 * @typedef {(context: { current: string }) => Promise<string | { src: string, alt?: string } | null | undefined>} ImageSelectHook
 */

/**
 * @typedef {Object} FieldContext
 * @property {Translate} t
 * @property {string} locale
 * @property {(key: string, value: unknown, options?: { merge?: boolean }) => void} change
 * @property {string} idPrefix 入力欄の id の接頭辞（ラベルとの関連付け用）
 * @property {Record<string, unknown>} values 編集対象の values 全体
 * @property {MergeTag[]} mergeTags
 * @property {MergeTagDelimiters} delimiters
 * @property {ImageSelectHook | null} onImageSelect
 * @property {((key: string, file: File) => void) | null} [upload] 画像ファイルをアップロードする（フックが無ければ null）
 * @property {UploadState | null} [uploadState] 編集対象のアップロードの状態
 */

/**
 * @param {string} key
 * @param {string} name
 */
function sibling(key, name) {
  const parts = key.split('.');
  parts[parts.length - 1] = name;
  return parts.join('.');
}

/** @param {Event} event */
const inputValue = (event) => /** @type {HTMLInputElement} */ (event.target).value;

/**
 * マージタグの挿入メニュー。選ぶと入力欄のカーソル位置に `{{key}}` を入れる
 * @param {string} inputId
 * @param {FieldSpec} spec
 * @param {FieldContext} ctx
 */
function mergeTagMenu(inputId, spec, ctx) {
  if (!spec.options?.mergeTags || ctx.mergeTags.length === 0) return nothing;
  /** @param {Event} event */
  const onChange = (event) => {
    const select = /** @type {HTMLSelectElement} */ (event.target);
    const key = select.value;
    select.value = '';
    if (!key) return;
    const root = /** @type {ShadowRoot} */ (select.getRootNode());
    const input = /** @type {HTMLInputElement | null} */ (root.getElementById(inputId));
    if (!input) return;
    const tag = `${ctx.delimiters.open}${key}${ctx.delimiters.close}`;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = input.value.slice(0, start) + tag + input.value.slice(end);
    input.value = next;
    ctx.change(spec.key, next);
    input.focus();
    input.setSelectionRange(start + tag.length, start + tag.length);
  };
  return html`<select class="merge-tags" aria-label=${ctx.t('mergeTag.insert')} @change=${onChange}>
    <option value="">${ctx.t('mergeTag.insert')}</option>
    ${ctx.mergeTags.map((tag) => html`<option value=${tag.key}>${tag.label}</option>`)}
  </select>`;
}

/**
 * @param {FieldSpec} spec
 * @param {unknown} value
 * @param {FieldContext} ctx
 * @param {string} id
 * @returns {TemplateResult}
 */
function control(spec, value, ctx, id) {
  const { t, change } = ctx;
  const o = spec.options ?? {};

  switch (spec.kind) {
    case 'text':
    case 'url':
      return html`<div class="with-menu">
        <input
          id=${id}
          type="text"
          inputmode=${spec.kind === 'url' ? 'url' : 'text'}
          .value=${String(value ?? '')}
          placeholder=${o.placeholderKey ? t(o.placeholderKey) : ''}
          @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
        />
        ${mergeTagMenu(id, spec, ctx)}
      </div>`;

    case 'textarea':
    case 'rawhtml':
      return html`<textarea
        id=${id}
        rows=${spec.kind === 'rawhtml' ? 8 : 4}
        .value=${String(value ?? '')}
        @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
      ></textarea>`;

    case 'richtext':
      // 通常はキャンバス上で直接編集する。HTML を直接書きたい人向けに折り畳んで置く。
      // 入力中はそのまま反映し、確定（フォーカスが外れたとき）に許可タグへ整える
      return html`<p class="help">${t('text.editHint')}</p>
        <details class="source">
          <summary>${t('text.htmlSource')}</summary>
          <textarea
            id=${id}
            rows="8"
            .value=${String(value ?? '')}
            @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
            @change=${(/** @type {Event} */ e) =>
              change(spec.key, sanitizeHtml(inputValue(e), { delimiters: ctx.delimiters }), {
                merge: true,
              })}
          ></textarea>
        </details>`;

    case 'number': {
      /** @param {Event} e */
      const onInput = (e) => {
        const raw = inputValue(e).trim();
        if (raw === '') {
          if (o.nullable) change(spec.key, null, { merge: true });
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n)) change(spec.key, n, { merge: true });
      };
      return html`<div class="number">
        <input
          id=${id}
          type="number"
          min=${o.min ?? nothing}
          max=${o.max ?? nothing}
          step=${o.step ?? 1}
          .value=${value == null ? '' : String(value)}
          placeholder=${o.nullable ? t('value.inherit') : ''}
          @input=${onInput}
        />
        ${o.unit ? html`<span class="unit">${o.unit}</span>` : nothing}
      </div>`;
    }

    case 'color': {
      const hex = typeof value === 'string' ? value : '';
      return html`<div class="color">
        <input
          type="color"
          class=${hex ? '' : 'unset'}
          aria-label=${t(spec.labelKey)}
          .value=${hex || '#ffffff'}
          @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
        />
        <input
          id=${id}
          type="text"
          class="hex"
          .value=${hex}
          placeholder=${o.nullable ? t('value.none') : ''}
          @change=${(/** @type {Event} */ e) => {
            const v = inputValue(e).trim();
            if (v === '' && o.nullable) change(spec.key, null);
            else if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) change(spec.key, v);
          }}
        />
        ${
          o.nullable && hex
            ? html`<button type="button" class="clear" @click=${() => change(spec.key, null)}>
                ${t('color.clear')}
              </button>`
            : nothing
        }
      </div>`;
    }

    case 'select':
      return html`<select
        id=${id}
        @change=${(/** @type {Event} */ e) => {
          const raw = /** @type {HTMLSelectElement} */ (e.target).value;
          change(spec.key, raw === '' && o.nullable ? null : raw);
        }}
      >
        ${(o.choices ?? []).map(
          (choice) =>
            html`<option value=${choice.value ?? ''} ?selected=${choice.value === value}>
              ${t(choice.labelKey)}
            </option>`,
        )}
      </select>`;

    case 'align':
      return html`<div class="segmented" role="group" id=${id}>
        ${(
          o.choices ?? [
            { value: 'left', labelKey: 'align.left' },
            { value: 'center', labelKey: 'align.center' },
            { value: 'right', labelKey: 'align.right' },
          ]
        ).map(
          (choice) =>
            html`<button
              type="button"
              aria-pressed=${choice.value === value ? 'true' : 'false'}
              @click=${() => change(spec.key, choice.value)}
            >
              ${t(choice.labelKey)}
            </button>`,
        )}
      </div>`;

    case 'spacing': {
      const sp = /** @type {Record<string, number>} */ (value ?? {});
      return html`<div class="spacing" id=${id}>
        ${['top', 'right', 'bottom', 'left'].map(
          (side) =>
            html`<label>
              <span>${t(`spacing.${side}`)}</span>
              <input
                type="number"
                min="0"
                max="1000"
                .value=${String(sp[side] ?? 0)}
                @input=${(/** @type {Event} */ e) => {
                  const n = Number(inputValue(e));
                  if (inputValue(e) !== '' && Number.isFinite(n)) {
                    change(`${spec.key}.${side}`, n, { merge: true });
                  }
                }}
              />
            </label>`,
        )}
      </div>`;
    }

    case 'toggle': {
      const on = o.on ?? true;
      const off = o.off ?? false;
      return html`<input
        id=${id}
        type="checkbox"
        class="toggle"
        .checked=${value === on}
        @change=${(/** @type {Event} */ e) =>
          change(spec.key, /** @type {HTMLInputElement} */ (e.target).checked ? on : off)}
      />`;
    }

    case 'image': {
      const src = String(value ?? '');
      const state = ctx.uploadState?.field === spec.key ? ctx.uploadState : null;
      const uploading = state?.status === 'uploading';
      /** @param {string} next */
      const measure = async (next) => {
        const size = await measureImage(next);
        if (size) {
          change(sibling(spec.key, 'naturalWidth'), size.width, { merge: true });
          change(sibling(spec.key, 'naturalHeight'), size.height, { merge: true });
        }
      };
      const choose = async () => {
        if (!ctx.onImageSelect) return;
        const result = await ctx.onImageSelect({ current: src });
        if (!result) return;
        const picked = typeof result === 'string' ? { src: result } : result;
        change(spec.key, picked.src);
        const altKey = sibling(spec.key, 'alt');
        if (picked.alt && !getIn(ctx.values, altKey)) change(altKey, picked.alt);
        void measure(picked.src);
      };
      const upload = ctx.upload;
      /** @param {FileList | null} files */
      const send = (files) => {
        const file = files?.[0];
        if (file && upload) upload(spec.key, file);
      };
      /** @param {DragEvent} event */
      const onDragOver = (event) => {
        if (!upload || !hasFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        /** @type {DataTransfer} */ (event.dataTransfer).dropEffect = 'copy';
        /** @type {HTMLElement} */ (event.currentTarget).classList.add('drop-over');
      };
      /** @param {DragEvent} event */
      const onDragLeave = (event) =>
        /** @type {HTMLElement} */ (event.currentTarget).classList.remove('drop-over');
      /** @param {DragEvent} event */
      const onDrop = (event) => {
        if (!upload || !hasFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        /** @type {HTMLElement} */ (event.currentTarget).classList.remove('drop-over');
        send(/** @type {DataTransfer} */ (event.dataTransfer).files);
      };
      const thumb = uploading && state?.preview ? state.preview : src;
      return html`<div
        class="image ${uploading ? 'uploading' : ''}"
        @dragover=${onDragOver}
        @dragleave=${onDragLeave}
        @drop=${onDrop}
      >
        ${thumb ? html`<img class="thumb" src=${thumb} alt="" />` : nothing}
        <input
          id=${id}
          type="text"
          inputmode="url"
          placeholder="https://"
          .value=${src}
          ?disabled=${uploading}
          @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
          @change=${(/** @type {Event} */ e) => void measure(inputValue(e))}
        />
        ${
          upload || ctx.onImageSelect
            ? html`<div class="image-actions">
                ${
                  upload
                    ? html`<button
                          type="button"
                          data-action="upload"
                          ?disabled=${uploading}
                          @click=${(/** @type {Event} */ e) =>
                            /** @type {HTMLInputElement | null} */ (
                              /** @type {HTMLElement} */ (e.currentTarget).nextElementSibling
                            )?.click()}
                        >
                          ${ctx.t('image.upload')}
                        </button>
                        <input
                          type="file"
                          class="file"
                          hidden
                          accept=${UPLOAD_TYPES.join(',')}
                          @change=${(/** @type {Event} */ e) => {
                            const input = /** @type {HTMLInputElement} */ (e.target);
                            send(input.files);
                            input.value = '';
                          }}
                        />`
                    : nothing
                }
                ${
                  ctx.onImageSelect
                    ? html`<button type="button" ?disabled=${uploading} @click=${choose}>
                        ${ctx.t('image.choose')}
                      </button>`
                    : nothing
                }
              </div>`
            : nothing
        }
        ${
          uploading
            ? html`<p class="status" role="status">${ctx.t('image.uploading')}</p>`
            : state?.status === 'error'
              ? html`<p class="error" role="alert">${state.message}</p>`
              : upload
                ? html`<p class="help">${ctx.t('image.dropHint')}</p>`
                : nothing
        }
      </div>`;
    }

    case 'imageWidth': {
      const w = /** @type {{ unit: string, value: number }} */ (value ?? { unit: '%', value: 100 });
      return html`<div class="number">
        <input
          id=${id}
          type="number"
          min="1"
          max=${w.unit === '%' ? 100 : 1200}
          .value=${String(w.value)}
          @input=${(/** @type {Event} */ e) => {
            const n = Number(inputValue(e));
            if (inputValue(e) !== '' && Number.isFinite(n)) {
              change(`${spec.key}.value`, n, { merge: true });
            }
          }}
        />
        <select
          aria-label=${ctx.t('field.width')}
          @change=${(/** @type {Event} */ e) =>
            change(spec.key, {
              unit: /** @type {HTMLSelectElement} */ (e.target).value,
              value: /** @type {HTMLSelectElement} */ (e.target).value === '%' ? 100 : 300,
            })}
        >
          <option value="%" ?selected=${w.unit === '%'}>%</option>
          <option value="px" ?selected=${w.unit === 'px'}>px</option>
        </select>
      </div>`;
    }

    case 'socialItems': {
      const items = /** @type {{ service: string, url: string }[]} */ (
        Array.isArray(value) ? value : []
      );
      /** @param {{ service: string, url: string }[]} next @param {boolean} [merge] */
      const set = (next, merge = false) => change(spec.key, next, { merge });
      return html`<div class="social-items" id=${id}>
        ${items.map(
          (item, i) =>
            html`<div class="social-item">
              <select
                aria-label=${`${t('field.socialItems')} ${i + 1}`}
                @change=${(/** @type {Event} */ e) =>
                  set(
                    items.map((it, j) =>
                      j === i
                        ? { ...it, service: /** @type {HTMLSelectElement} */ (e.target).value }
                        : it,
                    ),
                  )}
              >
                ${SOCIAL_SERVICES.map(
                  (service) =>
                    html`<option value=${service} ?selected=${service === item.service}>
                      ${socialLabel(service, ctx.locale)}
                    </option>`,
                )}
              </select>
              <input
                type="text"
                inputmode="url"
                placeholder="https://"
                .value=${item.url}
                @input=${(/** @type {Event} */ e) =>
                  set(
                    items.map((it, j) => (j === i ? { ...it, url: inputValue(e) } : it)),
                    true,
                  )}
              />
              <button
                type="button"
                aria-label=${t('social.remove')}
                @click=${() => set(items.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>`,
        )}
        <button type="button" @click=${() => set([...items, { service: 'website', url: '' }])}>
          ${t('social.add')}
        </button>
      </div>`;
    }

    case 'layout':
      return html`<div class="layouts" role="group" id=${id}>
        ${ROW_LAYOUT_NAMES.map(
          (layout) =>
            html`<button
              type="button"
              class="layout"
              title=${t(`layout.${layout}`)}
              aria-label=${t(`layout.${layout}`)}
              aria-pressed=${layout === value ? 'true' : 'false'}
              @click=${() => change(spec.key, layout)}
            >
              ${getLayoutSpans(layout).map((span) => html`<span style="flex:${span}"></span>`)}
            </button>`,
        )}
      </div>`;

    default:
      return html``;
  }
}

/**
 * 1 項目（ラベル＋入力部品＋補足）を描画する
 * @param {FieldSpec} spec
 * @param {unknown} value
 * @param {FieldContext} ctx
 * @returns {TemplateResult | typeof nothing}
 */
export function renderField(spec, value, ctx) {
  if (spec.visible && !spec.visible(ctx.values)) return nothing;
  const id = `${ctx.idPrefix}-${spec.key.replace(/\./g, '-')}`;
  const inline = spec.kind === 'toggle';
  return html`<div class="field ${inline ? 'inline' : ''}" data-key=${spec.key}>
    <label for=${id}>${ctx.t(spec.labelKey)}</label>
    ${control(spec, value, ctx, id)}
    ${spec.helpKey ? html`<p class="help">${ctx.t(spec.helpKey)}</p>` : nothing}
  </div>`;
}
