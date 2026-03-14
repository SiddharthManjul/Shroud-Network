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
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Introduction', to: '/' },
            { label: 'Getting Started', to: '/getting-started/quickstart' },
            { label: 'Architecture', to: '/architecture/overview' },
          ],
        },
        {
          title: 'Protocol',
          items: [
            { label: 'Smart Contracts', to: '/smart-contracts/shielded-pool' },
            { label: 'Client SDK', to: '/sdk/overview' },
            { label: 'Security', to: '/security/threat-model' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Twitter', href: 'https://x.com/shroudnetwork' },
            { label: 'Telegram', href: 'https://t.me/+CQMq831HnFo2ZDRl' },
            { label: 'Explorer', href: 'https://testnet.snowtrace.io' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Shroud Network. Built on Avalanche. Powered by ZK-SNARKs.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['solidity', 'bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
