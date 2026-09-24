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

/** @returns {BodySettings} */
export function defaultBodySettings() {
  return {
    width: 600,
    backgroundColor: '#f4f4f4',
    contentBackgroundColor: '#ffffff',
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
  contentBackgroundColor: s.color(),
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
    padding: spacing(0),
    columnGap: 16,
    stackOnMobile: true,
    hideOn: null,
  };
}

export const rowSettingsSchema = s.object({
  backgroundColor: s.color({ nullable: true }),
  padding: s.spacing(),
  columnGap: s.number({ min: 0, max: 200, integer: true }),
  stackOnMobile: s.boolean(),
  hideOn: s.oneOf(['mobile', null]),
});

/** @returns {Column['settings']} */
export function defaultColumnSettings() {
  return { backgroundColor: null, padding: spacing(0), verticalAlign: 'top' };
}

export const columnSettingsSchema = s.object({
  backgroundColor: s.color({ nullable: true }),
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
