'use client';

import { useEffect, useRef } from 'react';
import { Address } from 'viem';
import { useUserDashboardData } from '@/hooks/useContracts';
import { useUserFiatLenderOffers, useUserFiatLoansAsBorrower } from '@/hooks/useFiatLoan';
import { useContractStore } from '@/stores/contractStore';

/**
 * Hook that loads dashboard data and populates the global store.
 * Isolates the data fetching and store population logic from components.
 * Uses refs to prevent unnecessary re-renders from store updates.
 */
export function useDashboardDataLoader(address: Address | undefined) {
  // Refs to track previous data - prevents unnecessary store updates
  const prevDataRef = useRef<{
    loanRequests: unknown;
    lenderOffers: unknown;
    borrowedLoans: unknown;
    lentLoans: unknown;
  }>({
    loanRequests: undefined,
    lenderOffers: undefined,
    borrowedLoans: undefined,
    lentLoans: undefined,
  });

  // Store actions - stable references
  const setLoanRequests = useContractStore((state) => state.setLoanRequests);
  const setLenderOffers = useContractStore((state) => state.setLenderOffers);
  const setLoans = useContractStore((state) => state.setLoans);

  // Fetch crypto data from contracts
  const {
    borrowedLoans: fetchedBorrowedLoans,
    lentLoans: fetchedLentLoans,
    loanRequests: fetchedLoanRequests,
    lenderOffers: fetchedLenderOffers,
    isLoading,
    refetch,
  } = useUserDashboardData(address);

  // Fetch fiat data (these hooks populate the store internally)
  useUserFiatLenderOffers(address);
  useUserFiatLoansAsBorrower(address);

  // Populate store when fetched data changes
  useEffect(() => {
    if (!address) return;

    const prev = prevDataRef.current;

    // Update loan requests if changed
    if (fetchedLoanRequests && fetchedLoanRequests !== prev.loanRequests) {
      setLoanRequests(fetchedLoanRequests);
      prev.loanRequests = fetchedLoanRequests;
    }

    // Update lender offers if changed
    if (fetchedLenderOffers && fetchedLenderOffers !== prev.lenderOffers) {
      setLenderOffers(fetchedLenderOffers);
      prev.lenderOffers = fetchedLenderOffers;
    }

    // Update loans if either borrowed or lent changed
    const borrowedChanged = fetchedBorrowedLoans !== prev.borrowedLoans;
    const lentChanged = fetchedLentLoans !== prev.lentLoans;

    if ((fetchedBorrowedLoans || fetchedLentLoans) && (borrowedChanged || lentChanged)) {
      const mergedLoans = [
        ...(fetchedBorrowedLoans ?? []),
        ...(fetchedLentLoans ?? []),
      ];
      setLoans(mergedLoans);
      prev.borrowedLoans = fetchedBorrowedLoans;
      prev.lentLoans = fetchedLentLoans;
    }
  }, [
    address,
    fetchedLoanRequests,
    fetchedLenderOffers,
    fetchedBorrowedLoans,
    fetchedLentLoans,
    setLoanRequests,
    setLenderOffers,
    setLoans,
  ]);

  return { isLoading, refetch };
}
