// 表ブロックのセルの結合・行と列の並べ替え・スマホの縦並び
import { describe, expect, it } from 'vitest';
import {
  createBlock,
  createRow,
  createTemplate,
  migrate,
  renderHtml,
  renderText,
  validate,
} from '../../src/core/index.js';
import { stackItems, tableOps } from '../../src/core/blocks/table.js';
import {
  expandRange,
  isCovered,
  lineGroup,
  moveLines,
  normalizeMerges,
  rangeBetween,
} from '../../src/core/blocks/table-layout.js';

const COLUMNS = [
  { width: null, align: 'left' },
  { width: null, align: 'left' },
  { width: null, align: 'left' },
];

/** 料金表: 左の列の 2 行を縦に結合、最後の行の右 2 列を横に結合 */
const PRICE = {
  cells: [
    ['プラン', '月額', '年額'],
    ['ライト', '500円', '5,000円'],
    ['', '1,000円', '10,000円'],
    ['注記', '全プラン税込', ''],
  ],
  columns: COLUMNS,
  merges: [
    { row: 1, column: 0, rowSpan: 2, colSpan: 1 },
    { row: 3, column: 1, rowSpan: 1, colSpan: 2 },
  ],
};

/** @param {Record<string, unknown>} values */
function render(values) {
  const template = createTemplate();
  template.body.rows.push(createRow('1', [[createBlock('table', values)]]));
  return { html: renderHtml(template), text: renderText(template), template };
}

/** @param {string} html */
const desktopTable = (html) =>
  html.slice(html.indexOf('<table class="mm-table'), html.indexOf('</table>'));

describe('表: セルの結合（計算）', () => {
  it('結合を表の大きさに収め、重なり・1 セル・範囲外を除いて左上から並べる', () => {
    expect(
      normalizeMerges(
        [
          { row: 2, column: 0, rowSpan: 5, colSpan: 1 },
          { row: 0, column: 0, rowSpan: 1, colSpan: 9 },
          { row: 0, column: 1, rowSpan: 2, colSpan: 1 }, // 上と重なる
          { row: 1, column: 1, rowSpan: 1, colSpan: 1 }, // 1 セル
          { row: 9, column: 0, rowSpan: 2, colSpan: 1 }, // 範囲外
        ],
        4,
        3,
      ),
    ).toEqual([
      { row: 0, column: 0, rowSpan: 1, colSpan: 3 },
      { row: 2, column: 0, rowSpan: 2, colSpan: 1 },
    ]);
  });

  it('選択範囲は、かかる結合を含むまで広げる', () => {
    const merges = [
      { row: 1, column: 1, rowSpan: 2, colSpan: 2 },
      { row: 2, column: 3, rowSpan: 2, colSpan: 1 },
    ];
    expect(expandRange(merges, { row: 0, column: 2, rowSpan: 2, colSpan: 1 })).toEqual({
      row: 0,
      column: 1,
      rowSpan: 3,
      colSpan: 2,
    });
    // 広げた先で別の結合にかかれば、それも含める
    expect(rangeBetween(merges, { row: 1, column: 1 }, { row: 2, column: 3 })).toEqual({
      row: 1,
      column: 1,
      rowSpan: 3,
      colSpan: 3,
    });
    expect(isCovered(merges, 1, 1)).toBe(false);
    expect(isCovered(merges, 2, 2)).toBe(true);
  });

  it('行のまとまり: 縦の結合を途中で切らない範囲に広げる', () => {
    const merges = [
      { row: 1, column: 0, rowSpan: 2, colSpan: 1 },
      { row: 2, column: 1, rowSpan: 2, colSpan: 1 },
      { row: 5, column: 0, rowSpan: 1, colSpan: 3 }, // 横だけの結合は行を動かしても切れない
    ];
    expect(lineGroup(merges, 'row', 1, 1)).toEqual({ start: 1, end: 3 });
    expect(lineGroup(merges, 'row', 5, 5)).toEqual({ start: 5, end: 5 });
    expect(lineGroup(merges, 'column', 0, 0)).toEqual({ start: 0, end: 2 });
  });

  it('移動: 結合が途中で切れる移動と、位置が変わらない移動はできない', () => {
    const merges = [{ row: 1, column: 0, rowSpan: 2, colSpan: 1 }];
    expect(moveLines(merges, 'row', 4, 3, 1, 2)).toBeNull(); // 結合の間に入る
    expect(moveLines(merges, 'row', 4, 1, 1, 0)).toBeNull(); // 結合の片方だけ動かす
    expect(moveLines(merges, 'row', 4, 3, 1, 3)).toBeNull(); // 動かない
    expect(moveLines(merges, 'row', 4, 3, 1, 1)).toEqual({
      order: [0, 3, 1, 2],
      merges: [{ row: 2, column: 0, rowSpan: 2, colSpan: 1 }],
    });
    expect(moveLines(merges, 'row', 4, 1, 2, 4)?.order).toEqual([0, 3, 1, 2]);
  });
});

describe('表: セルの結合（出力）', () => {
  it('左上のセルに colspan・rowspan を付け、覆われたセルは出さない。幅は列の合計', () => {
    const { html } = render(PRICE);
    const table = desktopTable(html);
    expect(table.match(/<(td|th)\b/g)).toHaveLength(10); // 12 - 覆われた 2
    expect(table).toContain('<td rowspan="2" width="193"');
    expect(table).toContain('<td colspan="2" width="387"');
    expect(table).toContain('>全プラン税込</td>');
  });

  it('見出しを横に結合すると scope="colgroup"', () => {
    const { html } = render({
      ...PRICE,
      cells: [['', '料金', ''], ...PRICE.cells.slice(1)],
      merges: [{ row: 0, column: 1, rowSpan: 1, colSpan: 2 }],
    });
    expect(html).toContain('<th scope="colgroup" colspan="2"');
  });

  it('テキストパート: 横の結合は 1 つにまとめ、縦の結合は各行に同じ値を出す', () => {
    expect(render(PRICE).text).toBe(
      [
        'プラン | 月額 | 年額',
        '-'.repeat(27),
        'ライト | 500円 | 5,000円',
        'ライト | 1,000円 | 10,000円',
        '注記 | 全プラン税込',
      ].join('\n'),
    );
  });

  it('読み込み時に不正な結合を直す。古いテンプレート（merges なし）は警告なしで補う', () => {
    const { template } = render(PRICE);
    const input = /** @type {any} */ (structuredClone(template));
    const values = input.body.rows[0].columns[0].blocks[0].values;
    delete values.merges;
    delete values.mobileLayout;
    const old = migrate(input);
    expect(old.warnings).toEqual([]);
    expect(old.template.body.rows[0].columns[0].blocks[0].values).toMatchObject({
      merges: [],
      mobileLayout: 'table',
    });

    values.merges = [
      { row: 1, column: 0, rowSpan: 9, colSpan: 1 },
      { row: 1, column: 0, rowSpan: 1, colSpan: 2 },
      { row: -1, column: 0, rowSpan: 2, colSpan: 1 },
    ];
    values.mobileLayout = 'cards';
    const result = validate(input);
    expect(result.warnings.map((w) => w.path)).toEqual([
      'body.rows[0].columns[0].blocks[0].values.merges[2].row',
      'body.rows[0].columns[0].blocks[0].values.mobileLayout',
      'body.rows[0].columns[0].blocks[0].values', // 重なりと範囲外を直した
    ]);
    const fixed = migrate(input).template.body.rows[0].columns[0].blocks[0].values;
    expect(fixed.merges).toEqual([{ row: 1, column: 0, rowSpan: 3, colSpan: 1 }]);
    expect(fixed.mobileLayout).toBe('table');
    // 読み込み直しても変わらない
    expect(migrate(migrate(input).template).warnings).toEqual([]);
  });
});

describe('表: 結合の操作', () => {
  const block = () => createBlock('table', PRICE);

  it('結合: 範囲を広げ、空でない値を左上のセルに改行でつなぎ、他のセルは空にする', () => {
    const patch = tableOps(block()).merge({ row: 0, column: 1, rowSpan: 2, colSpan: 2 });
    expect(patch?.cells[0]).toEqual(['プラン', '月額<br>年額<br>500円<br>5,000円', '']);
    expect(patch?.cells[1]).toEqual(['ライト', '', '']);
    expect(patch?.merges).toEqual([
      { row: 0, column: 1, rowSpan: 2, colSpan: 2 },
      { row: 1, column: 0, rowSpan: 2, colSpan: 1 },
      { row: 3, column: 1, rowSpan: 1, colSpan: 2 },
    ]);
    // 既存の結合にかかる範囲は、その結合を含めて 1 つにする
    const wide = tableOps(block()).merge({ row: 2, column: 0, rowSpan: 1, colSpan: 2 });
    expect(wide?.merges).toEqual([
      { row: 1, column: 0, rowSpan: 2, colSpan: 2 },
      { row: 3, column: 1, rowSpan: 1, colSpan: 2 },
    ]);
    expect(wide?.cells[1][0]).toBe('ライト<br>500円<br>1,000円');
  });

  it('結合できない: 1 セル・結合済みと同じ範囲', () => {
    const ops = tableOps(block());
    expect(ops.merge({ row: 0, column: 0, rowSpan: 1, colSpan: 1 })).toBeNull();
    expect(ops.merge({ row: 2, column: 0, rowSpan: 1, colSpan: 1 })).toBeNull();
  });

  it('解除: 範囲にかかる結合を外し、値は左上のセルに残す', () => {
    const ops = tableOps(block());
    expect(ops.unmerge({ row: 2, column: 0, rowSpan: 1, colSpan: 1 })).toEqual({
      merges: [{ row: 3, column: 1, rowSpan: 1, colSpan: 2 }],
    });
    expect(ops.unmerge({ row: 0, column: 0, rowSpan: 1, colSpan: 3 })).toBeNull();
  });

  it('行・列の追加: 結合の途中なら結合を広げ、前なら結合をずらす', () => {
    const ops = tableOps(block());
    expect(ops.insertRow(2)?.merges).toEqual([
      { row: 1, column: 0, rowSpan: 3, colSpan: 1 },
      { row: 4, column: 1, rowSpan: 1, colSpan: 2 },
    ]);
    expect(ops.insertRow(1)?.merges[0]).toEqual({ row: 2, column: 0, rowSpan: 2, colSpan: 1 });
    expect(ops.insertColumn(2)?.merges[1]).toEqual({ row: 3, column: 1, rowSpan: 1, colSpan: 3 });
  });

  it('行・列の削除: 結合を縮め、左上のセルを消すときは値を次のセルに移す', () => {
    const ops = tableOps(block());
    const row = ops.removeRow(1);
    expect(row?.cells[1]).toEqual(['ライト', '1,000円', '10,000円']);
    expect(row?.merges).toEqual([{ row: 2, column: 1, rowSpan: 1, colSpan: 2 }]);
    const column = ops.removeColumn(1);
    expect(column?.cells[3]).toEqual(['注記', '全プラン税込']);
    expect(column?.merges).toEqual([{ row: 1, column: 0, rowSpan: 2, colSpan: 1 }]);
    // まとめて消す
    expect(ops.removeRow(1, 2)?.cells).toEqual([
      ['プラン', '月額', '年額'],
      ['注記', '全プラン税込', ''],
    ]);
    expect(ops.removeRow(0, 4)).toBeNull();
    expect(ops.removeColumn(1, 2)?.columns).toHaveLength(1);
  });
});

describe('表: 行と列の並べ替え', () => {
  const block = () => createBlock('table', PRICE);

  it('行を上下に移す。縦に結合した行はまとめて動き、隣のまとまりを飛び越える', () => {
    const ops = tableOps(block());
    // 最後の行を上へ: 結合した 2 行の前に入る
    const up = ops.shiftRows(3, 3, -1);
    expect(up).toEqual({ start: 3, count: 1, gap: 1 });
    const patch = ops.moveRows(3, 1, 1);
    expect(patch?.cells.map((row) => row[0])).toEqual(['プラン', '注記', 'ライト', '']);
    expect(patch?.merges).toEqual([
      { row: 1, column: 1, rowSpan: 1, colSpan: 2 },
      { row: 2, column: 0, rowSpan: 2, colSpan: 1 },
    ]);
    // 結合した行の片方を下へ: 2 行まとめて動く
    expect(ops.shiftRows(2, 2, 1)).toEqual({ start: 1, count: 2, gap: 4 });
    expect(ops.shiftRows(0, 0, -1)).toBeNull();
    expect(ops.shiftRows(3, 3, 1)).toBeNull();
    // 結合の間には入れない
    expect(ops.moveRows(3, 1, 2)).toBeNull();
  });

  it('列を左右に移す。列の設定もいっしょに動く', () => {
    const b = createBlock('table', {
      ...PRICE,
      columns: [
        { width: 40, align: 'left' },
        { width: null, align: 'right' },
        { width: null, align: 'center' },
      ],
    });
    const ops = tableOps(b);
    // 横に結合した 2 列はまとめて動く
    expect(ops.shiftColumns(2, 2, -1)).toEqual({ start: 1, count: 2, gap: 0 });
    const patch = ops.moveColumns(1, 2, 0);
    expect(patch?.cells[0]).toEqual(['月額', '年額', 'プラン']);
    expect(patch?.columns.map((c) => c.align)).toEqual(['right', 'center', 'left']);
    expect(patch?.merges).toEqual([
      { row: 1, column: 2, rowSpan: 2, colSpan: 1 },
      { row: 3, column: 0, rowSpan: 1, colSpan: 2 },
    ]);
    expect(ops.moveColumns(0, 1, 2)).toBeNull(); // 横の結合の間
  });
});

describe('表: スマホの縦並び', () => {
  it('mobileLayout: "table"（既定）では縦並びを出さない', () => {
    const { html } = render(PRICE);
    expect(html).not.toContain('mm-show-mobile"');
    expect(html).toContain('<table class="mm-table" ');
  });

  it('"stack": 表はスマホで隠し、1 行ずつ「見出し：値」の表を Outlook 以外に出す', () => {
    const { html } = render({ ...PRICE, mobileLayout: 'stack' });
    expect(html).toContain('<table class="mm-table mm-hide-mobile" ');
    expect(html).toMatch(
      /<!--\[if !mso\]><!-->\s*<div class="mm-show-mobile" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">\s*<table class="mm-table-stack" role="presentation"/,
    );
    expect(html).toContain(
      '.mm-show-mobile{display:block !important;max-height:none !important;overflow:visible !important;}',
    );
    const stack = html.slice(html.indexOf('mm-table-stack'), html.indexOf('<!--<![endif]-->'));
    // 本文の 3 行 × 3 項目（最後の行は横の結合で 2 項目）、行の間に間隔
    expect(stack.match(/<td width="40%"/g)).toHaveLength(8);
    expect(stack.match(/height:12px;line-height/g)).toHaveLength(2);
    expect(stack).toContain('font-weight:bold;">月額 / 年額</td>');
  });

  it('項目: 縦の結合は各行に同じ値、見出しなしならラベルなし、空の行は出さない', () => {
    const { merges } = tableOps(createBlock('table', PRICE));
    expect(stackItems(PRICE.cells, merges, 2, true)).toEqual([
      { label: 'プラン', value: 'ライト' },
      { label: '月額', value: '1,000円' },
      { label: '年額', value: '10,000円' },
    ]);
    const { html } = render({
      ...PRICE,
      cells: [...PRICE.cells, ['', '', '']],
      headerRow: false,
      mobileLayout: 'stack',
    });
    const stack = html.slice(html.indexOf('mm-table-stack'), html.indexOf('<!--<![endif]-->'));
    expect(stack).not.toContain('width="40%"');
    expect(stack).not.toContain('colspan');
    expect(stack.match(/height:12px;line-height/g)).toHaveLength(3); // 4 行（空の 5 行目は出さない）
  });
});
