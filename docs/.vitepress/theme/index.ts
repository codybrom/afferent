import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import "./custom.css";
import StageRow from "./StageRow.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("StageRow", StageRow);
  },
} satisfies Theme;
