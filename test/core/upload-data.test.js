import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createBlock,
  createRow,
  createTemplate,
  migrate,
  renderHtml,
} from '../../src/core/index.js';

/** @param {string} type @param {Record<string, unknown>} [values] */
function templateWith(type, values = {}) {
  const template = createTemplate();
  const block = createBlock(type, values);
  template.body.rows.push(createRow('1', [[block]]));
  return { template, blockId: block.id };
}

/** @param {import('../../src/core/index.js').Template} template */
const values = (template) => /** @type {any} */ (template.body.rows[0].columns[0].blocks[0].values);

describe('uploadData（アップロード時の任意のデータ）', () => {
  it('画像・画像＋テキスト・QR の既定値は null', () => {
    expect(values(templateWith('image').template).uploadData).toBeNull();
    expect(values(templateWith('imageText').template).image.uploadData).toBeNull();
    expect(values(templateWith('qr').template).uploadData).toBeNull();
  });

  it('JSON で表せるオブジェクトはそのまま保存し、出力には使わない', () => {
    const data = {
      id: 'img_123',
      path: 'uploads/a.png',
      size: 2048,
      tags: ['a', 'b'],
      meta: { w: 1 },
    };
    const { template } = templateWith('image', {
      src: 'https://cdn.example.com/a.png',
      uploadData: data,
    });
    const { template: loaded, warnings } = migrate(JSON.parse(JSON.stringify(template)));
    expect(warnings).toEqual([]);
    expect(values(loaded).uploadData).toEqual(data);
    expect(renderHtml(loaded)).not.toContain('img_123');
  });

  it('オブジェクト以外や JSON で表せない値は null に直して警告する', () => {
    for (const bad of ['text', 42, ['a'], { when: new Date() }, { n: Number.NaN }]) {
      const { template } = templateWith('image');
      values(template).uploadData = bad;
      const { template: fixed, warnings } = migrate(template);
      expect(values(fixed).uploadData).toBeNull();
      expect(warnings.map((w) => w.code)).toContain('invalid-value');
    }
  });

  it('パッチではマージせずに置き換える（前のデータのキーを残さない）', () => {
    const { template, blockId } = templateWith('image', { uploadData: { id: 'old', extra: 1 } });
    const next = applyCommand(template, {
      type: 'updateBlockValues',
      blockId,
      patch: { src: 'https://cdn.example.com/b.png', uploadData: { id: 'new' } },
    });
    expect(values(next).uploadData).toEqual({ id: 'new' });

    const cleared = applyCommand(next, {
      type: 'updateBlockValues',
      blockId,
      patch: { uploadData: null },
    });
    expect(values(cleared).uploadData).toBeNull();

    // 入れ子（画像＋テキストの image）でも同じ。ほかの項目は従来どおりマージする
    const withText = templateWith('imageText', {
      image: { alt: '写真', uploadData: { a: 1, b: 2 } },
    });
    const patched = applyCommand(withText.template, {
      type: 'updateBlockValues',
      blockId: withText.blockId,
      patch: { image: { src: 'https://cdn.example.com/c.png', uploadData: { c: 3 } } },
    });
    expect(values(patched).image).toMatchObject({
      alt: '写真',
      src: 'https://cdn.example.com/c.png',
      uploadData: { c: 3 },
    });
  });
});
