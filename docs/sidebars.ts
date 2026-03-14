import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/quickstart',
        'getting-started/connect-wallet',
        'getting-started/faucet',
        'getting-started/guide',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/shielded-pool',
        'architecture/cryptography',
        'architecture/zk-circuits',
      ],
    },
    {
      type: 'category',
      label: 'Smart Contracts',
      items: [
        'smart-contracts/shielded-pool',
        'smart-contracts/meta-tx-relayer',
        'smart-contracts/deployments',
      ],
    },
    {
      type: 'category',
      label: 'Client SDK',
      items: [
        'sdk/overview',
        'sdk/deposit',
        'sdk/transfer',
        'sdk/withdraw',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security/threat-model',
        'security/privacy-guarantees',
      ],
    },
  ],
};

export default sidebars;
