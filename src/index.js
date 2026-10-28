// エディタのエントリ（@hidemikimura/mailmason）
// import すると <mailmason-editor> と <mm-text-input> を登録する。登録済みなら何もしない。
import { MailmasonEditor } from './editor/mailmason-editor.js';
import { MmTextInput } from './editor/components/mm-text-input.js';

export * from './core/index.js';
export { MailmasonEditor, MmTextInput };

/** @typedef {import('./editor/fields/fields.js').MergeTag} MergeTag */
/** @typedef {import('./editor/fields/fields.js').ImageSelectHook} ImageSelectHook */
/** @typedef {import('./editor/upload.js').ImageUploadHook} ImageUploadHook */
/** @typedef {import('./editor/upload.js').ImageResult} ImageResult */
/** @typedef {import('./editor/mailmason-editor.js').SaveComponentHook} SaveComponentHook */
/** @typedef {import('./editor/mailmason-editor.js').DeleteComponentHook} DeleteComponentHook */

if (!customElements.get('mailmason-editor')) {
  customElements.define('mailmason-editor', MailmasonEditor);
}
