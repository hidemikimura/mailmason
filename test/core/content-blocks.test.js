import { describe, expect, it } from 'vitest';
import {
  createBlock,
  createRow,
  createTemplate,
  findMergeTags,
  migrate,
  renderHtml,
  renderText,
  validate,
} from '../../src/core/index.js';
import { tableColumnWidths, tableOps, TABLE_MAX_COLUMNS } from '../../src/core/blocks/table.js';
import { youtubeThumbnail, youtubeVideoId } from '../../src/core/blocks/video.js';
import { sanitizeInlineHtml } from '../../src/core/richtext/sanitize.js';

/**
 * @param {string} type
 * @param {Record<string, unknown>} values
 */
function templateWith(type, values) {
  const template = createTemplate();
  template.body.rows.push(createRow('1', [[createBlock(type, values)]]));
  return migrate(template);
}

const image = (/** @type {string} */ name) => ({
  src: `https://cdn.example.com/${name}.jpg`,
  alt: name,
  naturalWidth: 600,
  naturalHeight: 400,
  uploadData: null,
});

describe('インラインのリッチテキスト（表のセル）', () => {
  it('段落・見出し・リストを <br> でつないで 1 つのインラインにする', () => {
    const html = sanitizeInlineHtml(
      '<p>一行目</p><h2>見出し</h2><ul><li>A</li><li><b>B</b></li></ul>',
      {
        delimiters: { open: '{{', close: '}}' },
      },
    );
    expect(html).toBe('一行目<br>見出し<br>A<br><strong>B</strong>');
  });

  it('整えた結果をもう一度整えても変わらない', () => {
    const options = { delimiters: { open: '{{', close: '}}' } };
    const once = sanitizeInlineHtml('<p>a <a href="https://e.com">b</a></p><p>c</p>', options);
    expect(sanitizeInlineHtml(once, options)).toBe(once);
  });
});

describe('表ブロック', () => {
  it('見出し行を th、本文を td で出し、セルのリッチテキストとリンクの色を反映する', () => {
    const { template } = templateWith('table', {
      cells: [
        ['商品', '価格'],
        ['ニット <a href="https://e.com/knit">詳細</a>', '<strong>¥12,800</strong>'],
      ],
      columns: [
        { width: 60, align: 'left' },
        { width: null, align: 'right' },
      ],
    });
    const html = renderHtml(template);
    expect(html).toMatch(/<th scope="col" width="348" align="left"/);
    expect(html).toMatch(/<th scope="col" width="232" align="right"/);
    expect(html).toContain('<a href="https://e.com/knit" target="_blank" style="color:#0066cc;');
    expect(html).toContain('<strong>¥12,800</strong>');
    expect(html).toContain('border-collapse:collapse');
  });

  it('しま模様・見出しなし・罫線なし', () => {
    const { template } = templateWith('table', {
      cells: [['a'], ['b'], ['c']],
      columns: [{ width: null, align: 'left' }],
      headerRow: false,
      striped: true,
      stripeColor: '#eeeeee',
      borderWidth: 0,
    });
    const html = renderHtml(template);
    expect(html).not.toContain('<th');
    expect(html).not.toContain('solid');
    expect(html.match(/background-color:#eeeeee/g)).toHaveLength(1);
  });

  it('全部のセルが空なら何も出力しない', () => {
    const { template } = templateWith('table', {});
    expect(renderHtml(template)).not.toContain('<th');
    expect(renderText(template)).toBe('');
  });

  it('読み込み時に行と列の数をそろえ、セルを整える', () => {
    const { template } = templateWith('table', {
      cells: [['a', 'b', 'c'], ['d'], ['<p>e</p><p>f</p>', 'g', 'h', 'i']],
      columns: [{ width: 50, align: 'center' }],
    });
    const v = /** @type {any} */ (template.body.rows[0].columns[0].blocks[0].values);
    expect(v.columns).toHaveLength(4);
    expect(v.columns[0]).toEqual({ width: 50, align: 'center' });
    expect(v.cells.map((/** @type {string[]} */ row) => row.length)).toEqual([4, 4, 4]);
    expect(v.cells[2][0]).toBe('e<br>f');
  });

  it('列は上限まで', () => {
    const { template } = templateWith('table', { cells: [Array(12).fill('x')], columns: [] });
    const v = /** @type {any} */ (template.body.rows[0].columns[0].blocks[0].values);
    expect(v.columns).toHaveLength(TABLE_MAX_COLUMNS);
  });

  it('列の幅: % を優先し、残りを等分し、合計を表の幅にそろえる', () => {
    const w = (/** @type {(number|null)[]} */ widths) =>
      tableColumnWidths(
        widths.map((width) => ({ width, align: /** @type {const} */ ('left') })),
        580,
      );
    expect(w([null, null])).toEqual([290, 290]);
    expect(w([20, null, null])).toEqual([116, 232, 232]);
    expect(w([80, 80])).toEqual([290, 290]);
    expect(w([null, null, null]).reduce((a, b) => a + b)).toBe(580);
  });

  it('テキストパートは | 区切りで、見出し行の下に線を引く', () => {
    const { template } = templateWith('table', {
      cells: [
        ['商品', '価格'],
        ['ニット', '¥12,800'],
      ],
    });
    expect(renderText(template)).toBe('商品 | 価格\n----------------\nニット | ¥12,800');
  });

  it('セルの差し込み変数を検査・置換する', () => {
    const { template } = templateWith('table', { cells: [['名前'], ['{{name}}']] });
    expect(findMergeTags(template).map((t) => t.key)).toContain('name');
    expect(renderHtml(template, { mergeValues: { name: '山田' } })).toContain('>山田</td>');
  });

  it('行・列の追加と削除（上限と下限を守る）', () => {
    const block = createBlock('table', {
      cells: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    });
    const ops = tableOps(block);
    expect(ops.insertRow(1)?.cells).toEqual([
      ['a', 'b'],
      ['', ''],
      ['c', 'd'],
    ]);
    expect(ops.removeRow(0)?.cells).toEqual([['c', 'd']]);
    const inserted = ops.insertColumn(1);
    expect(inserted?.cells).toEqual([
      ['a', '', 'b'],
      ['c', '', 'd'],
    ]);
    expect(inserted?.columns).toHaveLength(3);
    expect(ops.removeColumn(0)?.cells).toEqual([['b'], ['d']]);
    const single = tableOps(
      createBlock('table', { cells: [['a']], columns: [{ width: null, align: 'left' }] }),
    );
    expect(single.removeRow(0)).toBeNull();
    expect(single.removeColumn(0)).toBeNull();
  });
});

describe('メニューブロック', () => {
  const items = [
    { label: '新着', href: 'https://e.com/new' },
    { label: 'セール', href: 'https://e.com/sale' },
    { label: '', href: 'https://e.com/empty' },
  ];

  it('リンクを区切り文字でつないで 1 行に並べる（空の項目は出さない）', () => {
    const { template } = templateWith('menu', { items, separator: '/', color: '#111111' });
    const html = renderHtml(template);
    expect(html).toContain('<a href="https://e.com/new" target="_blank" style="color:#111111;');
    expect(html).toMatch(
      /新着<\/a><!--\[if mso\]>&nbsp;<!\[endif\]--><span style="padding:0 6px;color:#c5cad1;">\/<\/span>/,
    );
    expect(html).not.toContain('e.com/empty');
    expect(renderText(template)).toBe('新着: https://e.com/new\nセール: https://e.com/sale');
  });

  it('項目が無ければ何も出力しない', () => {
    const { template } = templateWith('menu', {});
    expect(renderHtml(template)).not.toContain('<p style="margin:0;');
  });

  it('差し込み変数を検査する', () => {
    const { template } = templateWith('menu', {
      items: [{ label: '{{shop}}', href: 'https://e.com/?u={{uid}}' }],
    });
    expect(
      findMergeTags(template)
        .map((t) => t.key)
        .sort(),
    ).toEqual(['shop', 'uid']);
  });
});

describe('ボタンの並びブロック', () => {
  const items = [
    { label: '購入する', href: 'https://e.com/buy', backgroundColor: '#0066cc', color: '#ffffff' },
    { label: '詳しく', href: 'https://e.com/more', backgroundColor: '#eeeeee', color: '#111111' },
  ];

  it('ボタンを横に並べ、スマホでは縦に並べる', () => {
    const { template } = templateWith('buttons', { items });
    const html = renderHtml(template);
    expect(html.match(/<v:roundrect/g)).toHaveLength(2);
    expect(html).toContain('<td class="mm-col" align="center"');
    expect(html).toContain(
      '<td class="mm-col mm-stack-gap" align="center" valign="middle" style="padding-left:12px;">',
    );
    expect(html).toContain('.mm-stack-gap{padding-top:12px !important;}');
    expect(renderText(template)).toBe(
      '▶ 購入する\n  https://e.com/buy\n▶ 詳しく\n  https://e.com/more',
    );
  });

  it('等幅にするとブロック幅を等分する', () => {
    const { template } = templateWith('buttons', { items, equalWidth: true, stackOnMobile: false });
    const html = renderHtml(template);
    expect(html).toContain('<td align="center" valign="middle" width="284" style="width:284px;">');
    expect(html).toContain('width="296" style="padding-left:12px;width:296px;"');
    expect(html).not.toContain('class="mm-col');
  });
});

describe('画像ギャラリーブロック', () => {
  it('列の数で折り返し、行の間の余白は最後の行に付けない', () => {
    const { template } = templateWith('gallery', {
      columns: '2',
      gap: 10,
      items: ['a', 'b', 'c'].map((n) => ({ image: image(n), href: '' })),
    });
    const html = renderHtml(template);
    expect(html.match(/<tr>/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('style="width:290px;padding:0 5px 10px 0;"');
    expect(html).toContain('style="width:290px;padding:0 0 0 5px;"');
    expect(html).toContain('width="285"');
    expect(html).not.toContain('margin-bottom:-');
    expect(renderText(template)).toBe('[a]\n[b]\n[c]');
  });

  it('スマホで縦に並べるとき、空きのセルは隠す', () => {
    const { template } = templateWith('gallery', {
      columns: '3',
      stackOnMobile: true,
      items: ['a', 'b', 'c', 'd', 'e'].map((n) => ({
        image: image(n),
        href: 'https://e.com/' + n,
      })),
    });
    const html = renderHtml(template);
    expect(html.match(/class="mm-col mm-hide-mobile"/g)).toHaveLength(1);
    expect(html.match(/class="mm-col mm-stack-gap"/g)).toHaveLength(1);
    expect(html).toContain('<a href="https://e.com/a" target="_blank"><img class="mm-fluid"');
    expect(html).toContain('.mm-fluid{max-width:100% !important;height:auto !important;}');
  });

  it('画像が無ければ何も出力しない', () => {
    const { template } = templateWith('gallery', {
      items: [{ image: image(''), href: '' }].map((i) => ({
        ...i,
        image: { ...i.image, src: '' },
      })),
    });
    expect(renderHtml(template)).not.toContain('<img');
  });
});

describe('動画ブロック', () => {
  const thumbnail = image('thumb');
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  it('サムネイルを背景に敷き（Outlook は VML）、再生ボタンから動画にリンクする', () => {
    const { template } = templateWith('video', { url, thumbnail });
    const html = renderHtml(template);
    expect(html).toContain(
      '<td class="mm-video mm-video-169" background="https://cdn.example.com/thumb.jpg"',
    );
    expect(html).toContain('height="326"');
    expect(html).toContain("background-image:url('https://cdn.example.com/thumb.jpg')");
    expect(html).toContain(
      '<v:fill type="frame" src="https://cdn.example.com/thumb.jpg" color="#000000" />',
    );
    expect(html).toContain(`<a href="${url}" target="_blank" title="thumb" aria-label="thumb"`);
    expect(html).toContain('&#9654;&#65038;');
    expect(html).toContain('.mm-video-169{height:50vw !important;}');
    expect(renderText(template)).toBe(`▶ thumb\n  ${url}`);
  });

  it('縦横比と再生ボタンの色', () => {
    const { template } = templateWith('video', {
      url,
      thumbnail,
      ratio: '1:1',
      playButton: 'light',
    });
    const html = renderHtml(template);
    expect(html).toContain('height="580"');
    expect(html).toContain('mm-video-11');
    expect(html).toContain('background-color:#ffffff;border-radius:50%;color:#1f2328;');
  });

  it('狭い動画はスマホで高さを変えない', () => {
    const { template } = templateWith('video', {
      url,
      thumbnail,
      width: { unit: 'px', value: 300 },
    });
    expect(renderHtml(template)).toContain('<td class="mm-video" background=');
  });

  it('再生ボタンなしなら、画像にリンクを付けて出す', () => {
    const { template } = templateWith('video', { url, thumbnail, playButton: 'none' });
    const html = renderHtml(template);
    expect(html).toContain(
      `<a href="${url}" target="_blank"><img src="https://cdn.example.com/thumb.jpg"`,
    );
    expect(html).not.toContain('v:rect');
  });

  it('サムネイルが無ければ何も出力しない', () => {
    const { template } = templateWith('video', { url });
    expect(renderHtml(template)).not.toContain('mm-video"');
    expect(renderText(template)).toBe(`▶ ${url}`);
  });

  it('CSS の url() を壊す文字をエスケープする', () => {
    const { template } = templateWith('video', {
      url,
      thumbnail: { ...thumbnail, src: "https://e.com/a b'(1).jpg" },
    });
    expect(renderHtml(template)).toContain("url('https://e.com/a%20b%27%281%29.jpg')");
  });

  it('YouTube の URL から動画 ID とサムネイルを取り出す', () => {
    expect(youtubeVideoId(url)).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(youtubeVideoId('https://vimeo.com/123')).toBeNull();
    expect(youtubeThumbnail('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      naturalWidth: 480,
      naturalHeight: 360,
    });
  });
});

describe('新しいブロックの検査', () => {
  it('不正な値を直して警告する', () => {
    const template = createTemplate();
    const blocks = [
      Object.assign(createBlock('menu'), {
        values: { ...createBlock('menu').values, items: [{ label: 1 }] },
      }),
      Object.assign(createBlock('gallery'), {
        values: { ...createBlock('gallery').values, columns: '5' },
      }),
      Object.assign(createBlock('video'), {
        values: { ...createBlock('video').values, ratio: '21:9' },
      }),
    ];
    template.body.rows.push(createRow('1', [blocks]));
    const result = validate(template);
    expect(result.valid).toBe(false);
    const fixed = migrate(template).template.body.rows[0].columns[0].blocks.map((b) => b.values);
    expect(/** @type {any} */ (fixed[0]).items[0]).toEqual({ label: '', href: '' });
    expect(/** @type {any} */ (fixed[1]).columns).toBe('2');
    expect(/** @type {any} */ (fixed[2]).ratio).toBe('16:9');
  });
});
