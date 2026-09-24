// 設定パネルの入力部品。FieldSpec から汎用に描画する（ブロックを増やしても部品は増やさない）
import { html, nothing } from 'lit';
import { ROW_LAYOUT_NAMES, getLayoutSpans } from '../../core/model/layout.js';
import { SOCIAL_SERVICES, socialLabel } from '../../core/blocks/social.js';
import { sanitizeHtml } from '../../core/richtext/sanitize.js';
import { getIn, measureImage, setIn } from '../util.js';
import { UPLOAD_TYPES, hasFiles, pickImage } from '../upload.js';
import { qrSignature } from '../../core/blocks/qr.js';
import { labelText } from '../../core/blocks/custom.js';
import { youtubeThumbnail } from '../../core/blocks/video.js';
import { TABLE_MAX_COLUMNS } from '../../core/blocks/table.js';

/** @import { TemplateResult } from 'lit' */
/** @import { Translate } from '../i18n.js' */
/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */
/** @import { UploadState } from '../upload.js' */

/**
 * @typedef {{ value: string | null, labelKey: string, label?: import('../../core/blocks/custom.js').Label }} Choice
 */

/**
 * @typedef {Object} FieldSpec
 * @property {string} key values 内のパス（ドット区切り可）
 * @property {'text' | 'textarea' | 'richtext' | 'rawhtml' | 'url' | 'number' | 'color' | 'select' | 'align' | 'spacing' | 'toggle' | 'image' | 'imageWidth' | 'socialItems' | 'layout' | 'qrcode' | 'list' | 'action' | 'element' | 'videoUrl' | 'tableColumns' | 'tableInfo'} kind
 * @property {string} labelKey 辞書のキー（label があればそちらを使う）
 * @property {import('../../core/blocks/custom.js').Label} [label] そのまま表示する名前（カスタムブロック）
 * @property {string} [helpKey]
 * @property {import('../../core/blocks/custom.js').Label} [help] そのまま表示する説明（カスタムブロック）
 * @property {{ min?: number, max?: number, step?: number, unit?: string, nullable?: boolean, choices?: Choice[], mergeTags?: boolean, on?: unknown, off?: unknown, placeholderKey?: string, placeholder?: import('../../core/blocks/custom.js').Label }} [options]
 * @property {FieldSpec[]} [fields] list: 1 件分の項目
 * @property {() => Record<string, unknown>} [itemDefault] list: 追加する項目の初期値
 * @property {import('../../core/blocks/custom.js').Label | ((item: Record<string, unknown>, index: number, t?: Translate) => string)} [itemLabel] list: 各項目の見出し（標準ブロックには t も渡す）
 * @property {(context: { values: Record<string, unknown>, blockId: string, locale: string }) => unknown} [run] action: 押したときの処理
 * @property {string} [tagName] element: カスタム要素のタグ名
 * @property {(values: any) => boolean} [visible] 条件付きで表示する
 */

/**
 * @typedef {{ key: string, label: string, sample?: string, fallback?: string }} MergeTag
 */

/**
 * 自前の画像選択画面。戻り値は onImageUpload と同じ形（URL / { url, data?, alt? } / { src, alt? }）
 * @typedef {(context: { current: string }) => Promise<import('../upload.js').ImageResult>} ImageSelectHook
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
 * @property {(() => void) | null} [generateQr] QR コードの PNG を作ってアップロードする（フックが無ければ null）
 * @property {string} [blockId] 編集対象のブロック ID
 * @property {((spec: FieldSpec) => void) | null} [runAction] action の処理を実行する
 * @property {ReadonlyMap<string, { busy: boolean, error: string | null }>} [actionState] action の状態（spec.key ごと）
 */

/**
 * 表示用の文字列（そのままの文字列 label があればそれ、無ければ辞書のキー）
 * @param {FieldContext} ctx
 * @param {string | undefined} key
 * @param {import('../../core/blocks/custom.js').Label | undefined} literal
 * @returns {string}
 */
function text(ctx, key, literal) {
  if (literal !== undefined && literal !== null) return labelText(literal, ctx.locale);
  return key ? ctx.t(key) : '';
}

/** @type {Map<string, HTMLElement & Record<string, any>>} element の部品（設定欄の描画をまたいで使い回す） */
const elementCache = new Map();

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
          placeholder=${text(ctx, o.placeholderKey, o.placeholder)}
          @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
        />
        ${mergeTagMenu(id, spec, ctx)}
      </div>`;

    case 'videoUrl': {
      // 動画の URL。YouTube の URL なら、サムネイルが空（または前に自動で入れた YouTube の画像）のときに入れる
      /** @param {string} url */
      const fillThumbnail = (url) => {
        const found = youtubeThumbnail(url);
        const thumb = /** @type {any} */ (ctx.values).thumbnail ?? {};
        if (!found || thumb.src === found.src) return;
        if (thumb.src && !/^https:\/\/i\.ytimg\.com\//.test(thumb.src)) return;
        change(sibling(spec.key, 'thumbnail'), { ...thumb, ...found, uploadData: null });
      };
      return html`<div class="with-menu">
        <input
          id=${id}
          type="text"
          inputmode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          .value=${String(value ?? '')}
          @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
          @change=${(/** @type {Event} */ e) => fillThumbnail(inputValue(e))}
        />
        ${mergeTagMenu(id, spec, ctx)}
      </div>`;
    }

    case 'tableInfo':
      // セルはキャンバス上で直接編集する。ここでは行と列の数と操作の案内だけ出す
      return html`<p class="help" id=${id}>
        ${t('table.size', {
          rows: Array.isArray(value) ? value.length : 0,
          columns: Array.isArray(/** @type {any} */ (ctx.values).columns)
            ? /** @type {any} */ (ctx.values).columns.length
            : 0,
        })}
        ${t('table.editHint')}
      </p>`;

    case 'tableColumns': {
      // 列ごとの幅（%。空なら自動）と揃え。列の数は表の操作（キャンバスのツールバー）で変える
      const columns = /** @type {{ width: number | null, align: string }[]} */ (
        Array.isArray(value) ? value : []
      );
      /** @param {number} i @param {Record<string, unknown>} patch @param {boolean} [merge] */
      const set = (i, patch, merge = false) =>
        change(
          spec.key,
          columns.map((c, j) => (j === i ? { ...c, ...patch } : c)),
          { merge },
        );
      return html`<div class="table-columns" id=${id}>
        ${columns.map(
          (column, i) =>
            html`<div class="table-column" data-column=${i}>
              <span class="table-column-name">${t('table.column', { n: i + 1 })}</span>
              <div class="number">
                <input
                  type="number"
                  min="1"
                  max="100"
                  aria-label=${`${t('table.column', { n: i + 1 })} ${t('field.width')}`}
                  placeholder=${t('table.auto')}
                  .value=${column.width == null ? '' : String(column.width)}
                  @input=${(/** @type {Event} */ e) => {
                    const raw = inputValue(e).trim();
                    const n = Number(raw);
                    if (raw === '') set(i, { width: null }, true);
                    else if (Number.isFinite(n) && n >= 1 && n <= 100)
                      set(i, { width: Math.round(n) }, true);
                  }}
                />
                <span class="unit">%</span>
              </div>
              <div
                class="segmented"
                role="group"
                aria-label=${`${t('table.column', { n: i + 1 })} ${t('field.align')}`}
              >
                ${[
                  ['left', '⇤'],
                  ['center', '↔'],
                  ['right', '⇥'],
                ].map(
                  ([align, icon]) =>
                    html`<button
                      type="button"
                      title=${t(`align.${align}`)}
                      aria-label=${t(`align.${align}`)}
                      aria-pressed=${column.align === align ? 'true' : 'false'}
                      @click=${() => set(i, { align })}
                    >
                      ${icon}
                    </button>`,
                )}
              </div>
            </div>`,
        )}
        <p class="help">${t('table.columnsHelp', { max: TABLE_MAX_COLUMNS })}</p>
      </div>`;
    }

    case 'textarea':
    case 'rawhtml':
      return html`<textarea
        id=${id}
        rows=${spec.kind === 'rawhtml' ? 8 : 4}
        .value=${String(value ?? '')}
        @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
      ></textarea>`;

    case 'qrcode': {
      // QR の内容と「作成」ボタン。画像は onImageUpload でアップロードして src に入れる
      const v = /** @type {any} */ (ctx.values);
      const state = ctx.uploadState?.field === 'src' ? ctx.uploadState : null;
      const uploading = state?.status === 'uploading';
      const content = String(value ?? '');
      const stale = Boolean(v.src) && v.generated !== qrSignature(v);
      /** @type {unknown} */
      let status = nothing;
      if (!ctx.generateQr) status = html`<p class="help">${t('qr.needsUpload')}</p>`;
      else if (uploading) status = html`<p class="status" role="status">${t('qr.uploading')}</p>`;
      else if (state?.status === 'error')
        status = html`<p class="error" role="alert">${state.message}</p>`;
      else if (content && !v.src) status = html`<p class="help">${t('qr.missing')}</p>`;
      else if (content && stale)
        status = html`<p class="warning" role="status">${t('qr.stale')}</p>`;
      return html`<div class="qr">
        <textarea
          id=${id}
          rows="3"
          placeholder="https://"
          .value=${content}
          ?disabled=${uploading}
          @input=${(/** @type {Event} */ e) => change(spec.key, inputValue(e), { merge: true })}
        ></textarea>
        ${
          ctx.generateQr
            ? html`<div class="image-actions">
                <button
                  type="button"
                  data-action="generate-qr"
                  ?disabled=${uploading || !content}
                  @click=${() => ctx.generateQr?.()}
                >
                  ${v.src ? t('qr.regenerate') : t('qr.generate')}
                </button>
              </div>`
            : nothing
        }
        ${status}
      </div>`;
    }

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
          aria-label=${text(ctx, spec.labelKey, spec.label)}
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
              ${text(ctx, choice.labelKey, choice.label)}
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
              ${text(ctx, choice.labelKey, choice.label)}
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
        const picked = pickImage(await ctx.onImageSelect({ current: src }));
        if (!picked) return;
        change(spec.key, picked.src);
        const dataKey = sibling(spec.key, 'uploadData');
        if (picked.data || getIn(ctx.values, dataKey)) change(dataKey, picked.data);
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
          @input=${(/** @type {Event} */ e) => {
            change(spec.key, inputValue(e), { merge: true });
            // URL を手で変えたら、アップロード時に受け取ったデータは別の画像のものになるので消す
            const dataKey = sibling(spec.key, 'uploadData');
            if (getIn(ctx.values, dataKey)) change(dataKey, null, { merge: true });
          }}
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

    case 'list': {
      // 項目の配列。1 件ずつ見出しと並べ替え・削除のボタン、中に項目の設定を並べる
      const items = /** @type {Record<string, unknown>[]} */ (Array.isArray(value) ? value : []);
      const min = o.min ?? 0;
      const max = o.max ?? Infinity;
      /** @param {Record<string, unknown>[]} next */
      const set = (next) => change(spec.key, next);
      const title = (/** @type {Record<string, unknown>} */ item, /** @type {number} */ i) =>
        typeof spec.itemLabel === 'function'
          ? spec.itemLabel(item, i, t)
          : `${spec.itemLabel ? text(ctx, undefined, spec.itemLabel) : t('list.item')} ${i + 1}`;
      return html`<div class="list" id=${id}>
        ${items.map((item, i) => {
          /** @type {FieldContext} */
          const itemCtx = {
            ...ctx,
            values: item,
            idPrefix: `${ctx.idPrefix}-${spec.key}-${i}`,
            change: (key, v, options) => change(spec.key, setIn(items, `${i}.${key}`, v), options),
            upload: ctx.upload
              ? (key, file) => ctx.upload?.(`${spec.key}.${i}.${key}`, file)
              : null,
            uploadState: ctx.uploadState?.field.startsWith(`${spec.key}.${i}.`)
              ? {
                  ...ctx.uploadState,
                  field: ctx.uploadState.field.slice(`${spec.key}.${i}.`.length),
                }
              : null,
          };
          return html`<div class="list-item">
            <div class="list-head">
              <span>${title(item, i)}</span>
              <button
                type="button"
                title=${t('list.moveUp')}
                aria-label=${t('list.moveUp')}
                ?disabled=${i === 0}
                @click=${() => {
                  const next = items.slice();
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  set(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                title=${t('list.moveDown')}
                aria-label=${t('list.moveDown')}
                ?disabled=${i === items.length - 1}
                @click=${() => {
                  const next = items.slice();
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  set(next);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                data-action="remove-item"
                title=${t('list.remove')}
                aria-label=${t('list.remove')}
                ?disabled=${items.length <= min}
                @click=${() => set(items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
            ${(spec.fields ?? []).map((field) => renderField(field, getIn(item, field.key), itemCtx))}
          </div>`;
        })}
        <button
          type="button"
          data-action="add-item"
          ?disabled=${items.length >= max}
          @click=${() => set([...items, spec.itemDefault ? spec.itemDefault() : {}])}
        >
          ${t('list.add')}
        </button>
      </div>`;
    }

    case 'action': {
      // 利用者の処理（外部データの選択など）を呼び、返った値をブロックに入れるボタン
      const state = ctx.actionState?.get(spec.key);
      return html`<div class="action">
        <button
          id=${id}
          type="button"
          data-action="custom-action"
          ?disabled=${!ctx.runAction || state?.busy}
          @click=${() => ctx.runAction?.(spec)}
        >
          ${text(ctx, spec.labelKey, spec.label)}
        </button>
        ${state?.error ? html`<p class="error" role="alert">${state.error}</p>` : nothing}
      </div>`;
    }

    case 'element': {
      // 利用者のカスタム要素。value・values・locale・blockId を渡し、mm-field-change（detail.value）で受け取る
      const cacheKey = `${ctx.idPrefix}-${spec.key}`;
      let el = elementCache.get(cacheKey);
      if (!el || el.localName !== spec.tagName) {
        el = /** @type {HTMLElement & Record<string, any>} */ (
          document.createElement(/** @type {string} */ (spec.tagName))
        );
        el.id = id;
        el.addEventListener('mm-field-change', (event) => {
          event.stopPropagation();
          /** @type {any} */ (el).__mmChange?.(/** @type {CustomEvent} */ (event).detail?.value);
        });
        elementCache.set(cacheKey, el);
      }
      el.__mmChange = (/** @type {unknown} */ v) => change(spec.key, v);
      el.value = value;
      el.values = ctx.values;
      el.locale = ctx.locale;
      el.blockId = ctx.blockId;
      return html`${el}`;
    }

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
  const help = text(ctx, spec.helpKey, spec.help);
  return html`<div class="field ${inline ? 'inline' : ''}" data-key=${spec.key}>
    ${spec.kind === 'action' ? nothing : html`<label for=${id}>${text(ctx, spec.labelKey, spec.label)}</label>`}
    ${control(spec, value, ctx, id)} ${help ? html`<p class="help">${help}</p>` : nothing}
  </div>`;
}
