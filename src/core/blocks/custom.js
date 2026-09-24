// カスタムブロック: 利用者が defineBlock() で定義するブロック。
// 設定項目（fields）から値のスキーマと既定値を作り、出力は利用者の関数に任せる。
// 定義は DOM に依存しないので、同じものをエディタ（editor.blocks）とサーバー（renderHtml の blocks）で使える
import { MailmasonError } from '../errors.js';
import { s } from '../model/schema.js';
import { escapeAttr, escapeText } from '../richtext/entities.js';
import { renderLines } from '../render-html/lines.js';
import { buttonBlock } from './button.js';
import { imageHtml } from './image.js';
import { isBuiltinBlockType } from './registry.js';

/** @import { Schema } from '../model/schema.js' */
/** @import { Block, BodySettings, Spacing } from '../model/types.js' */
/** @import { CoreBlockDef, HtmlContext, TextContext } from './types.js' */

/**
 * 表示用の文字列。言語ごとに変えるときは { ja: '…', en: '…' }
 * @typedef {string | Record<string, string>} Label
 */

/**
 * @typedef {Object} CustomChoice
 * @property {string} value
 * @property {Label} label
 */

/**
 * カスタムブロックの設定項目
 * @typedef {Object} CustomField
 * @property {'text' | 'textarea' | 'url' | 'number' | 'color' | 'select' | 'align' | 'toggle' | 'image' | 'list' | 'action' | 'element'} kind
 * @property {string} [key] values のキー（action 以外は必須）
 * @property {Label} label
 * @property {Label} [help] 入力欄の下に出す説明
 * @property {unknown} [default] 既定値（省略時は種類ごとの既定値）
 * @property {boolean} [mergeTags] 差し込み変数を使えるか（text / textarea / url / image の代替テキスト）
 * @property {Label} [placeholder]
 * @property {number} [min] number: 最小値 / list: 最少件数
 * @property {number} [max] number: 最大値 / list: 最多件数
 * @property {number} [step] number
 * @property {string} [unit] number: 単位（'px' など）
 * @property {boolean} [integer] number: 整数だけにする
 * @property {boolean} [nullable] number / color: 空（null）を許す
 * @property {CustomChoice[]} [choices] select / align の選択肢
 * @property {CustomField[]} [fields] list: 1 件分の設定項目
 * @property {Label | ((item: Record<string, unknown>, index: number) => string)} [itemLabel] list: 各項目の見出し
 * @property {(context: CustomActionContext) => Promise<Record<string, unknown> | null | undefined> | Record<string, unknown> | null | undefined} [run]
 *   action: ボタンを押したときに呼ぶ。返した値を values にマージする（null / undefined なら何もしない）
 * @property {string} [tagName] element: 設定欄に置くカスタム要素のタグ名
 * @property {(values: Record<string, unknown>) => boolean} [visible] 条件付きで表示する
 */

/**
 * @typedef {Object} CustomActionContext
 * @property {Record<string, unknown>} values ブロックの今の values
 * @property {string} blockId
 * @property {string} locale
 */

/**
 * renderHtml に渡す道具
 * @typedef {Object} CustomHtmlContext
 * @property {number} width ブロックの内容幅（px、ブロックの余白を除く）
 * @property {BodySettings} body メール全体の設定（文字色・フォントなど）
 * @property {string} blockId
 * @property {string} locale
 * @property {Record<string, string> | null} mergeValues 差し込み値（書き出しで渡されたとき。通常は気にしなくてよい）
 * @property {(text: string) => string} escape テキストを HTML 用にエスケープする
 * @property {(text: string) => string} escapeAttr 属性値用にエスケープする
 * @property {(text: string) => string} text エスケープして改行を <br /> にする
 * @property {(image: { src: string, alt?: string, href?: string, width?: number, naturalWidth?: number | null, naturalHeight?: number | null, align?: 'left' | 'center' | 'right' }) => string} image
 *   メール向けの img（リンク付きなら a で包む）。width の既定はブロック幅。src が空なら空文字
 * @property {(button: { label: string, href?: string, backgroundColor?: string, color?: string, fontSize?: number, fontWeight?: 'normal' | 'bold', borderRadius?: number, innerPadding?: Spacing, width?: 'auto' | 'full' }) => string} button
 *   メール向けのボタン（Outlook では VML の角丸ボタン）。label が空なら空文字
 */

/**
 * @typedef {Object} CustomTextContext
 * @property {string} blockId
 * @property {string} locale
 */

/**
 * defineBlock() に渡す定義
 * @typedef {Object} CustomBlockInput
 * @property {string} type ブロックの種類。英小文字・数字・ハイフンで、ハイフンを 1 つ以上含む（例: 'acme-coupon'）
 * @property {Label} label パレットや設定パネルに出す名前
 * @property {string} [icon] パレットのアイコン（SVG のマークアップ。viewBox 0 0 24 24 推奨）
 * @property {CustomField[]} fields 設定項目
 * @property {(values: any, ctx: CustomHtmlContext) => string | string[] | null | undefined} renderHtml
 *   配信用 HTML（テーブル＋インライン CSS）。空なら出力しない。値のエスケープは定義側で行う（ctx.escape など）
 * @property {(values: any, ctx: CustomTextContext) => string | null | undefined} [renderText] テキストパート（省略時は出さない）
 * @property {(values: any) => 'left' | 'center' | 'right'} [align] ブロックを包むセルの横位置
 * @property {{ backgroundColor?: string | null, padding?: number | Spacing }} [defaultStyle] 共通スタイルの既定値（既定は余白 10px）
 */

/**
 * defineBlock() が返す定義（そのまま editor.blocks や renderHtml の blocks に渡す）
 * @typedef {CoreBlockDef & { custom: true, label: Label, icon: string | null, fields: readonly CustomField[] }} CustomBlock
 */

const TYPE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VALUE_KINDS = new Set([
  'text',
  'textarea',
  'url',
  'number',
  'color',
  'select',
  'align',
  'toggle',
  'image',
  'list',
  'element',
]);
const ALIGN_VALUES = ['left', 'center', 'right'];

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new MailmasonError('invalid-block-definition', message);
}

/**
 * @param {unknown} label
 * @param {string} where
 */
function checkLabel(label, where) {
  const ok =
    (typeof label === 'string' && label !== '') ||
    (label !== null &&
      typeof label === 'object' &&
      Object.values(label).length > 0 &&
      Object.values(label).every((v) => typeof v === 'string'));
  if (!ok) fail(`${where}: label must be a non-empty string or { ja, en, ... }.`);
}

/**
 * 設定項目を検査する
 * @param {readonly CustomField[]} fields
 * @param {string} where
 * @param {boolean} [nested] リストの中か
 */
function checkFields(fields, where, nested = false) {
  if (!Array.isArray(fields)) fail(`${where}: fields must be an array.`);
  const keys = new Set();
  for (const field of fields) {
    const at = `${where} field "${field?.key ?? field?.kind}"`;
    if (!field || typeof field !== 'object') fail(`${where}: invalid field.`);
    if (field.kind !== 'action' && !VALUE_KINDS.has(field.kind)) {
      fail(`${at}: unknown kind "${field.kind}".`);
    }
    checkLabel(field.label, at);
    if (field.kind === 'action') {
      if (nested) fail(`${at}: action cannot be used inside a list.`);
      if (typeof field.run !== 'function') fail(`${at}: action needs run().`);
      continue;
    }
    if (typeof field.key !== 'string' || !KEY_PATTERN.test(field.key)) {
      fail(`${at}: key must be an identifier (letters, digits, _).`);
    }
    if (keys.has(field.key)) fail(`${at}: duplicate key.`);
    keys.add(field.key);
    if (field.kind === 'select' || (field.kind === 'align' && field.choices)) {
      if (!Array.isArray(field.choices) || field.choices.length === 0) {
        fail(`${at}: choices are required.`);
      }
    }
    if (field.kind === 'list') {
      checkFields(field.fields ?? fail(`${at}: list needs fields.`), at, true);
    }
    if (field.kind === 'element' && !/-/.test(field.tagName ?? '')) {
      fail(`${at}: element needs a custom element tagName (with a hyphen).`);
    }
  }
}

/**
 * 画像の値（src・代替テキスト・実寸・アップロード時のデータ）
 * @returns {Record<string, unknown>}
 */
const emptyImage = () => ({
  src: '',
  alt: '',
  naturalWidth: null,
  naturalHeight: null,
  uploadData: null,
});

const imageSchema = s.object({
  src: s.string(),
  alt: s.string(),
  naturalWidth: s.number({ min: 1, integer: true, nullable: true }),
  naturalHeight: s.number({ min: 1, integer: true, nullable: true }),
  uploadData: s.record({ nullable: true }),
});

/**
 * @param {CustomField} field
 * @returns {string[]}
 */
function choiceValues(field) {
  return field.choices ? field.choices.map((c) => c.value) : ALIGN_VALUES;
}

/**
 * 設定項目の既定値
 * @param {CustomField} field
 * @returns {unknown}
 */
function defaultOf(field) {
  switch (field.kind) {
    case 'number':
      return field.nullable ? null : Math.max(field.min ?? 0, Math.min(field.max ?? 0, 0));
    case 'color':
      return field.nullable ? null : '#000000';
    case 'select':
    case 'align':
      return choiceValues(field)[0];
    case 'toggle':
      return false;
    case 'image':
      return emptyImage();
    case 'list':
      return [];
    case 'element':
      return null;
    default:
      return '';
  }
}

/**
 * 設定項目の値のスキーマ
 * @param {CustomField} field
 * @returns {Schema}
 */
function schemaOf(field) {
  switch (field.kind) {
    case 'number':
      return s.number({
        min: field.min,
        max: field.max,
        integer: field.integer,
        nullable: field.nullable,
      });
    case 'color':
      return s.color({ nullable: field.nullable });
    case 'select':
    case 'align':
      return s.oneOf(choiceValues(field));
    case 'toggle':
      return s.boolean();
    case 'image':
      return imageSchema;
    case 'list': {
      const itemFields = /** @type {CustomField[]} */ (field.fields);
      return s.arrayOf(objectSchema(itemFields), () => defaultsOf(itemFields));
    }
    case 'element':
      return s.any();
    default:
      return s.string();
  }
}

/**
 * @param {readonly CustomField[]} fields
 * @returns {Schema}
 */
function objectSchema(fields) {
  /** @type {Record<string, Schema>} */
  const shape = {};
  for (const field of fields) if (field.key) shape[field.key] = schemaOf(field);
  return s.object(shape);
}

/**
 * 設定項目の既定値をまとめたオブジェクト（リストの項目を追加するときにも使う）
 * @param {readonly CustomField[]} fields
 * @returns {Record<string, unknown>}
 */
export function defaultsOf(fields) {
  /** @type {Record<string, unknown>} */
  const values = {};
  for (const field of fields) {
    if (!field.key) continue;
    const fallback = defaultOf(field);
    let value = field.default === undefined ? fallback : structuredClone(field.default);
    if (field.kind === 'image' && value && typeof value === 'object') {
      value = { ...emptyImage(), ...value };
    }
    if (field.kind === 'list' && Array.isArray(value)) {
      const itemDefaults = defaultsOf(/** @type {CustomField[]} */ (field.fields));
      value = value.map((item) => ({ ...structuredClone(itemDefaults), ...item }));
    }
    values[field.key] = value;
  }
  return values;
}

/**
 * 差し込み変数を検査する項目のパス（リストの中は `items[].name`）
 * @param {readonly CustomField[]} fields
 * @param {string} [prefix]
 * @returns {string[]}
 */
function mergeTagPaths(fields, prefix = '') {
  /** @type {string[]} */
  const paths = [];
  for (const field of fields) {
    if (!field.key) continue;
    if (field.kind === 'list') {
      paths.push(
        ...mergeTagPaths(/** @type {CustomField[]} */ (field.fields), `${prefix}${field.key}[].`),
      );
    } else if (field.mergeTags && ['text', 'textarea', 'url'].includes(field.kind)) {
      paths.push(`${prefix}${field.key}`);
    } else if (field.kind === 'image') {
      paths.push(`${prefix}${field.key}.src`, `${prefix}${field.key}.alt`);
    }
  }
  return paths;
}

/**
 * @param {Block} block
 * @param {HtmlContext} ctx
 * @returns {CustomHtmlContext}
 */
function htmlContext(block, ctx) {
  const buttonDefaults = buttonBlock.defaults();
  return {
    width: ctx.width,
    body: ctx.body,
    blockId: block.id,
    locale: ctx.options.locale,
    mergeValues: ctx.options.mergeValues,
    escape: (text) => escapeText(String(text ?? '')),
    escapeAttr: (text) => escapeAttr(String(text ?? '')),
    text: (text) => escapeText(String(text ?? '')).replace(/\r?\n/g, '<br />'),
    image: (image) =>
      image?.src
        ? imageHtml({
            src: image.src,
            alt: image.alt ?? '',
            href: image.href ?? '',
            width: Math.max(1, Math.min(Math.round(image.width ?? ctx.width), ctx.width)),
            naturalWidth: image.naturalWidth ?? null,
            naturalHeight: image.naturalHeight ?? null,
            align: image.align,
          })
        : '',
    button: (button) => {
      if (!button?.label) return '';
      const values = { ...buttonDefaults, ...button };
      const lines = buttonBlock.renderHtml({ ...block, type: 'button', values }, ctx);
      return renderLines(lines, false);
    },
  };
}

/**
 * カスタムブロックを定義する。返した値を `editor.blocks` と、サーバーでの
 * `renderHtml` / `renderText` / `resolveTextPart` / `migrate` / `validate` の `blocks` オプションに渡す
 * @param {CustomBlockInput} input
 * @returns {CustomBlock}
 * @throws {MailmasonError} invalid-block-definition
 */
export function defineBlock(input) {
  if (!input || typeof input !== 'object') fail('Block definition must be an object.');
  const { type } = input;
  if (typeof type !== 'string' || !TYPE_PATTERN.test(type)) {
    fail(
      `Block type "${type}" must be lowercase letters, digits and hyphens, with at least one hyphen (e.g. "acme-coupon").`,
    );
  }
  if (isBuiltinBlockType(type)) fail(`Block type "${type}" is a built-in block.`);
  checkLabel(input.label, `Block "${type}"`);
  checkFields(input.fields, `Block "${type}"`);
  if (typeof input.renderHtml !== 'function') fail(`Block "${type}": renderHtml() is required.`);

  const fields = Object.freeze([...input.fields]);
  const schema = objectSchema(fields);
  const baseDefaults = defaultsOf(fields);
  const padding = input.defaultStyle?.padding;
  /** @type {() => Block['style']} */
  const defaultStyle = () => ({
    backgroundColor: input.defaultStyle?.backgroundColor ?? null,
    padding:
      typeof padding === 'number'
        ? { top: padding, right: padding, bottom: padding, left: padding }
        : padding
          ? { ...padding }
          : { top: 10, right: 10, bottom: 10, left: 10 },
  });

  /** @type {CustomBlock} */
  const def = {
    custom: true,
    type,
    label: input.label,
    icon: typeof input.icon === 'string' ? input.icon : null,
    fields,
    defaults: () => structuredClone(baseDefaults),
    schema,
    defaultStyle,
    mergeTagFields: mergeTagPaths(fields),
    cellAlign: input.align ? (block) => /** @type {any} */ (input.align)(block.values) : undefined,
    renderHtml(block, ctx) {
      const out = input.renderHtml(block.values, htmlContext(block, ctx));
      if (out === null || out === undefined || out === '') return [];
      return Array.isArray(out)
        ? out.filter((line) => typeof line === 'string' && line !== '')
        : [String(out)];
    },
    renderText(block, ctx) {
      if (!input.renderText) return '';
      const out = input.renderText(block.values, { blockId: block.id, locale: ctx.options.locale });
      return out ? String(out) : '';
    },
  };
  return Object.freeze(def);
}

/**
 * ラベルを言語に合わせて選ぶ（無ければ ja、それも無ければ最初の値）
 * @param {Label} label
 * @param {string} locale
 * @returns {string}
 */
export function labelText(label, locale) {
  if (typeof label === 'string') return label;
  return label[locale] ?? label.ja ?? Object.values(label)[0] ?? '';
}

/**
 * @param {unknown} def
 * @returns {def is CustomBlock}
 */
export function isCustomBlock(def) {
  return Boolean(def && typeof def === 'object' && /** @type {any} */ (def).custom === true);
}
