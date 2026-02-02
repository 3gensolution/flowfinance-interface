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

/**
 * Hook that loads marketplace data and populates the global store.
 * Isolates the data fetching and store population logic from components.
 */
export function useMarketplaceDataLoader() {
  // Refs to track if store has been populated (prevent re-population)
  const hasCryptoPopulated = useRef(false);
  const hasFiatPopulated = useRef(false);

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

  // Populate store with crypto data (only once)
  useEffect(() => {
    if (hasCryptoPopulated.current) return;

    const hasRequests = allRequests && allRequests.length > 0;
    const hasOffers = allOffers && allOffers.length > 0;

    if (hasRequests || hasOffers) {
      if (hasRequests) {
        setLoanRequests(allRequests);
      }
      if (hasOffers) {
        setLenderOffers(allOffers);
      }
      hasCryptoPopulated.current = true;
    }
  }, [allRequests, allOffers, setLoanRequests, setLenderOffers]);

  // Populate store with fiat data (only once)
  useEffect(() => {
    if (hasFiatPopulated.current) return;

    const hasFiatLoans = pendingFiatLoans && pendingFiatLoans.length > 0;
    const hasFiatOffers = fiatLenderOffers && fiatLenderOffers.length > 0;

    if (hasFiatLoans || hasFiatOffers) {
      if (hasFiatLoans) {
        setFiatLoans(pendingFiatLoans);
      }
      if (hasFiatOffers) {
        setFiatLenderOffers(fiatLenderOffers);
      }
      hasFiatPopulated.current = true;
    }
  }, [pendingFiatLoans, fiatLenderOffers, setFiatLoans, setFiatLenderOffers]);

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
