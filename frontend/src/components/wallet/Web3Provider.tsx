'use client';

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config/wagmi';
import { ChainSync } from './ChainSync';
import '@rainbow-me/rainbowkit/styles.css';
import { queryClient } from '@/lib/react-query-client';
import { WalletIdentity } from '@/components/guideai/WalletIdentity';
import { GuideAINetworkLogger } from '@/components/guideai/GuideAINetworkLogger';

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#0ea5e9',
            accentColorForeground: 'white',
            borderRadius: 'large',
            overlayBlur: 'small',
          })}
          modalSize="compact"
        >
          <GuideAINetworkLogger />
          <WalletIdentity />
          <ChainSync />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
