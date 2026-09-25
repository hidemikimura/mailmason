// エディタ側のブロック定義（パレットの表示・設定パネルの項目・新規作成時の初期値）。
// コア側の定義（src/core/blocks）と type で結び付く
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { icons } from '../icons.js';
import { defaultsOf, labelText } from '../../core/blocks/custom.js';
import { defaultGalleryItem } from '../../core/blocks/gallery.js';
import { defaultButtonItem } from '../../core/blocks/buttons.js';
import { defaultMenuItem } from '../../core/blocks/menu.js';

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

/** @type {import('../fields/fields.js').Choice[]} */
const FONT_WEIGHTS = [
  { value: 'normal', labelKey: 'fontWeight.normal' },
  { value: 'bold', labelKey: 'fontWeight.bold' },
];

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
        key: 'mobileFontSize',
        kind: 'number',
        labelKey: 'field.mobileFontSize',
        helpKey: 'field.mobileFontSizeHelp',
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
        kind: 'fontFamily',
        labelKey: 'field.fontFamily',
        options: { nullable: true },
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
        key: 'mobileFontSize',
        kind: 'number',
        labelKey: 'field.mobileFontSize',
        helpKey: 'field.mobileFontSizeFixedHelp',
        options: { min: 8, max: 72, unit: 'px', nullable: true },
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
    type: 'gallery',
    labelKey: 'block.gallery',
    icon: icons.gallery,
    placeholderKey: 'placeholder.gallery',
    initialValues: () => ({ items: Array.from({ length: 4 }, defaultGalleryItem) }),
    fields: [
      {
        key: 'items',
        kind: 'list',
        labelKey: 'field.galleryItems',
        itemLabel: (item, i, t) => `${t?.('item.image') ?? ''} ${i + 1}`,
        itemDefault: defaultGalleryItem,
        options: { max: 12 },
        fields: [
          { key: 'image.src', kind: 'image', labelKey: 'field.src', options: { mergeTags: true } },
          { key: 'image.alt', kind: 'text', labelKey: 'field.alt', options: { mergeTags: true } },
          { key: 'href', kind: 'url', labelKey: 'field.href', options: { mergeTags: true } },
        ],
      },
      {
        key: 'columns',
        kind: 'align',
        labelKey: 'field.galleryColumns',
        options: {
          choices: ['2', '3', '4'].map((value) => ({ value, labelKey: `galleryColumns.${value}` })),
        },
      },
      {
        key: 'gap',
        kind: 'number',
        labelKey: 'field.gap',
        options: { min: 0, max: 40, unit: 'px' },
      },
      { key: 'stackOnMobile', kind: 'toggle', labelKey: 'field.galleryStack' },
    ],
  },
  {
    type: 'video',
    labelKey: 'block.video',
    icon: icons.video,
    placeholderKey: 'placeholder.video',
    fields: [
      {
        key: 'url',
        kind: 'videoUrl',
        labelKey: 'field.videoUrl',
        helpKey: 'field.videoUrlHelp',
        options: { mergeTags: true },
      },
      {
        key: 'thumbnail.src',
        kind: 'image',
        labelKey: 'field.thumbnail',
        options: { mergeTags: false },
      },
      {
        key: 'thumbnail.alt',
        kind: 'text',
        labelKey: 'field.alt',
        options: { mergeTags: true },
      },
      {
        key: 'playButton',
        kind: 'select',
        labelKey: 'field.playButton',
        options: {
          choices: [
            { value: 'dark', labelKey: 'playButton.dark' },
            { value: 'light', labelKey: 'playButton.light' },
            { value: 'none', labelKey: 'playButton.none' },
          ],
        },
      },
      {
        key: 'ratio',
        kind: 'align',
        labelKey: 'field.videoRatio',
        visible: (v) => v.playButton !== 'none',
        options: {
          choices: ['16:9', '4:3', '1:1'].map((value) => ({ value, labelKey: '', label: value })),
        },
      },
      { key: 'width', kind: 'imageWidth', labelKey: 'field.width' },
      { key: 'align', kind: ALIGN, labelKey: 'field.align' },
    ],
  },
  {
    type: 'buttons',
    labelKey: 'block.buttons',
    icon: icons.buttons,
    placeholderKey: 'placeholder.buttons',
    initialValues: (t) => ({
      items: [
        { ...defaultButtonItem(), label: `${t('initial.button')} 1` },
        {
          ...defaultButtonItem(),
          label: `${t('initial.button')} 2`,
          backgroundColor: '#e5e7eb',
          color: '#111827',
        },
      ],
    }),
    fields: [
      {
        key: 'items',
        kind: 'list',
        labelKey: 'field.buttonItems',
        itemLabel: (item, i, t) => String(item.label || `${t?.('item.button') ?? ''} ${i + 1}`),
        itemDefault: defaultButtonItem,
        options: { max: 4 },
        fields: [
          { key: 'label', kind: 'text', labelKey: 'field.label', options: { mergeTags: true } },
          { key: 'href', kind: 'url', labelKey: 'field.href', options: { mergeTags: true } },
          { key: 'backgroundColor', kind: 'color', labelKey: 'field.buttonColor' },
          { key: 'color', kind: 'color', labelKey: 'field.textColor' },
        ],
      },
      {
        key: 'fontSize',
        kind: 'number',
        labelKey: 'field.fontSize',
        options: { min: 8, max: 72, unit: 'px' },
      },
      {
        key: 'mobileFontSize',
        kind: 'number',
        labelKey: 'field.mobileFontSize',
        helpKey: 'field.mobileFontSizeFixedHelp',
        options: { min: 8, max: 72, unit: 'px', nullable: true },
      },
      {
        key: 'fontWeight',
        kind: 'select',
        labelKey: 'field.fontWeight',
        options: { choices: FONT_WEIGHTS },
      },
      {
        key: 'borderRadius',
        kind: 'number',
        labelKey: 'field.borderRadius',
        options: { min: 0, max: 100, unit: 'px' },
      },
      { key: 'innerPadding', kind: 'spacing', labelKey: 'field.innerPadding' },
      {
        key: 'gap',
        kind: 'number',
        labelKey: 'field.buttonGap',
        options: { min: 0, max: 60, unit: 'px' },
      },
      { key: 'equalWidth', kind: 'toggle', labelKey: 'field.equalWidth' },
      { key: 'stackOnMobile', kind: 'toggle', labelKey: 'field.stackOnMobile' },
      { key: 'align', kind: ALIGN, labelKey: 'field.align', visible: (v) => !v.equalWidth },
    ],
  },
  {
    type: 'menu',
    labelKey: 'block.menu',
    icon: icons.menu,
    placeholderKey: 'placeholder.menu',
    initialValues: (t) => ({
      items: [1, 2, 3].map((n) => ({ label: `${t('initial.menu')} ${n}`, href: '' })),
    }),
    fields: [
      {
        key: 'items',
        kind: 'list',
        labelKey: 'field.menuItems',
        itemLabel: (item, i, t) => String(item.label || `${t?.('list.item') ?? ''} ${i + 1}`),
        itemDefault: defaultMenuItem,
        options: { max: 10 },
        fields: [
          { key: 'label', kind: 'text', labelKey: 'field.label', options: { mergeTags: true } },
          { key: 'href', kind: 'url', labelKey: 'field.href', options: { mergeTags: true } },
        ],
      },
      { key: 'separator', kind: 'text', labelKey: 'field.separator' },
      {
        key: 'spacing',
        kind: 'number',
        labelKey: 'field.menuSpacing',
        options: { min: 0, max: 60, unit: 'px' },
      },
      {
        key: 'fontSize',
        kind: 'number',
        labelKey: 'field.fontSize',
        options: { min: 8, max: 72, unit: 'px' },
      },
      {
        key: 'mobileFontSize',
        kind: 'number',
        labelKey: 'field.mobileFontSize',
        helpKey: 'field.mobileFontSizeFixedHelp',
        options: { min: 8, max: 72, unit: 'px', nullable: true },
      },
      {
        key: 'fontWeight',
        kind: 'select',
        labelKey: 'field.fontWeight',
        options: { choices: FONT_WEIGHTS },
      },
      { key: 'color', kind: 'color', labelKey: 'field.textColor', options: { nullable: true } },
      { key: 'separatorColor', kind: 'color', labelKey: 'field.separatorColor' },
      { key: 'underline', kind: 'toggle', labelKey: 'field.underline' },
      { key: 'align', kind: ALIGN, labelKey: 'field.align' },
    ],
  },
  {
    type: 'table',
    labelKey: 'block.table',
    icon: icons.table,
    placeholderKey: 'placeholder.table',
    initialValues: (t) => ({
      cells: [
        [t('initial.tableHeader1'), t('initial.tableHeader2')],
        ['', ''],
        ['', ''],
      ],
    }),
    fields: [
      { key: 'cells', kind: 'tableInfo', labelKey: 'field.tableCells' },
      { key: 'columns', kind: 'tableColumns', labelKey: 'field.tableColumns' },
      { key: 'headerRow', kind: 'toggle', labelKey: 'field.headerRow' },
      {
        key: 'headerBackgroundColor',
        kind: 'color',
        labelKey: 'field.headerBackgroundColor',
        visible: (v) => v.headerRow,
      },
      {
        key: 'headerColor',
        kind: 'color',
        labelKey: 'field.headerColor',
        visible: (v) => v.headerRow,
        options: { nullable: true },
      },
      { key: 'striped', kind: 'toggle', labelKey: 'field.striped' },
      {
        key: 'stripeColor',
        kind: 'color',
        labelKey: 'field.stripeColor',
        visible: (v) => v.striped,
      },
      {
        key: 'borderWidth',
        kind: 'number',
        labelKey: 'field.borderWidth',
        options: { min: 0, max: 8, unit: 'px' },
      },
      {
        key: 'borderColor',
        kind: 'color',
        labelKey: 'field.borderColor',
        visible: (v) => v.borderWidth > 0,
      },
      {
        key: 'cellPadding',
        kind: 'number',
        labelKey: 'field.cellPadding',
        options: { min: 0, max: 40, unit: 'px' },
      },
      {
        key: 'fontSize',
        kind: 'number',
        labelKey: 'field.fontSize',
        options: { min: 8, max: 72, unit: 'px', nullable: true },
      },
      {
        key: 'mobileFontSize',
        kind: 'number',
        labelKey: 'field.mobileFontSize',
        helpKey: 'field.mobileFontSizeHelp',
        options: { min: 8, max: 72, unit: 'px', nullable: true },
      },
      { key: 'color', kind: 'color', labelKey: 'field.textColor', options: { nullable: true } },
      {
        key: 'mobileLayout',
        kind: 'align',
        labelKey: 'field.tableMobileLayout',
        helpKey: 'field.tableMobileLayoutHelp',
        options: {
          choices: [
            { value: 'table', labelKey: 'tableMobileLayout.table' },
            { value: 'stack', labelKey: 'tableMobileLayout.stack' },
          ],
        },
      },
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
