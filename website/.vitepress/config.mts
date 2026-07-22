import { defineConfig } from 'vitepress';

// Project page is served at https://xinyuehtx.github.io/agentic-html/
const base = '/agentic-html/';

export default defineConfig({
  base,
  lang: 'en-US',
  title: 'Agentic HTML',
  description:
    'Agent-native HTML editor — preview, annotate, version, and patch HTML with any MCP agent.',
  appearance: 'dark',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }],
    ['meta', { name: 'theme-color', content: '#22d3ee' }],
    ['meta', { name: 'og:title', content: 'Agentic HTML' }],
    [
      'meta',
      {
        name: 'og:description',
        content: 'Preview · Annotate · Version · Patch — for any MCP agent.',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Agentic HTML',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Concepts', link: '/guide/concepts' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'Usage', link: '/guide/usage' },
      { text: 'Showcase', link: '/guide/showcase' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Overview',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Design Concepts', link: '/guide/concepts' },
            { text: 'Architecture', link: '/guide/architecture' },
          ],
        },
        {
          text: 'Using it',
          items: [
            { text: 'Usage', link: '/guide/usage' },
            { text: 'Add Element to Chat', link: '/guide/add-to-chat' },
            { text: 'Showcase', link: '/guide/showcase' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/xinyuehtx/agentic-html' },
    ],

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Agentic HTML — Preview · Annotate · Version · Patch',
    },

    outline: { level: [2, 3] },
  },
});
