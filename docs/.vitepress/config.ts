import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'VuePoint',
  description: 'Visual annotation & AI agent feedback tool for Vue 3',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/rest-api' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'For PMs & Designers', link: '/guide/for-pms-and-designers' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'MCP Integration', link: '/guide/mcp-integration' },
          { text: 'Webhooks', link: '/guide/webhooks' },
          { text: 'Nuxt Module', link: '/guide/nuxt-module' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'REST API', link: '/reference/rest-api' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/AJenbo/VuePoint' },
    ],
  },
})
