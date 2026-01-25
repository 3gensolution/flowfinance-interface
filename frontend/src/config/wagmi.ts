'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  // Testnets
  baseSepolia,
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
  foundry,
  // Mainnets (uncomment for production)
  // mainnet,
  // base,
  // arbitrum,
  // optimism,
  // polygon,
} from 'wagmi/chains';
import { http } from 'wagmi';
import { fallback } from 'viem';

export const config = getDefaultConfig({
  appName: 'FlowFinance',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  // Testnet chains (for development)
  chains: [
    baseSepolia,
    sepolia,
    arbitrumSepolia,
    optimismSepolia,
    foundry,
  ],
  transports: {
    // Testnet transports
    // [baseSepolia.id]: http('https://sepolia.base.org'),
    [baseSepolia.id]: fallback([
      http('https://sepolia.base.org'),
      http('https://base-sepolia.drpc.org'),
      http('https://base-sepolia-public.nodies.app'),
      // webSocket('wss://base-sepolia-rpc.publicnode.com'),
    ]),
    [sepolia.id]: http('https://rpc.sepolia.org'),
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [optimismSepolia.id]: http('https://sepolia.optimism.io'),
    [foundry.id]: http('http://127.0.0.1:8545'),
    // Mainnet transports (uncomment for production)
    // [mainnet.id]: http('https://eth.llamarpc.com'),
    // [base.id]: http('https://mainnet.base.org'),
    // [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    // [optimism.id]: http('https://mainnet.optimism.io'),
    // [polygon.id]: http('https://polygon-rpc.com'),
  },
  ssr: true,
});
