'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  useNextLoanRequestId,
  useNextLenderOfferId,
  useBatchLoanRequests,
  useBatchLenderOffers
} from '@/hooks/useContracts';
import {
  usePendingFiatLoansWithDetails,
  useActiveFiatLoansWithDetails,
  useActiveFiatLenderOffersWithDetails,
} from '@/hooks/useFiatLoan';
import { useContractStore } from '@/stores/contractStore';
import { useNetwork } from '@/contexts/NetworkContext';

/**
 * Hook that loads marketplace data and populates the global store.
 * Isolates the data fetching and store population logic from components.
 */
export function useMarketplaceDataLoader() {
  const { selectedNetwork } = useNetwork();
  // Track which chain was populated — reset when network changes
  const populatedCryptoForChain = useRef<number | null>(null);
  const populatedFiatForChain = useRef<number | null>(null);

  // Store actions
  const setLoanRequests = useContractStore((state) => state.setLoanRequests);
  const setLenderOffers = useContractStore((state) => state.setLenderOffers);
  const setFiatLoans = useContractStore((state) => state.setFiatLoans);
  const setFiatLenderOffers = useContractStore((state) => state.setFiatLenderOffers);

  // Get total counts from contract
  const { data: nextRequestId, refetch: refetchRequestCount } = useNextLoanRequestId();
  const { data: nextOfferId, refetch: refetchOfferCount } = useNextLenderOfferId();

  const requestCount = nextRequestId ? Number(nextRequestId) : 0;
  const offerCount = nextOfferId ? Number(nextOfferId) : 0;

  // Fetch crypto data
  const {
    data: allRequests,
    isLoading: isLoadingRequests,
    refetch: refetchRequests
  } = useBatchLoanRequests(0, Math.min(requestCount, 20));

  const {
    data: allOffers,
    isLoading: isLoadingOffers,
    refetch: refetchOffers
  } = useBatchLenderOffers(0, Math.min(offerCount, 20));

  // Fetch fiat data
  const {
    data: pendingFiatLoans,
    isLoading: isLoadingPendingFiat,
    refetch: refetchPendingFiat
  } = usePendingFiatLoansWithDetails();

  const {
    isLoading: isLoadingActiveFiat,
    refetch: refetchActiveFiat
  } = useActiveFiatLoansWithDetails();

  const {
    data: fiatLenderOffers,
    isLoading: isLoadingFiatOffers,
    refetch: refetchFiatOffers
  } = useActiveFiatLenderOffersWithDetails();

  // Populate store with crypto data (once per network)
  useEffect(() => {
    if (populatedCryptoForChain.current === selectedNetwork.id) return;

    const hasRequests = allRequests && allRequests.length > 0;
    const hasOffers = allOffers && allOffers.length > 0;

    if (hasRequests || hasOffers) {
      if (hasRequests) {
        setLoanRequests(allRequests);
      }
      if (hasOffers) {
        setLenderOffers(allOffers);
      }
      populatedCryptoForChain.current = selectedNetwork.id;
    }
  }, [allRequests, allOffers, setLoanRequests, setLenderOffers, selectedNetwork.id]);

  // Populate store with fiat data (once per network)
  useEffect(() => {
    if (populatedFiatForChain.current === selectedNetwork.id) return;

    const hasFiatLoans = pendingFiatLoans && pendingFiatLoans.length > 0;
    const hasFiatOffers = fiatLenderOffers && fiatLenderOffers.length > 0;

    if (hasFiatLoans || hasFiatOffers) {
      if (hasFiatLoans) {
        setFiatLoans(pendingFiatLoans);
      }
      if (hasFiatOffers) {
        setFiatLenderOffers(fiatLenderOffers);
      }
      populatedFiatForChain.current = selectedNetwork.id;
    }
  }, [pendingFiatLoans, fiatLenderOffers, setFiatLoans, setFiatLenderOffers, selectedNetwork.id]);

  const refetch = useCallback(() => {
    refetchRequestCount();
    refetchOfferCount();
    refetchRequests();
    refetchOffers();
    refetchPendingFiat();
    refetchActiveFiat();
    refetchFiatOffers();
  }, [refetchRequestCount, refetchOfferCount, refetchRequests, refetchOffers, refetchPendingFiat, refetchActiveFiat, refetchFiatOffers]);

  return {
    isLoadingCrypto: isLoadingRequests || isLoadingOffers,
    isLoadingFiat: isLoadingPendingFiat || isLoadingActiveFiat || isLoadingFiatOffers,
    refetch,
  };
}
