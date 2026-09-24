import { describe, expect, it } from 'vitest';
import {
  MailmasonError,
  applyCommand,
  createBlock,
  createRow,
  createStore,
  createTemplate,
  defineBlock,
  findMergeTags,
  migrate,
  renderHtml,
  renderText,
  resolveTextPart,
  validate,
} from '../../src/core/index.js';
import { couponBlock, customBlocks, productListBlock } from '../fixtures/custom-blocks.js';

const blocks = customBlocks;

/** @param {string} type @param {Record<string, unknown>} [values] */
function templateWith(type, values = {}) {
  const template = createTemplate();
  const block = createBlock(type, values, { blocks });
  template.body.rows.push(createRow('1', [[block]]));
  return { template, blockId: block.id };
}

/** @param {import('../../src/core/index.js').Template} template */
const values = (template) => /** @type {any} */ (template.body.rows[0].columns[0].blocks[0].values);

describe('defineBlock', () => {
  it('設定項目から既定値を作る', () => {
    expect(couponBlock.defaults()).toEqual({
      title: '期間限定クーポン',
      code: 'AUTUMN2026',
      note: '',
      color: '#e8590c',
      url: '',
    });
    const products = /** @type {any} */ (productListBlock.defaults());
    expect(products.columns).toBe('2');
    expect(products.items).toEqual([
      {
        image: { src: '', alt: '', naturalWidth: null, naturalHeight: null, uploadData: null },
        name: 'ニット',
        price: 0,
        url: '',
      },
    ]);
    expect(products).not.toHaveProperty('undefined'); // action は値を持たない
  });

  it('不正な定義は invalid-block-definition で止める', () => {
    const base = { label: 'x', fields: [], renderHtml: () => '' };
    const bad = [
      { ...base, type: 'coupon' }, // ハイフンが無い
      { ...base, type: 'Acme-Coupon' },
      { ...base, type: 'image' },
      { ...base, type: 'acme-x', label: '' },
      { ...base, type: 'acme-x', renderHtml: undefined },
      { ...base, type: 'acme-x', fields: [{ kind: 'text', label: 'a' }] }, // key が無い
      { ...base, type: 'acme-x', fields: [{ key: 'a', kind: 'rich', label: 'a' }] },
      {
        ...base,
        type: 'acme-x',
        fields: [
          { key: 'a', kind: 'text', label: 'a' },
          { key: 'a', kind: 'url', label: 'b' },
        ],
      },
      { ...base, type: 'acme-x', fields: [{ key: 'a', kind: 'select', label: 'a' }] },
      { ...base, type: 'acme-x', fields: [{ kind: 'action', label: 'a' }] },
      {
        ...base,
        type: 'acme-x',
        fields: [{ key: 'a', kind: 'element', label: 'a', tagName: 'div' }],
      },
    ];
    for (const def of bad) {
      expect(() => defineBlock(/** @type {any} */ (def))).toThrow(MailmasonError);
    }
  });
});

describe('カスタムブロックの出力', () => {
  it('blocks を渡すと定義の関数で HTML とテキストを出す（差し込み変数も置き換わる）', () => {
    const { template } = templateWith('acme-coupon', {
      title: '{{name}} 様へ <特別>',
      note: '1 回限り\n他と併用不可',
      url: 'https://example.com/c?u={{name}}',
    });
    const html = renderHtml(template, { blocks, mergeValues: { name: '山田' } });
    expect(html).toContain('山田 様へ &lt;特別&gt;');
    expect(html).toContain('1 回限り<br />他と併用不可');
    expect(html).toContain('AUTUMN2026');
    expect(html).toContain('href="https://example.com/c?u=山田"');
    expect(html).toContain('<v:roundrect'); // ボタンは Outlook 用の VML 付き
    expect(renderText(template, { blocks })).toContain('{{name}} 様へ <特別>: AUTUMN2026');
    expect(resolveTextPart(template, { blocks, mergeValues: { name: '山田' } }).text).toContain(
      '山田 様へ',
    );
  });

  it('blocks を渡さなければ未知のブロックとして出力せず、データは残す', () => {
    const { template } = templateWith('acme-coupon');
    const html = renderHtml(template);
    expect(html).not.toContain('AUTUMN2026');
    const { template: loaded, warnings } = migrate(template);
    expect(warnings.map((w) => w.code)).toEqual(['unknown-block-type']);
    expect(values(loaded).code).toBe('AUTUMN2026');
    expect(validate(template, { blocks }).valid).toBe(true);
  });

  it('読み込み時に設定項目のスキーマで値を直す（リストの中も）', () => {
    const { template } = templateWith('acme-products');
    const v = values(template);
    v.columns = '5';
    v.items.push({ name: 'コート', price: -3, extra: 1 });
    const { template: fixed, warnings } = migrate(template, { blocks });
    const items = values(fixed).items;
    expect(values(fixed).columns).toBe('2');
    expect(items[1]).toMatchObject({ name: 'コート', price: 0, url: '' });
    expect(items[1]).not.toHaveProperty('extra');
    expect(warnings.map((w) => w.code).sort()).toEqual([
      'invalid-value',
      'invalid-value',
      'unknown-key',
    ]);
  });

  it('リストや画像の中の差し込み変数も列挙する', () => {
    const { template } = templateWith('acme-products', {
      items: [{ name: '{{item1}}', image: { src: 'https://cdn/{{sku}}.png', alt: '' } }],
    });
    const found = findMergeTags(template, { blocks }).map((u) => `${u.field}:${u.key}`);
    expect(found).toEqual(['items[].image.src:sku', 'items[].name:item1']);
    // blocks を渡さなければ定義が分からないので対象外
    expect(findMergeTags(template)).toEqual([]);
  });

  it('ストアとコマンドで追加・更新できる', () => {
    const template = createTemplate();
    template.body.rows.push(createRow('1'));
    const columnId = template.body.rows[0].columns[0].id;
    expect(() =>
      applyCommand(template, { type: 'addBlock', columnId, blockType: 'acme-coupon' }),
    ).toThrow(MailmasonError);
    const store = createStore(template, { blocks: () => blocks });
    store.dispatch({
      type: 'addBlock',
      columnId,
      blockType: 'acme-coupon',
      values: { code: 'X1' },
    });
    const block = store.getState().template.body.rows[0].columns[0].blocks[0];
    expect(block.values).toMatchObject({ code: 'X1', title: '期間限定クーポン' });
    store.dispatch({ type: 'updateBlockValues', blockId: block.id, patch: { color: 'red' } });
    expect(
      /** @type {any} */ (store.getState().template.body.rows[0].columns[0].blocks[0].values).color,
    ).toBe('#e8590c');
  });

  it('標準ブロックの type（ハイフンが無い）とは重ならない', () => {
    expect(() =>
      defineBlock({ type: 'text', label: 'x', fields: [], renderHtml: () => '' }),
    ).toThrow(MailmasonError);
  });
});
