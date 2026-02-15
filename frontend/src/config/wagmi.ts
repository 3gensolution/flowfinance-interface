import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  // Testnets
  baseSepolia,
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
  foundry,
  // Mainnets
  base,
  // mainnet,
  // arbitrum,
  // optimism,
  // polygon,
} from 'wagmi/chains';
import { http } from 'wagmi';

// Singleton pattern to prevent multiple WalletConnect initializations
let configInstance: ReturnType<typeof getDefaultConfig> | null = null;

function createConfig() {
  if (configInstance) {
    return configInstance;
  }

  configInstance = getDefaultConfig({
    appName: 'Flow Lending',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
    chains: [
      // Testnets (Base Sepolia first as default)
      baseSepolia,
      sepolia,
      arbitrumSepolia,
      optimismSepolia,
      foundry,
      // Mainnets
      base,
    ],
    transports: {
      // Mainnet transports
      [base.id]: http('https://mainnet.base.org'),
      // Testnet transports
      [baseSepolia.id]: http('https://sepolia.base.org'),
      [sepolia.id]: http('https://rpc.sepolia.org'),
      [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
      [optimismSepolia.id]: http('https://sepolia.optimism.io'),
      [foundry.id]: http('http://127.0.0.1:8545'),
    },
    ssr: true,
  });

  return configInstance;
}

export const config = createConfig();
