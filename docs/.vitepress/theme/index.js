import DefaultTheme from 'vitepress/theme';
import MailmasonDemo from './MailmasonDemo.vue';
import './custom.css';

/** @type {import('vitepress').Theme} */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('MailmasonDemo', MailmasonDemo);
  },
};
