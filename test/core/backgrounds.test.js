import { describe, expect, it } from 'vitest';
import {
  createBlock,
  createRow,
  createTemplate,
  migrate,
  renderHtml,
  validate,
} from '../../src/core/index.js';

const IMAGE = 'https://cdn.example.com/hero.jpg';

/**
 * @param {Partial<import('../../src/core/index.js').BodySettings> | Record<string, unknown>} [body]
 */
function template(body = {}) {
  const t = createTemplate();
  Object.assign(t.body.settings, body);
  return t;
}

/** @param {Record<string, unknown>} [overrides] */
const bg = (overrides = {}) => ({
  src: IMAGE,
  size: 'cover',
  position: 'center center',
  repeat: 'no-repeat',
  uploadData: null,
  ...overrides,
});

/** VML の部分を取り出す */
const vml = (/** @type {string} */ html) =>
  [...html.matchAll(/<!--\[if gte mso 9\]>[\s\S]*?<!\[endif\]-->/g)].map((m) => m[0]).join('\n');

describe('背景画像', () => {
  it('src が空なら何も出力しない（既定値）', () => {
    const t = template();
    t.body.rows.push(createRow('1:1', [[createBlock('text', { html: '<p>a</p>' })], []]));
    const html = renderHtml(t);
    expect(html).not.toContain('background-image');
    expect(html).not.toContain('v:rect');
    expect(html).not.toContain('v:background');
  });

  it('行: セルに背景を敷き、余白は中の表に移し、Outlook は VML で包む', () => {
    const t = template();
    const row = createRow('1', [[createBlock('text', { html: '<p>見出し</p>' })]]);
    row.settings.backgroundColor = '#222222';
    row.settings.backgroundImage = bg();
    row.settings.padding = { top: 40, right: 24, bottom: 40, left: 24 };
    t.body.rows.push(row);
    const html = renderHtml(t);
    expect(html).toContain(
      `<td background="${IMAGE}" style="background-color:#222222;background-image:url('${IMAGE}');background-position:center center;background-size:cover;background-repeat:no-repeat;">`,
    );
    expect(html).toContain('<td style="padding:40px 24px;">');
    expect(vml(html)).toContain(
      '<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">',
    );
    expect(vml(html)).toContain(
      `<v:fill type="frame" src="${IMAGE}" color="#222222" origin="0,0" position="0,0" size="1,1" aspect="atleast" />`,
    );
    expect(vml(html)).toContain('<v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">');
    // VML の開始と終了の順序
    expect(html.indexOf('<v:textbox')).toBeLessThan(html.indexOf('見出し'));
    expect(html.indexOf('見出し')).toBeLessThan(html.indexOf('</v:textbox>'));
  });

  it('VML の値: 位置・繰り返し・サイズ（MJML と同じ対応）', () => {
    const fill = (/** @type {Record<string, unknown>} */ overrides) => {
      const t = template();
      const row = createRow('1', [[createBlock('spacer')]]);
      row.settings.backgroundImage = bg(overrides);
      t.body.rows.push(row);
      return /<v:fill([^>]*)\/>/.exec(renderHtml(t))?.[1].trim();
    };
    expect(fill({ position: 'left top', size: 'contain' })).toBe(
      `type="frame" src="${IMAGE}" origin="-0.5,-0.5" position="-0.5,-0.5" size="1,1" aspect="atmost"`,
    );
    expect(fill({ position: 'right bottom', repeat: 'repeat' })).toBe(
      `type="tile" src="${IMAGE}" origin="1,1" position="1,1" size="1,1" aspect="atleast"`,
    );
    expect(fill({ size: 'auto' })).toBe(
      `type="tile" src="${IMAGE}" origin="0.5,0" position="0.5,0"`,
    );
  });

  it('カラム: 中の表のセルに背景を敷き、幅はカラムの幅（余白を含む）', () => {
    const t = template();
    const row = createRow('1:1', [
      [createBlock('text', { html: '<p>左</p>' })],
      [createBlock('text', { html: '<p>右</p>' })],
    ]);
    row.columns[1].settings.backgroundImage = bg({ position: 'center top' });
    row.columns[1].settings.backgroundColor = '#eeeeee';
    row.columns[1].settings.padding = { top: 20, right: 20, bottom: 20, left: 20 };
    t.body.rows.push(row);
    const html = renderHtml(t);
    expect(html).toContain(
      `<td valign="top" background="${IMAGE}" style="background-color:#eeeeee;background-image:url('${IMAGE}');background-position:center top;`,
    );
    // 600 - 隙間 16 の半分ずつ: 右のカラムの幅 292px
    expect(vml(html)).toContain('style="width:292px;"');
    expect(vml(html)).toContain('origin="0,-0.5" position="0,-0.5"');
    expect(html).toContain('<td style="padding:20px;">');
  });

  it('1 カラムの行でもカラムの背景画像があれば、カラムのセルを作る', () => {
    const t = template();
    const row = createRow('1', [[createBlock('text', { html: '<p>a</p>' })]]);
    row.columns[0].settings.backgroundImage = bg();
    t.body.rows.push(row);
    expect(renderHtml(t)).toContain(`background="${IMAGE}"`);
  });

  it('本文: 行をまとめたセルに背景を敷く。中の行・カラムの VML は出さない（Outlook では背景色）', () => {
    const t = template({ contentBackgroundImage: bg(), contentBackgroundColor: '#fafafa' });
    const row = createRow('1', [[createBlock('text', { html: '<p>a</p>' })]]);
    row.settings.backgroundImage = bg({ src: 'https://cdn.example.com/row.jpg' });
    t.body.rows.push(row);
    const html = renderHtml(t);
    expect(html).toContain(
      `<table role="presentation" class="mm-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#fafafa;">`,
    );
    expect(html).toContain(`<td background="${IMAGE}"`);
    expect(html.match(/<v:rect/g)).toHaveLength(1);
    // 行の背景画像は CSS では出す
    expect(html).toContain("background-image:url('https://cdn.example.com/row.jpg')");
  });

  it('行の背景画像の中のカラムの背景画像も、VML は出さない', () => {
    const t = template();
    const row = createRow('1:1', [[createBlock('spacer')], [createBlock('spacer')]]);
    row.settings.backgroundImage = bg();
    row.columns[0].settings.backgroundImage = bg({ src: 'https://cdn.example.com/col.jpg' });
    t.body.rows.push(row);
    const html = renderHtml(t);
    expect(html.match(/<v:rect/g)).toHaveLength(1);
    expect(html).toContain('background="https://cdn.example.com/col.jpg"');
  });

  it('外側: Outlook は v:background、それ以外は外側の表に背景を敷く', () => {
    const t = template({ backgroundImage: bg({ repeat: 'repeat', size: 'auto' }) });
    const html = renderHtml(t);
    expect(html).toMatch(
      /<body[^>]*>\s*<!--\[if gte mso 9\]>\s*<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">\s*<v:fill type="tile" src="https:\/\/cdn\.example\.com\/hero\.jpg" color="#f4f4f4"/,
    );
    expect(html).toContain(
      `style="background-color:#f4f4f4;background-image:url('${IMAGE}');background-position:center center;background-size:auto;background-repeat:repeat;">`,
    );
    expect(html).toContain(`<td align="center" background="${IMAGE}">`);
  });

  it('読み込み時に不正な値を直す。古いテンプレート（項目なし）は警告なしで既定値を補う', () => {
    const t = template();
    t.body.rows.push(createRow('1'));
    const input = /** @type {any} */ (structuredClone(t));
    delete input.body.settings.backgroundImage;
    delete input.body.rows[0].settings.backgroundImage;
    delete input.body.rows[0].columns[0].settings.backgroundImage;
    const old = migrate(input);
    expect(old.warnings).toEqual([]);
    expect(old.template.body.rows[0].settings.backgroundImage.src).toBe('');

    input.body.rows[0].settings.backgroundImage = {
      src: IMAGE,
      size: 'stretch',
      position: 'middle',
    };
    const result = validate(input);
    expect(result.warnings.map((w) => w.path)).toEqual([
      'body.rows[0].settings.backgroundImage.size',
      'body.rows[0].settings.backgroundImage.position',
    ]);
    const fixed = migrate(input).template.body.rows[0].settings.backgroundImage;
    expect(fixed).toEqual(bg());
  });

  it('URL の引用符や括弧をエスケープする', () => {
    const t = template();
    const row = createRow('1', [[createBlock('spacer')]]);
    row.settings.backgroundImage = bg({ src: "https://e.com/a b'(1).jpg" });
    t.body.rows.push(row);
    const html = renderHtml(t);
    expect(html).toContain("url('https://e.com/a%20b%27%281%29.jpg')");
    expect(html).toContain('background="https://e.com/a b\'(1).jpg"');
  });
});
