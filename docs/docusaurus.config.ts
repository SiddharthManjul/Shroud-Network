import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Shroud Network',
  tagline: 'Privacy redefined with zero-knowledge on Avalanche',
  favicon: 'img/logo.png',

  future: {
    v4: true,
  },

  url: 'https://docs.shroudnetwork.xyz',
  baseUrl: '/',

  organizationName: 'SchrodingerLabs',
  projectName: 'shroud-network',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Shroud Network',
      logo: {
        alt: 'Shroud Network',
        src: 'img/logo.png',
      },
      style: 'dark',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://shroudnetwork.xyz',
          label: 'Launch App',
          position: 'right',
          className: 'navbar-app-link',
        },
        {
          href: 'https://x.com/shroudnetwork',
          label: 'Twitter',
          position: 'right',
        },
        {
          href: 'https://t.me/+CQMq831HnFo2ZDRl',
          label: 'Telegram',
          position: 'right',
        },
      ],
    },
    footer: {},
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['solidity', 'bash', 'json'],
      defaultLanguage: 'text',
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
