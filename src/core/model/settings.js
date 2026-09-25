// ボディ・行・カラム・ブロック共通スタイルの既定値とスキーマ
import { s } from './schema.js';
import { ROW_LAYOUT_NAMES } from './layout.js';

/** @import { BodySettings, RowSettings, Column, Block } from './types.js' */

/**
 * @param {number} [value]
 * @returns {import('./types.js').Spacing}
 */
export function spacing(value = 0) {
  return { top: value, right: value, bottom: value, left: value };
}

/** 背景画像の位置（横 縦） */
export const BACKGROUND_POSITIONS = /** @type {const} */ ([
  'left top',
  'center top',
  'right top',
  'left center',
  'center center',
  'right center',
  'left bottom',
  'center bottom',
  'right bottom',
]);

/**
 * 背景画像の既定値（src が空なら背景画像なし）
 * @returns {import('./types.js').BackgroundImage}
 */
export function defaultBackgroundImage() {
  return {
    src: '',
    size: 'cover',
    position: 'center center',
    repeat: 'no-repeat',
    uploadData: null,
  };
}

export const backgroundImageSchema = s.object({
  src: s.string(),
  size: s.oneOf(['cover', 'contain', 'auto']),
  position: s.oneOf(BACKGROUND_POSITIONS),
  repeat: s.oneOf(['no-repeat', 'repeat']),
  uploadData: s.record({ nullable: true }),
});

/** @returns {BodySettings} */
export function defaultBodySettings() {
  return {
    width: 600,
    backgroundColor: '#f4f4f4',
    backgroundImage: defaultBackgroundImage(),
    contentBackgroundColor: '#ffffff',
    contentBackgroundImage: defaultBackgroundImage(),
    fontFamily: "'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
    fontSize: 16,
    lineHeight: 1.6,
    textColor: '#333333',
    linkColor: '#0066cc',
    preheader: '',
    title: '',
  };
}

export const bodySettingsSchema = s.object({
  width: s.number({ min: 320, max: 1200, integer: true }),
  backgroundColor: s.color(),
  backgroundImage: backgroundImageSchema,
  contentBackgroundColor: s.color(),
  contentBackgroundImage: backgroundImageSchema,
  fontFamily: s.string(),
  fontSize: s.number({ min: 8, max: 72 }),
  lineHeight: s.number({ min: 0.8, max: 3 }),
  textColor: s.color(),
  linkColor: s.color(),
  preheader: s.string(),
  title: s.string(),
});

/** @returns {RowSettings} */
export function defaultRowSettings() {
  return {
    backgroundColor: null,
    backgroundImage: defaultBackgroundImage(),
    padding: spacing(0),
    columnGap: 16,
    stackOnMobile: true,
    hideOn: null,
  };
}

export const rowSettingsSchema = s.object({
  backgroundColor: s.color({ nullable: true }),
  backgroundImage: backgroundImageSchema,
  padding: s.spacing(),
  columnGap: s.number({ min: 0, max: 200, integer: true }),
  stackOnMobile: s.boolean(),
  hideOn: s.oneOf(['mobile', null]),
});

/** @returns {Column['settings']} */
export function defaultColumnSettings() {
  return {
    backgroundColor: null,
    backgroundImage: defaultBackgroundImage(),
    padding: spacing(0),
    verticalAlign: 'top',
  };
}

export const columnSettingsSchema = s.object({
  backgroundColor: s.color({ nullable: true }),
  backgroundImage: backgroundImageSchema,
  padding: s.spacing(),
  verticalAlign: s.oneOf(['top', 'middle', 'bottom']),
});

/** @returns {Block['style']} */
export function defaultBlockStyle() {
  return { backgroundColor: null, padding: spacing(10) };
}

export const blockStyleSchema = s.object({
  backgroundColor: s.color({ nullable: true }),
  padding: s.spacing(),
});

export const hideOnSchema = s.oneOf(['mobile', null]);

export const layoutSchema = s.oneOf(ROW_LAYOUT_NAMES);

export const textPartSchema = s.object({
  mode: s.oneOf(['auto', 'manual']),
  content: s.string({ nullable: true }),
  sourceHash: s.string({ nullable: true }),
});
