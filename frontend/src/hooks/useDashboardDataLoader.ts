'use client';

import { useEffect, useRef } from 'react';
import { Address } from 'viem';
import { useUserDashboardData } from '@/hooks/useContracts';
import { useUserFiatLenderOffers, useUserFiatLoansAsBorrower, useUserFiatLoansAsSupplier } from '@/hooks/useFiatLoan';
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
    fiatLoansBorrower: unknown;
    fiatLoansSupplier: unknown;
    fiatLenderOffers: unknown;
  }>({
    loanRequests: undefined,
    lenderOffers: undefined,
    borrowedLoans: undefined,
    lentLoans: undefined,
    fiatLoansBorrower: undefined,
    fiatLoansSupplier: undefined,
    fiatLenderOffers: undefined,
  });

  // Store actions - stable references
  const setLoanRequests = useContractStore((state) => state.setLoanRequests);
  const setLenderOffers = useContractStore((state) => state.setLenderOffers);
  const setLoans = useContractStore((state) => state.setLoans);
  const setFiatLoans = useContractStore((state) => state.setFiatLoans);
  const setFiatLenderOffers = useContractStore((state) => state.setFiatLenderOffers);

  // Fetch crypto data from contracts
  const {
    borrowedLoans: fetchedBorrowedLoans,
    lentLoans: fetchedLentLoans,
    loanRequests: fetchedLoanRequests,
    lenderOffers: fetchedLenderOffers,
    isLoading: isLoadingCrypto,
    refetch: refetchCrypto,
  } = useUserDashboardData(address);

  // Fetch fiat data
  const {
    data: fetchedFiatLenderOffers,
    isLoading: isLoadingFiatOffers,
    refetch: refetchFiatOffers,
  } = useUserFiatLenderOffers(address);

  const {
    data: fetchedFiatLoansBorrower,
    isLoading: isLoadingFiatBorrower,
    refetch: refetchFiatBorrower,
  } = useUserFiatLoansAsBorrower(address);

  const {
    data: fetchedFiatLoansSupplier,
    isLoading: isLoadingFiatSupplier,
    refetch: refetchFiatSupplier,
  } = useUserFiatLoansAsSupplier(address);

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

    // Update fiat loans (merge borrower + supplier into one store)
    const fiatBorrowerChanged = fetchedFiatLoansBorrower !== prev.fiatLoansBorrower;
    const fiatSupplierChanged = fetchedFiatLoansSupplier !== prev.fiatLoansSupplier;

    if ((fetchedFiatLoansBorrower || fetchedFiatLoansSupplier) && (fiatBorrowerChanged || fiatSupplierChanged)) {
      const mergedFiatLoans = [
        ...(fetchedFiatLoansBorrower ?? []),
        ...(fetchedFiatLoansSupplier ?? []),
      ];
      // Deduplicate by loanId (a loan where user is both borrower and supplier is unlikely but safe to handle)
      const seen = new Set<string>();
      const dedupedFiatLoans = mergedFiatLoans.filter((loan) => {
        const key = loan.loanId.toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setFiatLoans(dedupedFiatLoans);
      prev.fiatLoansBorrower = fetchedFiatLoansBorrower;
      prev.fiatLoansSupplier = fetchedFiatLoansSupplier;
    }

    // Update fiat lender offers if changed
    if (fetchedFiatLenderOffers && fetchedFiatLenderOffers !== prev.fiatLenderOffers) {
      setFiatLenderOffers(fetchedFiatLenderOffers);
      prev.fiatLenderOffers = fetchedFiatLenderOffers;
    }
  }, [
    address,
    fetchedLoanRequests,
    fetchedLenderOffers,
    fetchedBorrowedLoans,
    fetchedLentLoans,
    fetchedFiatLoansBorrower,
    fetchedFiatLoansSupplier,
    fetchedFiatLenderOffers,
    setLoanRequests,
    setLenderOffers,
    setLoans,
    setFiatLoans,
    setFiatLenderOffers,
  ]);

  const isLoading = isLoadingCrypto || isLoadingFiatOffers || isLoadingFiatBorrower || isLoadingFiatSupplier;

  const refetch = () => {
    refetchCrypto();
    refetchFiatOffers();
    refetchFiatBorrower();
    refetchFiatSupplier();
  };

  return { isLoading, refetch };
}
