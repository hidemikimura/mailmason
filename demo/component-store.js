// デモ用のコンポーネントの保存先。実際のアプリではサーバー（DB）に保存し、チームで共有する。
// デモではこのブラウザの localStorage に置く（使えない環境ではページを開いている間だけ）

/**
 * @param {import('../src/index.js').MailmasonEditor} editor
 * @param {string} [key] localStorage のキー
 */
export function useDemoComponentStore(editor, key = 'mailmason-demo-components') {
  /** @param {unknown} list */
  const write = (list) => {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // 保存できない環境（プライベートブラウズなど）では何もしない
    }
  };
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
    editor.components = Array.isArray(saved) ? saved : [];
  } catch {
    editor.components = [];
  }
  editor.onSaveComponent = async (component) => {
    const saved = { ...component, id: `cmp_${Date.now().toString(36)}` };
    write([...editor.components, saved]);
    return saved; // id 付きで返すと、エディタが一覧に加える
  };
  editor.onDeleteComponent = async (component) => {
    write(editor.components.filter((c) => c.id !== component.id));
    return true;
  };
}
