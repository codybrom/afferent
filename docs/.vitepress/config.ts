import { defineConfig } from "vitepress";

export default defineConfig({
  appearance: "force-dark",
  title: "afferent",
  description:
    "Sensory 2D spatial layout and perceptual engine for documents, tables, and visual structures",
  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  ],
  themeConfig: {
    siteTitle: "afferent",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Presets", link: "/guide/presets" },
      { text: "System 1", link: "/guide/system-one" },
      { text: "API", link: "/api/" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "How It Works", link: "/guide/how-it-works" },
          { text: "Domain Presets", link: "/guide/presets" },
          { text: "Cross-Page Continuation", link: "/guide/cross-page" },
          { text: "System 1 & Jev", link: "/guide/system-one" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "API Reference", link: "/api/" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/codybrom/afferent" }],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Cody Bromley",
    },
    search: {
      provider: "local",
    },
  },
});
