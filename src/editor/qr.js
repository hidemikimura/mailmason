// QR コードの PNG をブラウザで作る（canvas）。できた PNG は onImageUpload でアップロードする
import qrcode from 'qrcode-generator';

/** @import { QrValues } from '../core/blocks/qr.js' */

/** PNG の解像度は表示サイズの 2 倍以上（高密度ディスプレイでもにじまないように） */
const PIXEL_RATIO = 2;
/** PNG の一辺の上限（px） */
const MAX_PIXELS = 1600;

export class QrTooLongError extends Error {
  constructor() {
    super('The content is too long for a QR code.');
    this.name = 'QrTooLongError';
  }
}

/**
 * 文字列を UTF-8 のバイト列にして、1 文字 1 バイトの文字列にする
 * （ライブラリの既定の変換は下位 8 ビットしか使わないため。全体の設定は変えない）
 * @param {string} text
 */
function utf8Binary(text) {
  let out = '';
  for (const byte of new TextEncoder().encode(text)) out += String.fromCharCode(byte);
  return out;
}

/**
 * QR のモジュール（黒白の升目）を作る
 * @param {string} content
 * @param {QrValues['ecLevel']} ecLevel
 * @returns {{ count: number, isDark: (row: number, col: number) => boolean }}
 */
export function qrModules(content, ecLevel) {
  const qr = qrcode(0, ecLevel);
  try {
    qr.addData(utf8Binary(content), 'Byte');
    qr.make();
  } catch {
    throw new QrTooLongError(); // 容量（型番 40）を超えた
  }
  return { count: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) };
}

/**
 * QR コードを canvas に描く（1 モジュール = 整数ピクセルで、にじませない）
 * @param {Pick<QrValues, 'content' | 'size' | 'ecLevel' | 'margin' | 'color' | 'backgroundColor'>} values
 * @returns {HTMLCanvasElement}
 */
export function drawQr(values) {
  const { count, isDark } = qrModules(values.content, values.ecLevel);
  const total = count + values.margin * 2;
  const scale = Math.max(
    1,
    Math.min(Math.ceil((values.size * PIXEL_RATIO) / total), Math.floor(MAX_PIXELS / total)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = total * scale;
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  g.fillStyle = values.backgroundColor;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = values.color;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (isDark(row, col)) {
        g.fillRect((col + values.margin) * scale, (row + values.margin) * scale, scale, scale);
      }
    }
  }
  return canvas;
}

/**
 * QR コードの PNG ファイルを作る
 * @param {Pick<QrValues, 'content' | 'size' | 'ecLevel' | 'margin' | 'color' | 'backgroundColor'>} values
 * @returns {Promise<File>}
 */
export async function createQrFile(values) {
  const canvas = drawQr(values);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
  return new File([blob], 'qr.png', { type: 'image/png' });
}
