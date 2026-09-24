/**
 * Mailmason が投げる例外。`code` で種類を判別する。
 */
export class MailmasonError extends Error {
  /**
   * @param {string} code 例: 'unsupported-version'
   * @param {string} message
   * @param {{ path?: string }} [options]
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'MailmasonError';
    this.code = code;
    this.path = options.path ?? null;
  }
}
