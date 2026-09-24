import { describe, expect, it } from 'vitest';
import { computeLayout, createRow, createTemplate } from '../../src/core/index.js';

/**
 * @param {import('../../src/core/model/types.js').RowLayout} layout
 * @param {Partial<import('../../src/core/model/types.js').RowSettings>} [settings]
 */
function layoutOf(layout, settings = {}) {
  const template = createTemplate();
  const row = createRow(layout);
  Object.assign(row.settings, settings);
  template.body.rows.push(row);
  return /** @type {import('../../src/core/model/layout.js').RowBox} */ (
    computeLayout(template).get(row.id)
  );
}

describe('computeLayout', () => {
  it('1 カラムは行の内容幅そのまま', () => {
    const box = layoutOf('1', { padding: { top: 0, right: 24, bottom: 0, left: 24 } });
    expect(box.contentWidth).toBe(552);
    expect(box.columns[0]).toMatchObject({
      outerWidth: 552,
      contentWidth: 552,
      gapLeft: 0,
      gapRight: 0,
    });
  });

  it('隙間を除いた幅を均等に配分し、隙間は内側だけに付ける', () => {
    const box = layoutOf('1:1:1', { columnGap: 20 });
    expect(box.columns.map((c) => c.contentWidth)).toEqual([186, 186, 188]);
    expect(box.columns.map((c) => [c.gapLeft, c.gapRight])).toEqual([
      [0, 10],
      [10, 10],
      [10, 0],
    ]);
    expect(box.columns.reduce((sum, c) => sum + c.outerWidth, 0)).toBe(600);
  });

  it('奇数の隙間でも合計がずれない', () => {
    const box = layoutOf('1:2', { columnGap: 15 });
    expect(box.columns.reduce((sum, c) => sum + c.outerWidth, 0)).toBe(600);
    expect(box.columns[0].gapRight + box.columns[1].gapLeft).toBe(15);
  });

  it('カラムの余白を内容幅から引く', () => {
    const template = createTemplate();
    const row = createRow('1:1');
    row.columns[0].settings.padding = { top: 0, right: 10, bottom: 0, left: 10 };
    template.body.rows.push(row);
    const box = computeLayout(template).get(row.id);
    expect(box?.columns[0].contentWidth).toBe(272);
    expect(box?.columns[1].contentWidth).toBe(292);
  });
});
