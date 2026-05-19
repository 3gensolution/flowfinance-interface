'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { guideaiIdentify, guideaiTrack } from '@/lib/guideai/events';

export function WalletIdentity() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const lastIdentified = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;

    const id = address.toLowerCase();
    if (lastIdentified.current === id) return;

    lastIdentified.current = id;
    guideaiIdentify(id, { wallet: address, chainId });
    guideaiTrack('login_success', { method: 'wallet', chainId });
  }, [address, chainId, isConnected]);

  return null;
}

