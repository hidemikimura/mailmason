// エディタ側のブロック定義（パレットの表示・設定パネルの項目・新規作成時の初期値）。
// コア側の定義（src/core/blocks）と type で結び付く
import { icons } from '../icons.js';

/** @import { FieldSpec } from '../fields/fields.js' */
/** @import { Translate } from '../i18n.js' */

/**
 * @typedef {Object} EditorBlockDef
 * @property {string} type
 * @property {string} labelKey
 * @property {unknown} icon
 * @property {FieldSpec[]} fields
 * @property {string} placeholderKey キャンバスで中身が空のときの表示
 * @property {(t: Translate) => Record<string, unknown>} [initialValues] パレットから追加したときの初期値
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

/** パレットに並べる順 */
export const PALETTE_BLOCKS = defs.map((def) => def.type);

/**
 * @param {string} type
 * @returns {EditorBlockDef | undefined}
 */
export function getEditorBlockDef(type) {
  return registry.get(type);
}
