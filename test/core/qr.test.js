import { describe, expect, it } from 'vitest';
import {
  createBlock,
  createRow,
  createTemplate,
  findMergeTags,
  migrate,
  qrSignature,
  qrStatus,
  renderHtml,
  renderText,
} from '../../src/core/index.js';

/** @param {Record<string, unknown>} values */
function templateWith(values) {
  const template = createTemplate();
  const block = createBlock('qr', values);
  template.body.rows.push(createRow('1', [[block]]));
  return { template, block };
}

const BASE = {
  content: 'https://example.com/campaign',
  size: 160,
  ecLevel: 'M',
  margin: 2,
  color: '#000000',
  backgroundColor: '#ffffff',
};

describe('QR ブロック', () => {
  it('画像（src）が無ければ何も出力しない', () => {
    const { template } = templateWith({ content: 'https://example.com/' });
    expect(renderHtml(template)).not.toContain('<img');
    expect(renderText(template)).not.toContain('example.com');
  });

  it('src を正方形の画像として出力し、幅はブロック幅を超えない', () => {
    const { template } = templateWith({
      ...BASE,
      size: 600,
      src: 'https://cdn.example.com/qr.png',
      alt: 'QR',
      href: 'https://example.com/{{coupon}}',
      align: 'right',
    });
    const html = renderHtml(template, { mergeValues: { coupon: 'A1' } });
    expect(html).toMatch(
      /<a href="https:\/\/example\.com\/A1" target="_blank"><img src="https:\/\/cdn\.example\.com\/qr\.png" alt="QR" width="580" height="580"/,
    );
    expect(html).toContain('<td align="right"');
    expect(html).not.toContain('data:image');
  });

  it('テキストパートはリンク先、無ければ内容の URL を出す', () => {
    const src = 'https://cdn.example.com/qr.png';
    expect(renderText(templateWith({ ...BASE, src, alt: 'QR コード' }).template)).toContain(
      '[QR コード] ( https://example.com/campaign )',
    );
    expect(
      renderText(templateWith({ ...BASE, src, alt: 'QR', href: 'https://example.com/x' }).template),
    ).toContain('[QR] ( https://example.com/x )');
    // 内容が URL でなければ代替テキストだけ
    expect(
      renderText(templateWith({ ...BASE, content: 'WIFI:S:x;;', src, alt: 'QR' }).template),
    ).toMatch(/\[QR\]\s*$/);
  });

  it('作成後に見た目の設定が変わると stale になる', () => {
    const src = 'https://cdn.example.com/qr.png';
    const generated = qrSignature(BASE);
    const status = (/** @type {Record<string, unknown>} */ values) =>
      qrStatus(templateWith(values).block);
    expect(status({})).toBe('empty');
    expect(status({ content: 'x' })).toBe('missing');
    expect(status({ ...BASE, src, generated })).toBe('ok');
    expect(status({ ...BASE, src, generated, alt: '変更', href: 'https://a', align: 'left' })).toBe(
      'ok',
    );
    expect(status({ ...BASE, src, generated, content: 'https://example.com/other' })).toBe('stale');
    expect(status({ ...BASE, src, generated, color: '#333333' })).toBe('stale');
    expect(status({ ...BASE, src, generated: null })).toBe('stale');
  });

  it('差し込み変数は代替テキストとリンク先だけで、内容は対象外', () => {
    const { template } = templateWith({
      ...BASE,
      content: 'https://example.com/{{coupon}}',
      alt: '{{name}} 様の QR',
      src: 'https://cdn.example.com/qr.png',
    });
    const keys = findMergeTags(template).map((u) => `${u.field}:${u.key}`);
    expect(keys).toEqual(['alt:name']);
  });

  it('読み込み時に範囲外の値を直す', () => {
    const { template } = templateWith({});
    const qr = /** @type {any} */ (template.body.rows[0].columns[0].blocks[0]);
    qr.values.size = 2000;
    qr.values.ecLevel = 'X';
    const { template: fixed, warnings } = migrate(template);
    const values = /** @type {any} */ (fixed.body.rows[0].columns[0].blocks[0].values);
    expect(values.ecLevel).toBe('M');
    expect(values.size).toBeLessThanOrEqual(600);
    expect(warnings.map((w) => w.code)).toContain('invalid-value');
  });
});
