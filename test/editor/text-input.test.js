// 公開の部品 <mm-text-input> をエディタの外で使う
import { afterEach, describe, expect, it } from 'vitest';
import { MmTextInput, createBlock, createRow, createTemplate } from '../../src/index.js';
import { loadMessages } from '../../src/editor/i18n.js';
import { frame, mount, press, typeInto } from './helpers.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const TAGS = [
  { key: 'name', label: '氏名', group: '会員' },
  { key: 'order.id', label: '注文番号', group: '注文' },
  { key: 'coupon', label: 'クーポンコード', group: 'クーポン' },
];

/**
 * エディタを置かずに入力欄だけを置く
 * @param {Record<string, unknown>} [props]
 * @param {string} [attributes]
 */
async function place(props = {}, attributes = '') {
  document.body.innerHTML = `<label for="subject">件名</label>
    <mm-text-input input-id="subject" ${attributes}></mm-text-input>`;
  const el = /** @type {MmTextInput} */ (document.querySelector('mm-text-input'));
  Object.assign(el, { tags: TAGS, ...props });
  await el.updateComplete;
  const input = /** @type {HTMLInputElement} */ (el.querySelector('input'));
  /** @type {{ type: string, value: string }[]} */
  const events = [];
  for (const type of ['mm-value-input', 'mm-value-change']) {
    el.addEventListener(type, (event) =>
      events.push({ type, value: /** @type {CustomEvent} */ (event).detail.value }),
    );
  }
  return { el, input, events };
}

/** @param {MmTextInput} el */
async function openPicker(el) {
  const picker = /** @type {any} */ (el.querySelector('mm-merge-tag-picker'));
  picker.shadowRoot.querySelector('.toggle').click();
  await picker.updateComplete;
  const search = picker.shadowRoot.querySelector('.search');
  return { picker, search };
}

describe('<mm-text-input>（エディタの外）', () => {
  it('パッケージから import でき、要素として登録されている', () => {
    expect(customElements.get('mm-text-input')).toBe(MmTextInput);
  });

  it('外の <label for> が中の欄を指す', async () => {
    const { input } = await place();
    expect(input.id).toBe('subject');
    expect(/** @type {HTMLLabelElement} */ (document.querySelector('label')).control).toBe(input);
  });

  it('display-labels なら表示名で見せ、value とイベントはキーで返す', async () => {
    const { el, input, events } = await place({}, 'display-labels');
    el.value = 'ご注文ありがとうございます（{{order.id}}）';
    await el.updateComplete;
    expect(input.value).toBe('ご注文ありがとうございます（{{注文番号}}）');

    // 候補から入れる
    input.setSelectionRange(0, 0);
    const { search } = await openPicker(el);
    search.value = 'name';
    search.dispatchEvent(new Event('input'));
    await frame();
    press(search, 'Enter');
    await el.updateComplete;
    expect(input.value).toBe('{{氏名}}ご注文ありがとうございます（{{注文番号}}）');
    expect(el.value).toBe('{{name}}ご注文ありがとうございます（{{order.id}}）');
    expect(events.map((e) => e.type)).toEqual(['mm-value-input', 'mm-value-change']);
    expect(events.every((e) => e.value === el.value)).toBe(true);
  });

  it('表示名を手で打ってもキーで返し、どれにも一致しない {{…}} は打ったまま返す', async () => {
    const { el, input, events } = await place({}, 'display-labels');
    typeInto(input, '{{クーポンコード}} と {{未知の変数}} と {{ 氏名 }}');
    await el.updateComplete;
    expect(el.value).toBe('{{coupon}} と {{未知の変数}} と {{ name }}');
    expect(events.at(-1)).toEqual({ type: 'mm-value-change', value: el.value });
    // 欄の文字は打ったまま（キャレットや変換中の文字を動かさない）
    expect(input.value).toBe('{{クーポンコード}} と {{未知の変数}} と {{ 氏名 }}');
  });

  it('表示名が重なる・区切り文字を含む候補はキーのまま見せる', async () => {
    const tags = [
      { key: 'order.id', label: '注文番号', group: '注文' },
      { key: 'return.id', label: '注文番号', group: '返品' },
      { key: 'odd', label: 'a}}b' },
      { key: 'name', label: '氏名' },
    ];
    const { el, input } = await place({ tags }, 'display-labels');
    el.value = '{{order.id}} {{return.id}} {{odd}} {{name}}';
    await el.updateComplete;
    expect(input.value).toBe('{{order.id}} {{return.id}} {{odd}} {{氏名}}');
    typeInto(input, '{{注文番号}}');
    await el.updateComplete;
    expect(el.value).toBe('{{注文番号}}');
  });

  it('display-labels が無ければキーのまま見せる', async () => {
    const { el, input } = await place();
    el.value = '{{name}} 様';
    await el.updateComplete;
    expect(input.value).toBe('{{name}} 様');
  });

  it('入力のたびに value が変わり、外から同じ値を入れ直すと欄が戻る', async () => {
    const { el, input } = await place();
    el.value = '元の件名';
    await el.updateComplete;
    typeInto(input, '書き換えた件名');
    await el.updateComplete;
    expect(el.value).toBe('書き換えた件名');
    el.value = '元の件名';
    await el.updateComplete;
    expect(input.value).toBe('元の件名');
  });

  it('{{ を打つとその場に候補を出し、選ぶと表示名で入る', async () => {
    const { el, input } = await place({}, 'display-labels');
    input.focus();
    input.value = '件名 {{注文';
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const list = /** @type {any} */ (el.querySelector('.mm-text-input-suggest mm-merge-tag-list'));
    expect(list).not.toBeNull();
    await list.updateComplete;
    press(input, 'Enter');
    await el.updateComplete;
    expect(input.value).toBe('件名 {{注文番号}}');
    expect(el.value).toBe('件名 {{order.id}}');
  });

  it('merge-tag-trigger="false" なら打っても候補を出さない', async () => {
    const { el, input } = await place({}, 'merge-tag-trigger="false"');
    expect(el.mergeTagTrigger).toBe(false);
    input.value = '{{';
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el.querySelector('.mm-text-input-suggest')).toBeNull();
  });

  it('文言の初期値を持ち、locale と messages で変えられる', async () => {
    await loadMessages('en');
    const { el } = await place();
    const button = () =>
      /** @type {any} */ (el.querySelector('mm-merge-tag-picker')).shadowRoot
        .querySelector('.toggle')
        .textContent.trim();
    expect(button()).toBe('差し込み…');
    el.locale = 'en';
    await el.updateComplete;
    await frame();
    expect(button()).toBe('Insert…');
    el.messages = { 'mergeTag.insert': '変数を入れる' };
    await el.updateComplete;
    await frame();
    expect(button()).toBe('変数を入れる');
  });

  it('エディタを置かないページでも、枠と候補の一覧の見た目が付く', async () => {
    const { el, input } = await place({}, 'multiline');
    const textarea = /** @type {HTMLTextAreaElement} */ (el.querySelector('textarea'));
    expect(input).toBeNull();
    const style = getComputedStyle(textarea);
    expect(style.borderTopColor).toBe('rgb(216, 220, 225)');
    expect(style.borderTopStyle).toBe('solid');
    expect(getComputedStyle(el).getPropertyValue('--mm-color-accent').trim()).toBe('#2f6fed');

    // 色は外から変えられる。候補の一覧の幅も変数で変えられる
    el.style.setProperty('--mm-color-border', 'rgb(255, 0, 0)');
    el.style.setProperty('--mm-suggest-width', '400px');
    expect(getComputedStyle(textarea).borderTopColor).toBe('rgb(255, 0, 0)');
    textarea.value = '{{';
    textarea.setSelectionRange(2, 2);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const suggest = /** @type {HTMLElement} */ (el.querySelector('.mm-text-input-suggest'));
    expect(getComputedStyle(suggest).position).toBe('absolute');
    expect(suggest.getBoundingClientRect().width).toBe(400);
  });

  it('disabled なら欄と「差し込み…」ボタンの両方が使えない', async () => {
    const { el, input } = await place({}, 'disabled');
    const picker = /** @type {any} */ (el.querySelector('mm-merge-tag-picker'));
    await picker.updateComplete;
    expect(input.disabled).toBe(true);
    expect(picker.shadowRoot.querySelector('.toggle').disabled).toBe(true);
  });
});

describe('<mm-text-input>（エディタの中）', () => {
  it('設定欄の入力欄のイベントはエディタの外に出ない', async () => {
    const el = await mount({ mergeTags: TAGS });
    const template = createTemplate();
    const block = createBlock('button', { label: 'ボタン' });
    template.body.rows.push(createRow('1', [[block]]));
    el.loadJson(template);
    el.select(block.id);
    await frame();
    /** @type {string[]} */
    const leaked = [];
    for (const type of ['mm-value-input', 'mm-value-change']) {
      el.addEventListener(type, () => leaked.push(type));
    }
    const panel = /** @type {any} */ (el.shadowRoot?.querySelector('mm-settings-panel'));
    const input = panel.shadowRoot.querySelector('[data-key="label"] input');
    typeInto(input, '{{氏名}} 様');
    await frame();
    expect(el.getJson().body.rows[0].columns[0].blocks[0].values.label).toBe('{{name}} 様');
    expect(leaked).toEqual([]);
  });
});

describe('<mm-text-input> とフォーム・読み上げ', () => {
  /** @param {string} attributes */
  async function inForm(attributes) {
    document.body.innerHTML = `<form>
      <fieldset>
        <mm-text-input ${attributes}></mm-text-input>
      </fieldset>
    </form>`;
    const form = /** @type {HTMLFormElement} */ (document.querySelector('form'));
    const el = /** @type {MmTextInput} */ (document.querySelector('mm-text-input'));
    el.tags = TAGS;
    await el.updateComplete;
    const input = /** @type {HTMLInputElement} */ (el.querySelector('input'));
    return { form, el, input };
  }

  it('<form> の中に置くと name の値（キー）が送られ、required が効く', async () => {
    const { form, el, input } = await inForm('name="subject" required display-labels');
    expect(el.form).toBe(form);
    expect(form.checkValidity()).toBe(false);
    expect(el.validity.valueMissing).toBe(true);
    expect(el.validationMessage).toBe('入力してください');
    expect(input.getAttribute('aria-required')).toBe('true');

    typeInto(input, '{{注文番号}} のお知らせ');
    await el.updateComplete;
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get('subject')).toBe('{{order.id}} のお知らせ');
    // 中の欄は送らない（name が無い）
    expect([...new FormData(form).keys()]).toEqual(['subject']);
  });

  it('maxlength はキーで書いた値の文字数で検査する', async () => {
    const { el, input } = await inForm('name="subject" maxlength="10"');
    typeInto(input, '{{order.id}}');
    await el.updateComplete;
    expect(el.checkValidity()).toBe(false);
    expect(el.validity.tooLong).toBe(true);
    expect(el.validationMessage).toBe('10 文字以内で入力してください');
    typeInto(input, '{{name}}');
    await el.updateComplete;
    expect(el.checkValidity()).toBe(true);
  });

  it('フォームのリセットで value 属性の値に戻り、<fieldset disabled> で使えなくなる', async () => {
    const { form, el, input } = await inForm('name="subject" value="元の件名"');
    typeInto(input, '書き換えた');
    await el.updateComplete;
    form.reset();
    await el.updateComplete;
    expect(el.value).toBe('元の件名');
    expect(input.value).toBe('元の件名');

    /** @type {HTMLFieldSetElement} */ (form.querySelector('fieldset')).disabled = true;
    await el.updateComplete;
    expect(input.disabled).toBe(true);
  });

  it('autocomplete・aria-describedby・aria-invalid を中の欄に写す', async () => {
    const { input } = await inForm(
      'autocomplete="off" aria-describedby="subject-help" aria-invalid="true"',
    );
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('aria-describedby')).toBe('subject-help');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('入力中の候補を読み上げで選べる（combobox と aria-activedescendant）', async () => {
    const { el, input } = await place();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    input.focus();
    input.value = '{{';
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const list = /** @type {any} */ (el.querySelector('.mm-text-input-suggest mm-merge-tag-list'));
    await list.updateComplete;
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = document.getElementById(
      /** @type {string} */ (input.getAttribute('aria-controls')),
    );
    expect(listbox?.getAttribute('role')).toBe('listbox');
    const active = () =>
      document.getElementById(/** @type {string} */ (input.getAttribute('aria-activedescendant')));
    expect(active()?.dataset.key).toBe('name');
    press(input, 'ArrowDown');
    await list.updateComplete;
    expect(active()?.dataset.key).toBe('order.id');
    expect(active()?.getAttribute('aria-selected')).toBe('true');

    press(input, 'Escape');
    await el.updateComplete;
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(input.hasAttribute('aria-controls')).toBe(false);
  });

  it('候補が無いときは combobox にしない', async () => {
    const { input } = await place({ tags: [] });
    expect(input.hasAttribute('role')).toBe(false);
    expect(input.hasAttribute('aria-expanded')).toBe(false);
  });

  it('グループの説明を一覧に出す', async () => {
    const tags = [
      { key: 'name', label: '氏名', group: '会員', groupDescription: 'ログイン中の会員の情報' },
      { key: 'order.id', label: '注文番号', group: '注文' },
    ];
    const { el, input } = await place({ tags });
    input.focus();
    input.value = '{{';
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const list = /** @type {any} */ (el.querySelector('.mm-text-input-suggest mm-merge-tag-list'));
    await list.updateComplete;
    const descriptions = [...list.querySelectorAll('.group-description')];
    expect(descriptions.map((d) => d.textContent.trim())).toEqual(['ログイン中の会員の情報']);
    const group = list.querySelector('[role="group"]');
    expect(group.getAttribute('aria-describedby')).toBe(descriptions[0].id);
  });

  it('確定した値に tags に無いキーがあると mm-unknown-merge-tag を出す', async () => {
    const { el, input } = await place({}, 'display-labels');
    /** @type {string[][]} */
    const found = [];
    el.addEventListener('mm-unknown-merge-tag', (event) =>
      found.push(/** @type {CustomEvent} */ (event).detail.keys),
    );
    typeInto(input, '{{氏名}} {{未知の変数}} {{ shop_url }} {{未知の変数}}');
    await el.updateComplete;
    expect(found).toEqual([['未知の変数', 'shop_url']]);
    typeInto(input, '{{氏名}} 様');
    await el.updateComplete;
    expect(found).toHaveLength(1);
  });
});
