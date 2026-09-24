import { describe, expect, it } from 'vitest';
import {
  MailmasonError,
  TEMPLATE_VERSION,
  applyCommand,
  componentKindOf,
  createBlock,
  createRow,
  createTemplate,
  extractComponent,
  instantiateComponent,
  migrate,
} from '../../src/core/index.js';
import { customBlocks } from '../fixtures/custom-blocks.js';
import { loadFixture } from './helpers.js';

describe('コンポーネント（保存した行・ブロック）', () => {
  it('行とブロックを切り出す（中身は複製）', () => {
    const { template } = migrate(loadFixture('basic'));
    const row = template.body.rows[2];
    const rowComponent = /** @type {any} */ (
      extractComponent(template, row.id, { name: ' 商品 2 列 ' })
    );
    expect(rowComponent).toMatchObject({
      name: '商品 2 列',
      kind: 'row',
      version: TEMPLATE_VERSION,
    });
    expect(rowComponent.content).toEqual(row);
    expect(rowComponent.content).not.toBe(row);

    const block = template.body.rows[1].columns[0].blocks[1];
    expect(extractComponent(template, block.id, { name: 'ボタン' })).toMatchObject({
      kind: 'block',
      content: block,
    });
    expect(
      extractComponent(template, template.body.rows[0].columns[0].id, { name: 'x' }),
    ).toBeNull();
    expect(componentKindOf(template, row.id)).toBe('row');
    expect(componentKindOf(template, block.id)).toBe('block');
    expect(componentKindOf(template, row.columns[0].id)).toBeNull();
    expect(componentKindOf(template, null)).toBeNull();
  });

  it('挿入するときは ID を振り直し、同じテンプレートに何度でも入れられる', () => {
    const { template } = migrate(loadFixture('basic'));
    const row = template.body.rows[2];
    const component = /** @type {any} */ (extractComponent(template, row.id, { name: '商品' }));
    // JSON で保存・読み込みしても使える
    const saved = JSON.parse(JSON.stringify({ ...component, id: 'cmp_1' }));
    const a = /** @type {any} */ (instantiateComponent(saved));
    const b = /** @type {any} */ (instantiateComponent(saved));
    expect(a.kind).toBe('row');
    expect(a.warnings).toEqual([]);
    expect(a.row.id).not.toBe(row.id);
    expect(a.row.id).not.toBe(b.row.id);
    expect(a.row.columns[0].blocks[0].id).not.toBe(row.columns[0].blocks[0].id);
    expect(a.row.columns[0].blocks[0].values).toEqual(row.columns[0].blocks[0].values);

    let next = applyCommand(template, { type: 'addRow', row: a.row });
    next = applyCommand(next, { type: 'addRow', row: b.row });
    expect(next.body.rows).toHaveLength(template.body.rows.length + 2);
  });

  it('ブロックのコンポーネントは 1 つのブロックになる', () => {
    const template = createTemplate();
    const block = createBlock('button', {
      label: '詳しく見る',
      href: 'https://example.com/{{id}}',
    });
    template.body.rows.push(createRow('1', [[block]]));
    const component = /** @type {any} */ (extractComponent(template, block.id, { name: 'CTA' }));
    const result = /** @type {any} */ (instantiateComponent(component));
    expect(result.kind).toBe('block');
    expect(result.block.type).toBe('button');
    expect(result.block.values).toEqual(block.values);
    expect(result.block.id).not.toBe(block.id);
  });

  it('中身は読み込み時と同じように整え、警告を返す', () => {
    const result = /** @type {any} */ (
      instantiateComponent({
        name: '古い',
        kind: 'block',
        version: 1,
        content: { id: 'b_x', type: 'button', values: { label: 'OK', fontSize: 999, extra: 1 } },
      })
    );
    expect(result.block.values.fontSize).toBeLessThanOrEqual(72);
    expect(result.warnings.map((/** @type {any} */ w) => w.code).sort()).toEqual([
      'invalid-value',
      'unknown-key',
    ]);
  });

  it('カスタムブロックは blocks を渡すと整える', () => {
    const template = createTemplate();
    const block = createBlock('acme-coupon', { code: 'X1' }, { blocks: customBlocks });
    template.body.rows.push(createRow('1', [[block]]));
    const component = /** @type {any} */ (
      extractComponent(template, block.id, { name: 'クーポン' })
    );
    delete component.content.values.title;
    const withDefs = /** @type {any} */ (instantiateComponent(component, { blocks: customBlocks }));
    expect(withDefs.block.values).toMatchObject({ code: 'X1', title: '期間限定クーポン' });
    const without = /** @type {any} */ (instantiateComponent(component));
    expect(without.warnings.map((/** @type {any} */ w) => w.code)).toEqual(['unknown-block-type']);
  });

  it('形の違うものや新しいバージョンは例外', () => {
    const bad = [
      null,
      {},
      { kind: 'row' },
      { kind: 'column', content: {} },
      { kind: 'row', content: [] },
    ];
    for (const value of bad) expect(() => instantiateComponent(value)).toThrow(MailmasonError);
    expect(() =>
      instantiateComponent({
        kind: 'row',
        version: TEMPLATE_VERSION + 1,
        content: { layout: '1' },
      }),
    ).toThrow(/newer/);
  });
});
