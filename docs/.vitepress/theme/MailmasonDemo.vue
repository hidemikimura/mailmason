<script setup>
// ドキュメント用のデモ。<mailmason-editor> はブラウザでだけ読み込む（ビルド時のプリレンダリングでは描画しない）
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData, withBase } from 'vitepress';
import { DEMO_MERGE_TAGS, DEMO_TEMPLATES, withDemoImages } from './templates.js';

const props = defineProps({
  /** 最初に読み込むテンプレート（DEMO_TEMPLATES の id） */
  template: { type: String, default: 'newsletter' },
  /** エディタの高さ（CSS の値） */
  height: { type: String, default: '720px' },
  /** 書き出し欄やテンプレートの切り替えを出すか */
  controls: { type: Boolean, default: true },
});

const { isDark } = useData();
const editor = ref(null);
const ready = ref(false);
const selected = ref(props.template);
const locale = ref('ja');
const tab = ref('json');
const output = ref('');
const warnings = ref([]);
const copied = ref(false);
let timer = 0;

const tabs = [
  { id: 'json', label: 'テンプレート JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'text', label: 'テキストパート' },
];

function imageBase() {
  return new URL(withBase('/demo/'), window.location.href).href;
}

function load(id) {
  const entry = DEMO_TEMPLATES.find((t) => t.id === id);
  const el = editor.value;
  if (!el || !entry) return;
  warnings.value = [];
  if (entry.template) el.loadJson(withDemoImages(entry.template, imageBase()));
  else el.loadJson({ version: 1, body: { rows: [] } });
  refresh();
}

function refresh() {
  const el = editor.value;
  if (!el || !props.controls) return;
  if (tab.value === 'json') output.value = JSON.stringify(el.getJson(), null, 2);
  else if (tab.value === 'html') output.value = el.exportHtml();
  else output.value = el.exportText();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(output.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // クリップボードを使えない環境では何もしない
  }
}

function download() {
  const types = {
    json: ['application/json', 'json'],
    html: ['text/html', 'html'],
    text: ['text/plain', 'txt'],
  };
  const [type, ext] = types[tab.value];
  const url = URL.createObjectURL(new Blob([output.value], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `mailmason.${ext}` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// デモ用の「アップロード」。送信せずに data URL を返す（メールでは data URL の画像は表示されないので本番では使わない）
function fakeUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => setTimeout(() => resolve(reader.result), 600);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function onChange() {
  clearTimeout(timer);
  timer = setTimeout(refresh, 400);
}

function onWarning(event) {
  warnings.value = [event.detail, ...warnings.value].slice(0, 5);
}

onMounted(async () => {
  await import('@hidemikimura/mailmason');
  await customElements.whenDefined('mailmason-editor');
  const el = editor.value;
  el.mergeTags = DEMO_MERGE_TAGS;
  el.onImageUpload = fakeUpload;
  el.colorMode = isDark.value ? 'dark' : 'light';
  el.addEventListener('mm-change', onChange);
  el.addEventListener('mm-warning', onWarning);
  ready.value = true;
  load(selected.value);
});

onBeforeUnmount(() => clearTimeout(timer));

watch(isDark, (dark) => {
  if (editor.value) editor.value.colorMode = dark ? 'dark' : 'light';
});
watch(selected, (id) => load(id));
watch(locale, (value) => {
  if (editor.value) editor.value.locale = value;
  refresh();
});
watch(tab, refresh);

const outputLabel = computed(() => tabs.find((t) => t.id === tab.value)?.label ?? '');
</script>

<template>
  <div class="mm-demo">
    <div v-if="controls" class="mm-demo-bar">
      <label>
        テンプレート
        <select v-model="selected">
          <option v-for="t in DEMO_TEMPLATES" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </label>
      <label>
        UI の言語
        <select v-model="locale">
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </label>
      <span class="mm-demo-hint"
        >画像はドロップや貼り付けでも差し替えられます（デモでは送信しません）</span
      >
    </div>
    <div class="mm-demo-frame" :style="{ height }">
      <mailmason-editor ref="editor" />
      <div v-if="!ready" class="mm-demo-loading">エディタを読み込んでいます…</div>
    </div>
    <div v-if="controls" class="mm-demo-output">
      <div class="mm-demo-tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
        <span class="spacer" />
        <button type="button" class="action" @click="copy">
          {{ copied ? 'コピーしました' : 'コピー' }}
        </button>
        <button type="button" class="action" @click="download">ダウンロード</button>
      </div>
      <pre :aria-label="outputLabel"><code>{{ output }}</code></pre>
      <ul v-if="warnings.length" class="mm-demo-warnings">
        <li v-for="(w, i) in warnings" :key="i">
          <code>{{ w.code }}</code> {{ w.message }}
        </li>
      </ul>
    </div>
  </div>
</template>
