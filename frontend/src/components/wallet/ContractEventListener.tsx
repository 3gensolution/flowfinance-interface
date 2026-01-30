'use client';

import { useAllMarketplaceEvents } from '@/hooks/events/useMarketplaceEvents';
import { useAllFiatBridgeEvents } from '@/hooks/events/useFiatBridgeEvents';

export function ContractEventListener() {
  // Watch all marketplace events (LoanMarketPlace contract)
  useAllMarketplaceEvents();

  // Watch all fiat bridge events (FiatLoanBridge contract)
  useAllFiatBridgeEvents();

  return null;
}
