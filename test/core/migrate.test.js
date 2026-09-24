import { describe, expect, it } from 'vitest';
import { MailmasonError, TEMPLATE_VERSION, migrate, validate } from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

/** @param {{ code: string }[]} warnings */
const codes = (warnings) => warnings.map((w) => w.code);

describe('migrate', () => {
  it('正しいテンプレートは警告なしでそのまま読み込める', () => {
    const input = loadFixture('basic');
    const { template, warnings } = migrate(input);
    expect(warnings).toEqual([]);
    expect(template).toEqual(input);
  });

  it('入力オブジェクトを変更しない', () => {
    const input = loadFixture('basic');
    input.body.rows[0].extra = true;
    const before = structuredClone(input);
    migrate(input);
    expect(input).toEqual(before);
  });

  it('JSON 文字列も受け付ける', () => {
    const { template } = migrate(JSON.stringify(loadFixture('basic')));
    expect(template.body.rows).toHaveLength(4);
  });

  it('空オブジェクトは既定値で補って missing-version を警告する', () => {
    const { template, warnings } = migrate({});
    expect(template.version).toBe(TEMPLATE_VERSION);
    expect(template.body.rows).toEqual([]);
    expect(template.body.settings.width).toBe(600);
    expect(codes(warnings)).toEqual(['missing-version']);
  });

  it('JSON でない文字列は invalid-json', () => {
    expect(() => migrate('{oops')).toThrow(expect.objectContaining({ code: 'invalid-json' }));
  });

  it('オブジェクト以外は invalid-template', () => {
    expect(() => migrate([])).toThrow(expect.objectContaining({ code: 'invalid-template' }));
    expect(() => migrate(null)).toThrow(MailmasonError);
  });

  it('現行より新しい version は unsupported-version（壊さないため読み込まない）', () => {
    expect(() => migrate({ version: TEMPLATE_VERSION + 1 })).toThrow(
      expect.objectContaining({ code: 'unsupported-version' }),
    );
  });

  it('不正な version は invalid-version', () => {
    expect(() => migrate({ version: '1' })).toThrow(
      expect.objectContaining({ code: 'invalid-version' }),
    );
  });

  it('未知キーを削除し、パス付きで警告する', () => {
    const input = loadFixture('basic');
    input.foo = 1;
    input.body.rows[1].columns[0].blocks[0].values.bar = 2;
    const { template, warnings } = migrate(input);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'unknown-key',
        path: 'body.rows[1].columns[0].blocks[0].values.bar',
      }),
      expect.objectContaining({ code: 'unknown-key', path: 'foo' }),
    ]);
    expect(template.body.rows[1].columns[0].blocks[0].values).not.toHaveProperty('bar');
  });

  it('不正な値は既定値に置き換える', () => {
    const input = loadFixture('basic');
    input.body.settings.linkColor = 'blue';
    input.body.rows[1].columns[0].blocks[1].values.borderRadius = -1;
    const { template, warnings } = migrate(input);
    expect(template.body.settings.linkColor).toBe('#0066cc');
    expect(template.body.rows[1].columns[0].blocks[1].values.borderRadius).toBe(4);
    expect(codes(warnings)).toEqual(['invalid-value', 'invalid-value']);
  });

  it('欠落・重複した ID は振り直す', () => {
    const input = loadFixture('basic');
    delete input.body.rows[0].id;
    input.body.rows[2].columns[1].blocks[0].id = 'b_item0001';
    const { template, warnings } = migrate(input);
    expect(template.body.rows[0].id).toMatch(/^r_[0-9a-z]{8}$/);
    expect(template.body.rows[2].columns[1].blocks[0].id).not.toBe('b_item0001');
    expect(codes(warnings)).toEqual(['regenerated-id', 'regenerated-id']);
  });

  it('カラムが足りなければ空カラムを補う', () => {
    const input = loadFixture('basic');
    input.body.rows[2].columns.pop();
    const { template, warnings } = migrate(input);
    expect(template.body.rows[2].columns).toHaveLength(2);
    expect(template.body.rows[2].columns[1].blocks).toEqual([]);
    expect(codes(warnings)).toEqual(['layout-mismatch']);
  });

  it('カラムが多すぎれば、余りのブロックを最後のカラムへ移す', () => {
    const input = loadFixture('basic');
    input.body.rows[2].layout = '1';
    const { template, warnings } = migrate(input);
    const blocks = template.body.rows[2].columns[0].blocks.map((b) => b.id);
    expect(template.body.rows[2].columns).toHaveLength(1);
    expect(blocks).toEqual(['b_item0001', 'b_item0002']);
    expect(codes(warnings)).toEqual(['layout-mismatch']);
  });

  it('layout が不正ならカラム数から推定する', () => {
    const input = loadFixture('basic');
    input.body.rows[2].layout = '5:5';
    const { template } = migrate(input);
    expect(template.body.rows[2].layout).toBe('1:1');
  });

  it('未知のブロック type は内容を保持したまま残す', () => {
    const input = loadFixture('basic');
    const countdown = {
      id: 'b_countdown1',
      type: 'countdown',
      values: { url: 'https://example.com/v' },
    };
    input.body.rows[1].columns[0].blocks.push(countdown);
    const { template, warnings } = migrate(input);
    const kept = template.body.rows[1].columns[0].blocks[2];
    expect(kept.type).toBe('countdown');
    expect(kept.values).toEqual({ url: 'https://example.com/v' });
    expect(codes(warnings)).toEqual(['unknown-block-type']);
  });

  it('壊れた行・ブロックは取り除く', () => {
    const input = loadFixture('basic');
    input.body.rows.push('row');
    input.body.rows[0].columns[0].blocks.push({ values: {} });
    const { template, warnings } = migrate(input);
    expect(template.body.rows).toHaveLength(4);
    expect(template.body.rows[0].columns[0].blocks).toHaveLength(1);
    expect(codes(warnings)).toEqual(['invalid-value', 'invalid-value']);
  });

  it('テキストブロックの HTML を許可タグに整え、sanitized-html を警告する', () => {
    const input = loadFixture('basic');
    input.body.rows[1].columns[0].blocks[0].values.html = '<div>a<script>x</script></div>';
    input.body.rows[2].columns[0].blocks[0].values.html = '<b>b</b>';
    const { template, warnings } = migrate(input);
    expect(template.body.rows[1].columns[0].blocks[0].values.html).toBe('<p>a</p>');
    expect(template.body.rows[2].columns[0].blocks[0].values.html).toBe(
      '<p><strong>b</strong></p>',
    );
    expect(codes(warnings)).toEqual(['sanitized-html', 'sanitized-html']);
  });

  it('区切り文字を変えたマージタグのリンクを残せる', () => {
    const input = loadFixture('basic');
    input.body.rows[1].columns[0].blocks[0].values.html = '<p><a href="%%url%%">x</a></p>';
    const options = { mergeTagDelimiters: { open: '%%', close: '%%' } };
    const { template } = migrate(input, options);
    expect(template.body.rows[1].columns[0].blocks[0].values.html).toBe(
      '<p><a href="%%url%%">x</a></p>',
    );
  });

  it('manual モードなのに content が無ければ auto に戻す', () => {
    const input = loadFixture('basic');
    input.text = { mode: 'manual', content: null, sourceHash: null };
    const { template } = migrate(input);
    expect(template.text.mode).toBe('auto');
  });
});

describe('validate', () => {
  it('問題なければ valid', () => {
    expect(validate(loadFixture('basic'))).toEqual({ valid: true, warnings: [], error: null });
  });

  it('警告があれば valid ではない', () => {
    const result = validate({});
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });

  it('読み込めないときは error を返す（例外にしない）', () => {
    const result = validate({ version: 99 });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('unsupported-version');
  });
});
