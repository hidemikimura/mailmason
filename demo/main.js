import { migrate } from '../src/index.js';
import basic from '../test/fixtures/templates/basic.json';
import kitchenSink from '../test/fixtures/templates/kitchen-sink.json';

/** @type {Record<string, unknown>} */
const fixtures = { basic, 'kitchen-sink': kitchenSink };

const editor = /** @type {import('../src/index.js').MailmasonEditor} */ (
  document.querySelector('mailmason-editor')
);
const select = /** @type {HTMLSelectElement} */ (document.querySelector('#fixture'));

editor.mergeTags = [
  { key: 'name', label: '氏名', sample: '山田 太郎' },
  { key: 'unsubscribe_url', label: '配信停止 URL', sample: 'https://example.com/unsubscribe' },
];
// 画像の「選択…」ボタン。実際のアプリではアップロード画面などを開いて URL を返す
editor.onImageSelect = async ({ current }) => window.prompt('画像の URL', current) ?? null;

/** プレビュー用のサンプル値 */
const mergeValues = Object.fromEntries(editor.mergeTags.map((tag) => [tag.key, tag.sample ?? '']));

/**
 * @param {string} content
 * @param {string} type
 */
function openBlob(content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

editor.addEventListener('mm-ready', () => console.log('[demo] mm-ready'));
editor.addEventListener('mm-change', (e) =>
  console.log('[demo] mm-change', /** @type {CustomEvent} */ (e).detail.actions),
);
editor.addEventListener('mm-select', (e) =>
  console.log('[demo] mm-select', /** @type {CustomEvent} */ (e).detail),
);
editor.addEventListener('mm-warning', (e) =>
  console.warn('[demo] mm-warning', /** @type {CustomEvent} */ (e).detail),
);

document.querySelector('#load')?.addEventListener('click', () => {
  editor.loadJson(fixtures[select.value]);
});

document.querySelector('#open-html')?.addEventListener('click', () => {
  openBlob(editor.exportHtml({ mergeValues }), 'text/html;charset=utf-8');
});

document.querySelector('#open-text')?.addEventListener('click', () => {
  openBlob(editor.exportText({ mergeValues }), 'text/plain;charset=utf-8');
});

document.querySelector('#log-json')?.addEventListener('click', () => {
  console.log(editor.getJson());
});

document.querySelector('#color-mode')?.addEventListener('change', (e) => {
  editor.colorMode = /** @type {HTMLSelectElement} */ (e.target).value;
});

// 起動時に basic を読み込んでおく
editor.loadJson(migrate(basic).template);
