// デモで読み込むテンプレート。画像はドキュメントサイトに置いたサンプル画像に差し替える
import basic from '../../../test/fixtures/templates/basic.json';
import kitchenSink from '../../../test/fixtures/templates/kitchen-sink.json';
import newsletter from '../../../skills/mailmason-templates/examples/newsletter.json';
import announcement from '../../../skills/mailmason-templates/examples/announcement.json';

export const DEMO_TEMPLATES = [
  { id: 'newsletter', label: 'メールマガジン', template: newsletter },
  { id: 'basic', label: '新作のお知らせ', template: basic },
  { id: 'announcement', label: 'メンテナンスのお知らせ', template: announcement },
  { id: 'kitchen-sink', label: '全ブロック', template: kitchenSink },
  { id: 'empty', label: '白紙', template: null },
];

/**
 * example.com の画像 URL をサンプル画像に置き換えた複製を返す
 * @param {unknown} template
 * @param {string} base サンプル画像のフォルダの URL（末尾 /）
 */
export function withDemoImages(template, base) {
  const json = JSON.stringify(template).replace(
    /https:\/\/example\.com\/images\/([\w-]+)\.(?:png|jpe?g)/g,
    (_, name) => `${base}${name}.svg`,
  );
  return JSON.parse(json);
}

export const DEMO_MERGE_TAGS = [
  { key: 'name', label: '氏名', sample: '山田 太郎', fallback: 'お客様' },
  { key: 'unsubscribe_url', label: '配信停止 URL', sample: 'https://example.com/unsubscribe' },
  { key: 'coupon', label: 'クーポンコード', sample: 'AUTUMN2026' },
];
