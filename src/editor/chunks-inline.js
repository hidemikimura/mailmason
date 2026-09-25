// chunks.js の iife 版用の差し替え: 部品をはじめから読み込んでおく（<script> で読む 1 ファイルのため）
import * as qr from './qr.js';
import * as preview from './components/mm-preview.js';
import * as tableEditor from './components/mm-table-editor.js';
import * as english from './i18n-en.js';

export const importQr = () => Promise.resolve(qr);
export const importPreview = () => Promise.resolve(preview);
export const importTableEditor = () => Promise.resolve(tableEditor);
export const importEnglish = () => Promise.resolve(english);
