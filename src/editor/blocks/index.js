// エディタ側のブロック定義（パレットの表示・設定パネルの項目・新規作成時の初期値）。
// コア側の定義（src/core/blocks）と type で結び付く
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { icons } from '../icons.js';
import { defaultsOf, labelText } from '../../core/blocks/custom.js';

/** @import { FieldSpec } from '../fields/fields.js' */
/** @import { Translate } from '../i18n.js' */
/** @import { CustomBlock, CustomField } from '../../core/blocks/custom.js' */

/**
 * @typedef {Object} EditorBlockDef
 * @property {string} type
 * @property {string} labelKey 標準ブロックの名前（辞書のキー）
 * @property {import('../../core/blocks/custom.js').Label} [label] カスタムブロックの名前（そのまま表示）
 * @property {unknown} icon
 * @property {FieldSpec[]} fields
 * @property {string} placeholderKey キャンバスで中身が空のときの表示
 * @property {(t: Translate) => Record<string, unknown>} [initialValues] パレットから追加したときの初期値
 * @property {boolean} [requiresUpload] onImageUpload が無いとパレットに出さない（QR コードなど）
 */

const ALIGN = /** @type {const} */ ('align');

/** @type {EditorBlockDef[]} */
const defs = [
  {
    type: 'text',
    labelKey: 'block.text',
    icon: icons.text,
    placeholderKey: 'placeholder.text',
    initialValues: (t) => ({ html: `<p>${t('initial.text')}</p>` }),
    fields: [
      { key: 'html', kind: 'richtext', labelKey: 'field.html' },
      {
        key: 'fontSize',
        kind: 'number',
        labelKey: 'field.fontSize',
        options: { min: 8, max: 72, unit: 'px', nullable: true },
      },
      {
        key: 'lineHeight',
        kind: 'number',
        labelKey: 'field.lineHeight',
        options: { min: 0.8, max: 3, step: 0.1, nullable: true },
      },
      { key: 'color', kind: 'color', labelKey: 'field.textColor', options: { nullable: true } },
      {
        key: 'fontFamily',
        kind: 'text',
        labelKey: 'field.fontFamily',
        options: { placeholderKey: 'value.inherit' },
      },
    ],
  },
  {
    type: 'image',
    labelKey: 'block.image',
    icon: icons.image,
    placeholderKey: 'placeholder.image',
    fields: [
      { key: 'src', kind: 'image', labelKey: 'field.src', options: { mergeTags: true } },
      { key: 'alt', kind: 'text', labelKey: 'field.alt', options: { mergeTags: true } },
      { key: 'href', kind: 'url', labelKey: 'field.href', options: { mergeTags: true } },
      { key: 'width', kind: 'imageWidth', labelKey: 'field.width' },
      { key: 'align', kind: ALIGN, labelKey: 'field.align' },
    ],
  },
  {
    type: 'button',
    labelKey: 'block.button',
    icon: icons.button,
    placeholderKey: 'placeholder.button',
    initialValues: (t) => ({ label: t('initial.button') }),
    fields: [
      { key: 'label', kind: 'text', labelKey: 'field.label', options: { mergeTags: true } },
      { key: 'href', kind: 'url', labelKey: 'field.href', options: { mergeTags: true } },
      { key: 'backgroundColor', kind: 'color', labelKey: 'field.buttonColor' },
      { key: 'color', kind: 'color', labelKey: 'field.textColor' },
      {
        key: 'fontSize',
        kind: 'number',
        labelKey: 'field.fontSize',
        options: { min: 8, max: 72, unit: 'px' },
      },
      {
        key: 'fontWeight',
        kind: 'select',
        labelKey: 'field.fontWeight',
        options: {
          choices: [
            { value: 'normal', labelKey: 'fontWeight.normal' },
            { value: 'bold', labelKey: 'fontWeight.bold' },
          ],
        },
      },
      {
        key: 'borderRadius',
        kind: 'number',
        labelKey: 'field.borderRadius',
        options: { min: 0, max: 100, unit: 'px' },
      },
      { key: 'innerPadding', kind: 'spacing', labelKey: 'field.innerPadding' },
      {
        key: 'width',
        kind: 'align',
        labelKey: 'field.buttonWidth',
        options: {
          choices: [
            { value: 'auto', labelKey: 'buttonWidth.auto' },
            { value: 'full', labelKey: 'buttonWidth.full' },
          ],
        },
      },
      { key: 'align', kind: ALIGN, labelKey: 'field.align', visible: (v) => v.width !== 'full' },
    ],
  },
  {
    type: 'divider',
    labelKey: 'block.divider',
    icon: icons.divider,
    placeholderKey: 'placeholder.text',
    fields: [
      {
        key: 'thickness',
        kind: 'number',
        labelKey: 'field.thickness',
        options: { min: 1, max: 20, unit: 'px' },
      },
      { key: 'color', kind: 'color', labelKey: 'field.color' },
      {
        key: 'lineStyle',
        kind: 'select',
        labelKey: 'field.lineStyle',
        options: {
          choices: [
            { value: 'solid', labelKey: 'lineStyle.solid' },
            { value: 'dashed', labelKey: 'lineStyle.dashed' },
            { value: 'dotted', labelKey: 'lineStyle.dotted' },
          ],
        },
      },
      {
        key: 'widthPercent',
        kind: 'number',
        labelKey: 'field.widthPercent',
        options: { min: 1, max: 100, unit: '%' },
      },
      { key: 'align', kind: ALIGN, labelKey: 'field.align', visible: (v) => v.widthPercent < 100 },
    ],
  },
  {
    type: 'spacer',
    labelKey: 'block.spacer',
    icon: icons.spacer,
    placeholderKey: 'placeholder.text',
    fields: [
      {
        key: 'height',
        kind: 'number',
        labelKey: 'field.height',
        options: { min: 1, max: 500, unit: 'px' },
      },
    ],
  },
  {
    type: 'imageText',
    labelKey: 'block.imageText',
    icon: icons.imageText,
    placeholderKey: 'placeholder.imageText',
    initialValues: (t) => ({ html: `<p>${t('initial.text')}</p>` }),
    fields: [
      { key: 'image.src', kind: 'image', labelKey: 'field.src', options: { mergeTags: true } },
      { key: 'image.alt', kind: 'text', labelKey: 'field.alt', options: { mergeTags: true } },
      { key: 'image.href', kind: 'url', labelKey: 'field.href', options: { mergeTags: true } },
      {
        key: 'imagePosition',
        kind: 'align',
        labelKey: 'field.imagePosition',
        options: {
          choices: [
            { value: 'left', labelKey: 'position.left' },
            { value: 'right', labelKey: 'position.right' },
          ],
        },
      },
      {
        key: 'imageWidthPercent',
        kind: 'number',
        labelKey: 'field.imageWidthPercent',
        options: { min: 10, max: 90, unit: '%' },
      },
      { key: 'html', kind: 'richtext', labelKey: 'field.html' },
    ],
  },
  {
    type: 'social',
    labelKey: 'block.social',
    icon: icons.social,
    placeholderKey: 'placeholder.social',
    fields: [
      { key: 'items', kind: 'socialItems', labelKey: 'field.socialItems' },
      {
        key: 'iconSize',
        kind: 'number',
        labelKey: 'field.iconSize',
        options: { min: 16, max: 64, unit: 'px' },
      },
      {
        key: 'iconStyle',
        kind: 'select',
        labelKey: 'field.iconStyle',
        options: {
          choices: [
            { value: 'color', labelKey: 'iconStyle.color' },
            { value: 'mono', labelKey: 'iconStyle.mono' },
          ],
        },
      },
      { key: 'align', kind: ALIGN, labelKey: 'field.align' },
    ],
  },
  {
    type: 'qr',
    labelKey: 'block.qr',
    icon: icons.qr,
    placeholderKey: 'placeholder.qr',
    requiresUpload: true,
    initialValues: (t) => ({ alt: t('initial.qrAlt') }),
    fields: [
      {
        key: 'content',
        kind: 'qrcode',
        labelKey: 'field.qrContent',
        helpKey: 'field.qrContentHelp',
      },
      {
        key: 'size',
        kind: 'number',
        labelKey: 'field.qrSize',
        options: { min: 48, max: 600, unit: 'px' },
      },
      {
        key: 'ecLevel',
        kind: 'select',
        labelKey: 'field.qrEcLevel',
        options: {
          choices: [
            { value: 'L', labelKey: 'qrEcLevel.L' },
            { value: 'M', labelKey: 'qrEcLevel.M' },
            { value: 'Q', labelKey: 'qrEcLevel.Q' },
            { value: 'H', labelKey: 'qrEcLevel.H' },
          ],
        },
      },
      {
        key: 'margin',
        kind: 'number',
        labelKey: 'field.qrMargin',
        options: { min: 0, max: 8 },
      },
      { key: 'color', kind: 'color', labelKey: 'field.qrColor' },
      { key: 'backgroundColor', kind: 'color', labelKey: 'field.qrBackgroundColor' },
      { key: 'alt', kind: 'text', labelKey: 'field.alt', options: { mergeTags: true } },
      { key: 'href', kind: 'url', labelKey: 'field.href', options: { mergeTags: true } },
      { key: 'align', kind: ALIGN, labelKey: 'field.align' },
    ],
  },
  {
    type: 'html',
    labelKey: 'block.html',
    icon: icons.html,
    placeholderKey: 'placeholder.html',
    fields: [
      { key: 'html', kind: 'rawhtml', labelKey: 'field.rawHtml', helpKey: 'field.rawHtmlHelp' },
    ],
  },
];

/** @type {Map<string, EditorBlockDef>} */
const registry = new Map(defs.map((def) => [def.type, def]));

/** パレットに並べる順（標準ブロック） */
export const PALETTE_BLOCKS = defs.map((def) => def.type);

/**
 * カスタムブロックの設定項目を、設定パネルの部品の指定にする
 * @param {readonly CustomField[]} fields
 * @returns {FieldSpec[]}
 */
function toFieldSpecs(fields) {
  /** @type {FieldSpec[]} */
  const specs = [];
  fields.forEach((field, index) => {
    const common = {
      labelKey: '',
      label: field.label,
      help: field.help,
      visible: field.visible,
    };
    const key = /** @type {string} */ (field.key);
    switch (field.kind) {
      case 'image':
        specs.push(
          { ...common, key: `${key}.src`, kind: 'image' },
          {
            key: `${key}.alt`,
            kind: 'text',
            labelKey: 'field.alt',
            visible: field.visible,
            options: { mergeTags: field.mergeTags ?? true },
          },
        );
        break;
      case 'list': {
        const itemFields = /** @type {CustomField[]} */ (field.fields);
        specs.push({
          ...common,
          key,
          kind: 'list',
          fields: toFieldSpecs(itemFields),
          itemDefault: () => defaultsOf(itemFields),
          itemLabel: field.itemLabel,
          options: { min: field.min, max: field.max },
        });
        break;
      }
      case 'action':
        specs.push({ ...common, key: `action:${index}`, kind: 'action', run: field.run });
        break;
      case 'element':
        specs.push({ ...common, key, kind: 'element', tagName: field.tagName });
        break;
      case 'toggle':
        specs.push({ ...common, key, kind: 'toggle', options: { on: true, off: false } });
        break;
      default:
        specs.push({
          ...common,
          key,
          kind: field.kind,
          options: {
            min: field.min,
            max: field.max,
            step: field.step,
            unit: field.unit,
            nullable: field.nullable,
            mergeTags: field.mergeTags,
            placeholder: field.placeholder,
            choices: field.choices?.map((c) => ({ value: c.value, labelKey: '', label: c.label })),
          },
        });
    }
  });
  return specs;
}

/** @type {WeakMap<CustomBlock, EditorBlockDef>} */
const customCache = new WeakMap();

/**
 * @param {CustomBlock} def
 * @returns {EditorBlockDef}
 */
function toEditorDef(def) {
  let edef = customCache.get(def);
  if (!edef) {
    edef = {
      type: def.type,
      labelKey: '',
      label: def.label,
      icon: def.icon ? unsafeSVG(def.icon) : icons.custom,
      fields: toFieldSpecs(def.fields),
      placeholderKey: 'placeholder.custom',
    };
    customCache.set(def, edef);
  }
  return edef;
}

/**
 * @param {string} type
 * @param {readonly CustomBlock[] | null} [blocks] カスタムブロックの定義
 * @returns {EditorBlockDef | undefined}
 */
export function getEditorBlockDef(type, blocks) {
  const builtin = registry.get(type);
  if (builtin) return builtin;
  const custom = blocks?.find((def) => def.type === type);
  return custom ? toEditorDef(custom) : undefined;
}

/**
 * パレットに並べるブロック（標準ブロックの後ろにカスタムブロック）
 * @param {readonly CustomBlock[] | null} [blocks]
 * @returns {string[]}
 */
export function paletteBlocks(blocks) {
  const custom = (blocks ?? []).map((def) => def.type).filter((type) => !registry.has(type));
  return [...PALETTE_BLOCKS, ...custom];
}

/**
 * ブロックの表示名
 * @param {EditorBlockDef} def
 * @param {{ t: Translate, locale: string }} ctx
 * @returns {string}
 */
export function blockLabel(def, ctx) {
  return def.label ? labelText(def.label, ctx.locale) : ctx.t(def.labelKey);
}
