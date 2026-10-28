// テキストパートでの部品・行の扱い（text.mode）と、PC 用・スマホ用の出し分け（textVariant）
import { describe, expect, it } from 'vitest';
import { blockTextSourceHash } from '../../src/core/render-text/index.js';
import {
  applyCommand,
  createBlock,
  createRow,
  createTemplate,
  findMergeTags,
  migrate,
  renderHtml,
  renderText,
  resolveTextPart,
  textSourceHash,
  validate,
} from '../../src/core/index.js';

/**
 * 1 行 1 カラムに部品を並べたテンプレート
 * @param {any[]} blocks
 */
function templateWith(blocks) {
  const template = createTemplate();
  template.body.rows.push(createRow('1', [blocks]));
  return template;
}

const paragraph = (/** @type {string} */ text, /** @type {any} */ extra = {}) => ({
  ...createBlock('text', { html: `<p>${text}</p>` }),
  ...extra,
});

describe('テンプレートの版と text の読み込み', () => {
  it('版 1 のテンプレートは警告なしで版 2 として読み込む', () => {
    const v1 = { ...templateWith([paragraph('本文')]), version: 1 };
    const { template, warnings } = migrate(v1);
    expect(warnings).toEqual([]);
    expect(template.version).toBe(2);
    expect(template.body.rows[0].columns[0].blocks[0]).not.toHaveProperty('text');
  });

  it('部品・行の text を残し、auto は省く', () => {
    const template = templateWith([
      paragraph('出さない', { text: { mode: 'hidden' } }),
      paragraph('テキストだけ', { text: { mode: 'only' } }),
      paragraph('自動', { text: { mode: 'auto' } }),
    ]);
    template.body.rows[0] = { ...template.body.rows[0], text: { mode: 'hidden' } };
    const { template: loaded, warnings } = migrate(template);
    expect(warnings).toEqual([]);
    const [hidden, only, auto] = loaded.body.rows[0].columns[0].blocks;
    expect(hidden.text).toEqual({ mode: 'hidden' });
    expect(only.text).toEqual({ mode: 'only' });
    expect(auto).not.toHaveProperty('text');
    expect(loaded.body.rows[0].text).toEqual({ mode: 'hidden' });
  });

  it('不正な text は警告して自動にする（行は only を選べない）', () => {
    const template = templateWith([
      paragraph('a', { text: { mode: 'bogus' } }),
      paragraph('b', { text: 'hidden' }),
      paragraph('c', { text: { mode: 'hidden', extra: 1 } }),
    ]);
    template.body.rows[0] = { ...template.body.rows[0], text: { mode: 'only' } };
    const { valid, warnings } = validate(template);
    expect(valid).toBe(false);
    expect(warnings.map((w) => [w.code, w.path])).toEqual([
      ['invalid-value', 'body.rows[0].columns[0].blocks[0].text.mode'],
      ['invalid-value', 'body.rows[0].columns[0].blocks[1].text'],
      ['unknown-key', 'body.rows[0].columns[0].blocks[2].text.extra'],
      ['invalid-value', 'body.rows[0].text.mode'],
    ]);
    const { template: loaded } = migrate(template);
    const blocks = loaded.body.rows[0].columns[0].blocks;
    expect(blocks.map((b) => b.text)).toEqual([undefined, undefined, { mode: 'hidden' }]);
    expect(loaded.body.rows[0]).not.toHaveProperty('text');
  });
});

describe('テキストパートでの部品・行の扱い', () => {
  it('hidden はテキストパートに出さず、only は HTML に出さない', () => {
    const template = templateWith([
      paragraph('いつもの本文'),
      paragraph('ロゴの代わり', { text: { mode: 'hidden' } }),
      paragraph('HTML 版はブラウザでも見られます', { text: { mode: 'only' } }),
    ]);
    const text = renderText(template);
    expect(text).toBe('いつもの本文\n\nHTML 版はブラウザでも見られます');
    const html = renderHtml(template);
    expect(html).toContain('いつもの本文');
    expect(html).toContain('ロゴの代わり');
    expect(html).not.toContain('HTML 版はブラウザでも見られます');
  });

  it('行の hidden は中の部品の設定より先に効く', () => {
    const template = templateWith([paragraph('テキストだけ', { text: { mode: 'only' } })]);
    template.body.rows.push(createRow('1', [[paragraph('次の行')]]));
    template.body.rows[0] = { ...template.body.rows[0], text: { mode: 'hidden' } };
    expect(renderText(template)).toBe('次の行');
  });

  it('上書きしない部品は本文の変更に追いかける', () => {
    const template = templateWith([
      paragraph('ロゴ', { text: { mode: 'hidden' } }),
      paragraph('変える前'),
    ]);
    const next = applyCommand(template, {
      type: 'updateBlockValues',
      blockId: template.body.rows[0].columns[0].blocks[1].id,
      patch: { html: '<p>変えた後</p>' },
    });
    expect(renderText(next)).toBe('変えた後');
  });

  it('text の無いテンプレートは今までと同じに出る', () => {
    const template = templateWith([paragraph('a'), paragraph('b')]);
    expect(renderText(template)).toBe('a\n\nb');
  });
});

describe('textVariant（PC 用・スマホ用で分けた部品・行）', () => {
  const template = templateWith([
    paragraph('共通'),
    paragraph('PC 用のバナー', { hideOn: 'mobile' }),
    paragraph('スマホ用のバナー', { hideOn: 'desktop' }),
  ]);
  template.body.rows.push({
    ...createRow('1', [[paragraph('スマホ用の行')]]),
    settings: { ...createRow('1').settings, hideOn: 'desktop' },
  });

  it('既定（both）は両方を出す（今と同じ）', () => {
    expect(renderText(template)).toBe('共通\n\nPC 用のバナー\n\nスマホ用のバナー\n\nスマホ用の行');
  });

  it("'desktop' は PC 側だけ、'mobile' はスマホ側だけを出す", () => {
    expect(renderText(template, { textVariant: 'desktop' })).toBe('共通\n\nPC 用のバナー');
    expect(renderText(template, { textVariant: 'mobile' })).toBe(
      '共通\n\nスマホ用のバナー\n\nスマホ用の行',
    );
  });

  it('知らない値は both として扱う', () => {
    expect(renderText(template, { textVariant: /** @type {any} */ ('tablet') })).toBe(
      renderText(template),
    );
  });

  it('手直しの古さの判定も同じ設定で行う', () => {
    const options = { textVariant: /** @type {const} */ ('desktop') };
    const manual = {
      ...template,
      text: {
        mode: /** @type {const} */ ('manual'),
        content: '手直し',
        sourceHash: textSourceHash(template, options),
      },
    };
    expect(resolveTextPart(manual, options).stale).toBe(false);
    expect(resolveTextPart(manual).stale).toBe(true);
  });
});

describe('代替テキストが空の画像', () => {
  it('リンクがあってもテキストパートに出さない', () => {
    const template = templateWith([
      createBlock('image', {
        src: 'https://example.com/logo.png',
        alt: '',
        href: 'https://example.com',
      }),
      createBlock('image', {
        src: 'https://example.com/b.png',
        alt: 'セール',
        href: 'https://example.com/s',
      }),
    ]);
    expect(renderText(template)).toBe('[セール] ( https://example.com/s )');
  });
});

describe('setElementText コマンド', () => {
  it('部品・行の扱いを変え、auto や null で自動に戻す', () => {
    const template = templateWith([paragraph('a')]);
    const rowId = template.body.rows[0].id;
    const blockId = template.body.rows[0].columns[0].blocks[0].id;

    const hidden = applyCommand(template, {
      type: 'setElementText',
      id: blockId,
      text: { mode: 'hidden' },
    });
    expect(hidden.body.rows[0].columns[0].blocks[0].text).toEqual({ mode: 'hidden' });
    const back = applyCommand(hidden, {
      type: 'setElementText',
      id: blockId,
      text: { mode: 'auto' },
    });
    expect(back.body.rows[0].columns[0].blocks[0]).not.toHaveProperty('text');
    expect(applyCommand(back, { type: 'setElementText', id: blockId, text: null })).toBe(back);

    const row = applyCommand(template, {
      type: 'setElementText',
      id: rowId,
      text: { mode: 'hidden' },
    });
    expect(row.body.rows[0].text).toEqual({ mode: 'hidden' });
    expect(
      applyCommand(row, { type: 'setElementText', id: rowId, text: null }).body.rows[0],
    ).not.toHaveProperty('text');
    // 元のテンプレートは変えない
    expect(template.body.rows[0]).not.toHaveProperty('text');
  });

  it('行に only は選べない（警告して自動）', () => {
    const template = templateWith([paragraph('a')]);
    /** @type {any[]} */
    const warnings = [];
    const next = applyCommand(
      template,
      { type: 'setElementText', id: template.body.rows[0].id, text: { mode: 'only' } },
      warnings,
    );
    expect(next).toBe(template);
    expect(warnings[0]?.code).toBe('invalid-value');
  });

  it('無い ID は not-found', () => {
    expect(() =>
      applyCommand(templateWith([]), { type: 'setElementText', id: 'b_none', text: null }),
    ).toThrow(/not found/);
  });
});

describe('指定の文（text.mode: custom）と参照', () => {
  /** @param {any} text */
  const button = (text) => ({
    ...createBlock('button', { label: 'パスワードを設定する', href: 'https://example.com/reset' }),
    text,
  });

  it('{@名前} を今の値に置き換え、値を変えると追いかける（古いとは出ない）', () => {
    const template = templateWith([
      button({ mode: 'custom', content: '次の URL から設定してください：\n{@href}' }),
    ]);
    expect(renderText(template)).toBe('次の URL から設定してください：\nhttps://example.com/reset');
    const blockId = template.body.rows[0].columns[0].blocks[0].id;
    const next = applyCommand(template, {
      type: 'updateBlockValues',
      blockId,
      patch: { label: '再設定する', href: 'https://example.com/reset2' },
    });
    const part = resolveTextPart(next);
    expect(part.text).toBe('次の URL から設定してください：\nhttps://example.com/reset2');
    expect(part.stale).toBe(false);
    expect(part.staleBlockIds).toEqual([]);
  });

  it('{@text} は自動生成のテキスト。差し込み変数も使え、findMergeTags に入る', () => {
    const block = paragraph('ご注文ありがとうございます', {
      text: { mode: 'custom', content: '{{name}} 様\n{@text}' },
    });
    const template = templateWith([block]);
    expect(renderText(template)).toBe('{{name}} 様\nご注文ありがとうございます');
    expect(renderText(template, { mergeValues: { name: '山田' } })).toBe(
      '山田 様\nご注文ありがとうございます',
    );
    expect(findMergeTags(template)).toContainEqual({
      key: 'name',
      blockId: block.id,
      field: 'text.content',
    });
  });

  it('参照を含まない文は、本文が変わると古いと判定し staleBlockIds に入れる', () => {
    const block = button({ mode: 'custom', content: '合計：{{total}} 円' });
    block.text.sourceHash = blockTextSourceHash(block);
    const template = templateWith([block]);
    expect(resolveTextPart(template).stale).toBe(false);
    const next = applyCommand(template, {
      type: 'updateBlockValues',
      blockId: block.id,
      patch: { label: '変えた' },
    });
    const part = resolveTextPart(next);
    expect(part.text).toBe('合計：{{total}} 円');
    expect(part.stale).toBe(true);
    expect(part.staleBlockIds).toEqual([block.id]);
  });

  it('古さの判定は折り返しなどの設定に左右されない（sourceHash が無ければ判定しない）', () => {
    const block = button({ mode: 'custom', content: '固定の文' });
    block.text.sourceHash = blockTextSourceHash(block);
    const template = templateWith([block]);
    expect(resolveTextPart(template, { wrapWidth: 20, headingPrefix: '■ ' }).stale).toBe(false);
    const noHash = templateWith([button({ mode: 'custom', content: '固定の文' })]);
    expect(resolveTextPart(noHash).stale).toBe(false);
  });

  it('その部品に無い名前は書いたまま残し、unknownRefs で知らせる', () => {
    const block = button({ mode: 'custom', content: '{@label} {@alt} {@nope}' });
    const part = resolveTextPart(templateWith([block]));
    expect(part.text).toBe('パスワードを設定する {@alt} {@nope}');
    expect(part.unknownRefs).toEqual([
      { blockId: block.id, name: 'alt' },
      { blockId: block.id, name: 'nope' },
    ]);
  });

  it('画像・画像＋テキスト・動画・QR・カスタムブロックの参照', () => {
    const image = createBlock('image', {
      src: 'https://example.com/a.png',
      alt: '新作',
      href: 'https://example.com/new',
    });
    const template = templateWith([
      { ...image, text: { mode: 'custom', content: '{@alt}: {@href} ({@src})' } },
    ]);
    expect(renderText(template)).toBe('新作: https://example.com/new (https://example.com/a.png)');
  });

  it('custom で content が無いと警告して自動にする。custom 以外の content は消す', () => {
    const template = templateWith([
      paragraph('a', { text: { mode: 'custom' } }),
      paragraph('b', { text: { mode: 'hidden', content: 'x' } }),
      paragraph('c', { text: { mode: 'custom', content: 'c', sourceHash: 1 } }),
    ]);
    const { template: loaded, warnings } = migrate(template);
    expect(warnings.map((w) => [w.code, w.path])).toEqual([
      ['invalid-value', 'body.rows[0].columns[0].blocks[0].text.content'],
      ['unknown-key', 'body.rows[0].columns[0].blocks[1].text.content'],
      ['invalid-value', 'body.rows[0].columns[0].blocks[2].text.sourceHash'],
    ]);
    expect(loaded.body.rows[0].columns[0].blocks.map((b) => b.text)).toEqual([
      undefined,
      { mode: 'hidden' },
      { mode: 'custom', content: 'c' },
    ]);
  });
});

describe('textTemplates（種類ごとの既定の書き方）', () => {
  const template = templateWith([
    createBlock('button', { label: '購入する', href: 'https://example.com/buy' }),
    createBlock('button', { label: '', href: '' }),
    {
      ...createBlock('button', { label: '詳細', href: 'https://example.com/d' }),
      text: { mode: 'custom', content: '詳細は {@href}' },
    },
  ]);

  it('自動の部品に使い、指定の文の部品と中身の無い部品には使わない', () => {
    const text = renderText(template, { textTemplates: { button: '{@label}：{@href}' } });
    expect(text).toBe('購入する：https://example.com/buy\n\n詳細は https://example.com/d');
  });

  it('渡さないと今と同じ', () => {
    expect(renderText(template)).toBe(
      '▶ 購入する\n  https://example.com/buy\n\n詳細は https://example.com/d',
    );
  });

  it('知らない名前は unknownRefs に入る', () => {
    const part = resolveTextPart(template, { textTemplates: { button: '{@title}' } });
    expect(part.unknownRefs.map((r) => r.name)).toEqual(['title']);
  });
});
