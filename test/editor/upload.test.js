import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasBlocks, deep, fixtures, frame, mount, typeInto } from './helpers.js';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * 実際に読める PNG ファイルを作る
 * @param {number} width
 * @param {number} height
 * @param {string} [name]
 * @returns {Promise<File>}
 */
async function pngFile(width, height, name = 'photo.png') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  context.fillStyle = '#2f6fed';
  context.fillRect(0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([/** @type {Blob} */ (blob)], name, { type: 'image/png' });
}

/**
 * 外から解決できる Promise
 * @template T
 */
function deferred() {
  /** @type {(value: T) => void} */
  let resolve = () => {};
  /** @type {(reason: unknown) => void} */
  let reject = () => {};
  /** @type {Promise<T>} */
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * @param {File[]} files
 * @returns {DataTransfer}
 */
function transfer(files) {
  const data = new DataTransfer();
  for (const file of files) data.items.add(file);
  return data;
}

/**
 * ドラッグのイベント（コンストラクタが dataTransfer を受け付けないブラウザでは後から差し込む）
 * @param {string} type
 * @param {DataTransfer} data
 * @param {number} [x]
 * @param {number} [y]
 */
function dragEvent(type, data, x = 0, y = 0) {
  const init = { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y };
  const event =
    typeof DragEvent === 'function'
      ? new DragEvent(type, { ...init, dataTransfer: data })
      : new MouseEvent(type, init);
  if (/** @type {any} */ (event).dataTransfer !== data) {
    Object.defineProperty(event, 'dataTransfer', { value: data });
  }
  return event;
}

/**
 * 貼り付けのイベント
 * @param {File[]} files
 */
function pasteEvent(files) {
  const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, 'clipboardData', { value: transfer(files) });
  return event;
}

/**
 * @param {MailmasonEditor} el
 * @param {string} blockId
 */
function blockValues(el, blockId) {
  for (const row of el.getJson().body.rows) {
    for (const column of row.columns) {
      const block = column.blocks.find((b) => b.id === blockId);
      if (block) return /** @type {any} */ (block.values);
    }
  }
  return null;
}

/**
 * フックを持つエディタ。hook は呼ばれるたびに新しい deferred を返す
 * @param {Record<string, unknown>} [props]
 */
async function setup(props = {}) {
  /** @type {Array<ReturnType<typeof deferred<any>>>} */
  const calls = [];
  const onImageUpload = vi.fn(() => {
    const d = deferred();
    calls.push(d);
    return d.promise;
  });
  const el = await mount({ onImageUpload, ...props });
  el.loadJson(fixtures.basic);
  await frame();
  const warnings = /** @type {any[]} */ ([]);
  el.addEventListener('mm-warning', (e) => warnings.push(/** @type {CustomEvent} */ (e).detail));
  return { el, onImageUpload, calls, warnings };
}

/**
 * 設定パネルの画像欄
 * @param {MailmasonEditor} el
 * @param {string} [key]
 */
const imageField = (el, key = 'src') =>
  /** @type {HTMLElement} */ (deep(el, 'mm-settings-panel', `[data-key="${key}"]`));

/** @param {MailmasonEditor} el */
async function settle(el) {
  await frame();
  await frame();
  await /** @type {any} */ (deep(el, 'mm-settings-panel'))?.updateComplete;
}

describe('画像のアップロード', () => {
  it('onImageUpload が無ければアップロードの操作を出さない', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    el.select('b_banner01');
    await frame();
    expect(imageField(el).querySelector('[data-action="upload"]')).toBeNull();
    expect(imageField(el).querySelector('input[type="file"]')).toBeNull();
  });

  it('設定パネルの「アップロード…」で選んだファイルをフックに渡し、返った URL と実寸を設定する', async () => {
    const { el, onImageUpload, calls } = await setup();
    el.select('b_banner01');
    await frame();
    const field = imageField(el);
    const input = /** @type {HTMLInputElement} */ (field.querySelector('input[type="file"]'));
    expect(input.accept).toBe('image/png,image/jpeg,image/gif');
    const clicked = vi.fn();
    input.addEventListener('click', (e) => {
      e.preventDefault(); // ファイル選択ダイアログは開かない
      clicked();
    });
    /** @type {HTMLButtonElement} */ (field.querySelector('[data-action="upload"]')).click();
    expect(clicked).toHaveBeenCalled();

    const file = await pngFile(40, 20);
    input.files = transfer([file]).files;
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(onImageUpload).toHaveBeenCalled());
    expect(onImageUpload).toHaveBeenCalledWith(file, { blockId: 'b_banner01', target: 'block' });

    // アップロード中: 設定パネルとキャンバスに表示し、手元のファイルを仮表示する
    await settle(el);
    expect(imageField(el).querySelector('.status')).not.toBeNull();
    const block = canvasBlocks(el)[0];
    expect(block.shadowRoot.querySelector('.uploading')).not.toBeNull();
    expect(block.shadowRoot.querySelector('.upload-preview')?.getAttribute('src')).toMatch(
      /^blob:/,
    );

    calls[0].resolve('https://cdn.example.com/photo.png');
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').src).toBe('https://cdn.example.com/photo.png'),
    );
    expect(blockValues(el, 'b_banner01')).toMatchObject({ naturalWidth: 40, naturalHeight: 20 });
    expect(blockValues(el, 'b_banner01').alt).toBe('秋の新作'); // 既存の代替テキストは残す
    await settle(el);
    expect(canvasBlocks(el)[0].shadowRoot.querySelector('.uploading')).toBeNull();

    // Undo で元の画像に戻る
    el.undo();
    expect(blockValues(el, 'b_banner01').src).toBe(
      fixtures.basic.body.rows[0].columns[0].blocks[0].values.src,
    );
  });

  it('フックが { src, alt } を返し、代替テキストが空なら alt も設定する', async () => {
    const { el, calls } = await setup();
    el.store.dispatch({ type: 'updateBlockValues', blockId: 'b_banner01', patch: { alt: '' } });
    el.select('b_banner01');
    await frame();
    imageField(el)
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(10, 10)])));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].resolve({ src: 'https://cdn.example.com/a.png', alt: '新作の写真' });
    await vi.waitFor(() => expect(blockValues(el, 'b_banner01').alt).toBe('新作の写真'));
  });

  it('フックが { url, data } を返すと、data を uploadData に保存する（差し替えで置き換え、URL の手入力で消す）', async () => {
    const { el, calls } = await setup();
    el.select('b_banner01');
    await frame();
    const drop = async () =>
      imageField(el)
        .querySelector('.image')
        ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(10, 10)])));

    await drop();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    const data = { id: 'img_1', key: 'uploads/2026/a.png', tags: ['autumn'] };
    calls[0].resolve({ url: 'https://cdn.example.com/a.png', data });
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').src).toBe('https://cdn.example.com/a.png'),
    );
    expect(blockValues(el, 'b_banner01').uploadData).toEqual(data);
    expect(el.exportHtml()).not.toContain('img_1');

    // 別の data で差し替え: 前のキーは残らない
    await drop();
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    calls[1].resolve({ url: 'https://cdn.example.com/b.png', data: { id: 'img_2' } });
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').uploadData).toEqual({ id: 'img_2' }),
    );

    // URL の文字列だけを返すと、前のデータは消す
    await drop();
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    calls[2].resolve('https://cdn.example.com/c.png');
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').src).toBe('https://cdn.example.com/c.png'),
    );
    expect(blockValues(el, 'b_banner01').uploadData).toBeNull();

    // URL を手で変えるとデータを消す
    await drop();
    await vi.waitFor(() => expect(calls).toHaveLength(4));
    calls[3].resolve({ url: 'https://cdn.example.com/d.png', data: { id: 'img_4' } });
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').uploadData).toEqual({ id: 'img_4' }),
    );
    await settle(el);
    typeInto(
      /** @type {HTMLInputElement} */ (imageField(el).querySelector('input[type="text"]')),
      'https://other.example.com/e.png',
    );
    await frame();
    expect(blockValues(el, 'b_banner01').uploadData).toBeNull();
  });

  it('onImageSelect も { url, data } を返せる', async () => {
    const el = await mount({
      onImageSelect: async () => ({ url: 'https://cdn.example.com/lib.png', data: { assetId: 7 } }),
    });
    el.loadJson(fixtures.basic);
    el.select('b_item0001');
    await frame();
    const button = /** @type {HTMLButtonElement} */ (
      [...imageField(el, 'image.src').querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === '選択…',
      )
    );
    button.click();
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_item0001').image).toMatchObject({
        src: 'https://cdn.example.com/lib.png',
        uploadData: { assetId: 7 },
      }),
    );
  });

  it('画像＋テキストの画像にもアップロードできる', async () => {
    const { el, calls } = await setup();
    el.select('b_item0001');
    await frame();
    imageField(el, 'image.src')
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(30, 30)])));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].resolve('https://cdn.example.com/item.png');
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_item0001').image).toMatchObject({
        src: 'https://cdn.example.com/item.png',
        naturalWidth: 30,
        naturalHeight: 30,
      }),
    );
  });

  it('失敗したら設定パネルに理由を出し、mm-warning を発火する', async () => {
    const { el, calls, warnings } = await setup();
    el.select('b_banner01');
    await frame();
    imageField(el)
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(10, 10)])));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].reject(new Error('サーバーエラー'));
    await vi.waitFor(() =>
      expect(warnings.some((w) => w.code === 'image-upload-failed')).toBe(true),
    );
    await settle(el);
    expect(imageField(el).querySelector('.error')?.textContent).toContain('サーバーエラー');
    expect(blockValues(el, 'b_banner01').src).toBe(
      fixtures.basic.body.rows[0].columns[0].blocks[0].values.src,
    );

    // 選択を変えると失敗の表示は消える
    el.select('b_text0001');
    el.select('b_banner01');
    await settle(el);
    expect(imageField(el).querySelector('.error')).toBeNull();
  });

  it('PNG・JPEG・GIF 以外や大きすぎるファイルはフックに渡さない', async () => {
    const { el, onImageUpload, warnings } = await setup({ maxImageSize: 50 });
    el.select('b_banner01');
    await frame();
    const webp = new File(['x'], 'a.webp', { type: 'image/webp' });
    imageField(el)
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([webp])));
    await settle(el);
    expect(warnings.at(-1)).toMatchObject({ code: 'image-upload-type', fileName: 'a.webp' });
    expect(imageField(el).querySelector('.error')?.textContent).toContain('PNG・JPEG・GIF');

    imageField(el)
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(50, 50)])));
    await settle(el);
    expect(warnings.at(-1)).toMatchObject({ code: 'image-upload-size' });
    expect(onImageUpload).not.toHaveBeenCalled();
  });

  it('キャンバスの画像ブロックにファイルを落とすと差し替える（枠で示す）', async () => {
    const { el, calls, onImageUpload } = await setup();
    const banner = canvasBlocks(el)[0].getBoundingClientRect();
    const x = banner.left + 20;
    const y = banner.top + 20;
    const data = transfer([await pngFile(60, 30)]);
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    const over = dragEvent('dragover', data, x, y);
    canvas.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    const indicator = /** @type {HTMLElement} */ (
      el.shadowRoot?.querySelector('.mm-drop-indicator')
    );
    expect(indicator.hidden).toBe(false);
    expect(indicator.classList.contains('box')).toBe(true);

    canvas.dispatchEvent(dragEvent('drop', data, x, y));
    expect(el.shadowRoot?.querySelector('.mm-drop-indicator')).toBeNull();
    await vi.waitFor(() => expect(onImageUpload).toHaveBeenCalled());
    expect(onImageUpload.mock.calls[0][1]).toEqual({ blockId: 'b_banner01', target: 'block' });
    expect(el.getJson().body.rows).toHaveLength(4); // ブロックは増やさない
    calls[0].resolve('https://cdn.example.com/new-banner.png');
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').src).toBe('https://cdn.example.com/new-banner.png'),
    );
  });

  it('行間やカラムに落とすと、ファイルごとに新しい画像ブロックを作ってアップロードする', async () => {
    const { el, calls, onImageUpload } = await setup();
    const text = canvasBlocks(el)[1].getBoundingClientRect();
    const data = transfer([await pngFile(20, 20, 'a.png'), await pngFile(20, 20, 'b.png')]);
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    canvas.dispatchEvent(dragEvent('dragover', data, text.left + 40, text.bottom - 12));
    canvas.dispatchEvent(dragEvent('drop', data, text.left + 40, text.bottom - 12));
    await frame();
    const blocks = el.getJson().body.rows[1].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual(['text', 'image', 'image', 'button']);
    expect(el.store.getState().selection).toBe(blocks[1].id);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    // 画像の大きさを測る時間しだいで呼ばれる順は前後する（Firefox）ので、渡されたファイル名で返す
    calls.forEach((call, i) => {
      const file = /** @type {File} */ (/** @type {any[]} */ (onImageUpload.mock.calls[i])[0]);
      call.resolve(`https://cdn.example.com/${file.name}`);
    });
    await vi.waitFor(() =>
      expect(blockValues(el, blocks[2].id).src).toBe('https://cdn.example.com/b.png'),
    );
    expect(blockValues(el, blocks[1].id).src).toBe('https://cdn.example.com/a.png');
  });

  it('画像以外のファイルを落としても、ブロックは作らず警告だけ出す', async () => {
    const { el, warnings } = await setup();
    const text = canvasBlocks(el)[1].getBoundingClientRect();
    const data = transfer([new File(['a'], 'memo.txt', { type: 'text/plain' })]);
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    canvas.dispatchEvent(dragEvent('dragover', data, text.left + 40, text.bottom - 12));
    canvas.dispatchEvent(dragEvent('drop', data, text.left + 40, text.bottom - 12));
    await frame();
    expect(el.getJson()).toEqual(fixtures.basic);
    expect(warnings.at(-1)).toMatchObject({ code: 'image-upload-type', fileName: 'memo.txt' });
  });

  it('フックが無くても、ファイルを落としたときにページを開き直さない', async () => {
    const el = await mount();
    el.loadJson(fixtures.basic);
    await frame();
    const data = transfer([await pngFile(10, 10)]);
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    const over = dragEvent('dragover', data, 400, 300);
    canvas.dispatchEvent(over);
    const drop = dragEvent('drop', data, 400, 300);
    canvas.dispatchEvent(drop);
    expect(over.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    expect(el.getJson()).toEqual(fixtures.basic);
  });

  it('画像ブロックを選択中に画像を貼り付けると差し替え、ほかの要素なら画像ブロックを追加する', async () => {
    const { el, calls } = await setup();
    el.select('b_banner01');
    const canvas = /** @type {HTMLElement} */ (deep(el, 'mm-canvas'));
    const first = pasteEvent([await pngFile(10, 10)]);
    canvas.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].resolve('https://cdn.example.com/pasted.png');
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').src).toBe('https://cdn.example.com/pasted.png'),
    );

    el.select('b_text0001');
    canvas.dispatchEvent(pasteEvent([await pngFile(10, 10)]));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    const blocks = el.getJson().body.rows[1].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual(['text', 'image', 'button']);
    calls[1].resolve('https://cdn.example.com/pasted2.png');
    await vi.waitFor(() =>
      expect(blockValues(el, blocks[1].id).src).toBe('https://cdn.example.com/pasted2.png'),
    );
  });

  it('アップロード中にブロックを消したり、別の画像を選び直したりしたら、古い結果は使わない', async () => {
    const { el, calls, warnings } = await setup();
    el.select('b_banner01');
    await frame();
    const field = () => imageField(el);
    field()
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(10, 10)])));
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    field()
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(20, 20)])));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    calls[1].resolve('https://cdn.example.com/second.png');
    await vi.waitFor(() =>
      expect(blockValues(el, 'b_banner01').src).toBe('https://cdn.example.com/second.png'),
    );
    calls[0].resolve('https://cdn.example.com/first.png');
    await frame();
    expect(blockValues(el, 'b_banner01').src).toBe('https://cdn.example.com/second.png');

    field()
      .querySelector('.image')
      ?.dispatchEvent(dragEvent('drop', transfer([await pngFile(10, 10)])));
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    el.store.dispatch({ type: 'removeBlock', blockId: 'b_banner01' });
    calls[2].resolve('https://cdn.example.com/third.png');
    await frame();
    expect(blockValues(el, 'b_banner01')).toBeNull();
    expect(warnings).toEqual([]);
  });
});
