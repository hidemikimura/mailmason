// 変化の検出に使うハッシュ（暗号用途ではない）

/**
 * FNV-1a（32bit）
 * @param {string} value
 * @returns {string} 8 桁の 16 進数
 */
export function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
