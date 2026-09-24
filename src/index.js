// エディタのエントリ（@hidemikimura/mailmason）
// import すると <mailmason-editor> を登録する。登録済みなら何もしない。
import { MailmasonEditor } from './editor/mailmason-editor.js';

export * from './core/index.js';
export { MailmasonEditor };

/** @typedef {import('./editor/fields/fields.js').MergeTag} MergeTag */
/** @typedef {import('./editor/fields/fields.js').ImageSelectHook} ImageSelectHook */

if (!customElements.get('mailmason-editor')) {
  customElements.define('mailmason-editor', MailmasonEditor);
}
