'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { useCallback, useEffect } from 'react';
import { Address, Abi } from 'viem';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';
import { useContractStore } from '@/stores/contractStore';
import { convertToUSDCents } from './useFiatOracle';

const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

// Fiat loan status enum matching contract
export enum FiatLoanStatus {
  PENDING_SUPPLIER = 0,
  ACTIVE = 1,
  REPAID = 2,
  LIQUIDATED = 3,
  CANCELLED = 4,
}

// Fiat lender offer status enum matching contract
export enum FiatLenderOfferStatus {
  ACTIVE = 0,
  ACCEPTED = 1,
  CANCELLED = 2,
  EXPIRED = 3,
}

// Fiat loan type - matches FiatLoanBridge.FiatLoan struct
export interface FiatLoan {
  loanId: bigint;
  borrower: Address;
  supplier: Address;
  collateralAsset: Address;
  collateralAmount: bigint;
  fiatAmountCents: bigint;
  currency: string;
  interestRate: bigint;
  duration: bigint;
  status: FiatLoanStatus;
  createdAt: bigint;
  activatedAt: bigint;
  dueDate: bigint;
  gracePeriodEnd: bigint;
  claimableAmountCents: bigint;
  fundsWithdrawn: boolean;
  repaymentDepositId: `0x${string}`;
  exchangeRateAtCreation: bigint; // Exchange rate (units per 1 USD, scaled by 1e8) at loan creation
  chainId: bigint;
}

// Fiat lender offer type - matches FiatLoanBridge.FiatLenderOffer struct
export interface FiatLenderOffer {
  offerId: bigint;
  lender: Address;
  fiatAmountCents: bigint;
  remainingAmountCents: bigint;
  borrowedAmountCents: bigint;
  currency: string;
  minCollateralValueUSD: bigint;
  duration: bigint;
  interestRate: bigint;
  createdAt: bigint;
  expireAt: bigint;
  status: FiatLenderOfferStatus;
  exchangeRateAtCreation: bigint; // Exchange rate (units per 1 USD, scaled by 1e8) at offer creation
  chainId: bigint;
}

// Get next fiat loan ID
export function useNextFiatLoanId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'nextFiatLoanId',
  });
}

// Get next fiat lender offer ID
export function useNextFiatLenderOfferId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'nextFiatLenderOfferId',
  });
}

// Get pending fiat loan IDs
export function usePendingFiatLoans() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getPendingFiatLoans',
  });
}

// Get active fiat loan IDs
export function useActiveFiatLoans() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getActiveFiatLoans',
  });
}

// Get borrower's fiat loan IDs
export function useBorrowerFiatLoans(borrower: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getBorrowerFiatLoans',
    args: borrower ? [borrower] : undefined,
    query: {
      enabled: !!borrower,
    },
  });
}

// Get supplier's fiat loan IDs
export function useSupplierFiatLoans(supplier: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getSupplierFiatLoans',
    args: supplier ? [supplier] : undefined,
    query: {
      enabled: !!supplier,
    },
  });
}

// Get single fiat lender offer details
export function useFiatLenderOffer(offerId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'fiatLenderOffers',
    args: offerId !== undefined ? [offerId] : undefined,
    query: {
      enabled: offerId !== undefined,
    },
  });
}

// Get lender's fiat lender offer IDs
export function useLenderFiatOffers(lender: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getLenderFiatOffers',
    args: lender ? [lender] : undefined,
    query: {
      enabled: !!lender,
      refetchOnMount: 'always',
      staleTime: 0,
    },
  });
}

// Get active fiat lender offers
export function useActiveFiatLenderOffers() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getActiveFiatLenderOffers',
  });
}

// Get single fiat loan details
export function useFiatLoan(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getFiatLoan',
    args: loanId !== undefined ? [loanId] : undefined,
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Calculate total debt for a fiat loan
export function useFiatLoanTotalDebt(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'calculateTotalDebt',
    args: loanId !== undefined ? [loanId] : undefined,
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Calculate health factor for a fiat loan
export function useFiatLoanHealthFactor(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'calculateHealthFactor',
    args: loanId !== undefined ? [loanId] : undefined,
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Batch fetch fiat loans by IDs
export function useBatchFiatLoans(loanIds: bigint[]) {
  const setFiatLoans = useContractStore((state) => state.setFiatLoans);
  const { data: loansData, isLoading, isError, refetch } = useReadContracts({
    contracts: loanIds.map((id) => ({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'getFiatLoan',
      args: [id],
    })),
    query: {
      enabled: loanIds.length > 0,
    },
  });

  const loans = (loansData || [])
    .map((result, index) => {
      if (result.status !== 'success' || !result.result) return null;

      const data = result.result;
      const isArray = Array.isArray(data);

      // Map based on FiatLoanBridge.FiatLoan struct order:
      // loanId, borrower, supplier, collateralAsset, collateralAmount, fiatAmountCents,
      // currency, interestRate, duration, status, createdAt, activatedAt, dueDate,
      // gracePeriodEnd, claimableAmountCents, fundsWithdrawn, repaymentDepositId,
      // exchangeRateAtCreation, chainId
      let loanData;
      if (isArray) {
        const arr = data as readonly unknown[];
        loanData = {
          loanId: arr[0],
          borrower: arr[1],
          supplier: arr[2],
          collateralAsset: arr[3],
          collateralAmount: arr[4],
          fiatAmountCents: arr[5],
          currency: arr[6],
          interestRate: arr[7],
          duration: arr[8],
          status: arr[9],
          createdAt: arr[10],
          activatedAt: arr[11],
          dueDate: arr[12],
          gracePeriodEnd: arr[13],
          claimableAmountCents: arr[14],
          fundsWithdrawn: arr[15],
          repaymentDepositId: arr[16],
          exchangeRateAtCreation: arr[17],
          chainId: arr[18],
        };
      } else {
        loanData = data as Record<string, unknown>;
      }

      // Filter out empty loans
      if (!loanData.borrower || loanData.borrower === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        loanId: loanIds[index],
        borrower: loanData.borrower as Address,
        supplier: loanData.supplier as Address,
        collateralAsset: loanData.collateralAsset as Address,
        collateralAmount: loanData.collateralAmount as bigint,
        fiatAmountCents: loanData.fiatAmountCents as bigint,
        currency: loanData.currency as string,
        interestRate: loanData.interestRate as bigint,
        duration: loanData.duration as bigint,
        status: Number(loanData.status) as FiatLoanStatus,
        createdAt: loanData.createdAt as bigint,
        activatedAt: loanData.activatedAt as bigint,
        dueDate: loanData.dueDate as bigint,
        gracePeriodEnd: loanData.gracePeriodEnd as bigint,
        claimableAmountCents: loanData.claimableAmountCents as bigint,
        fundsWithdrawn: loanData.fundsWithdrawn as boolean,
        repaymentDepositId: loanData.repaymentDepositId as `0x${string}`,
        exchangeRateAtCreation: (loanData.exchangeRateAtCreation as bigint) || BigInt(0),
        chainId: (loanData.chainId as bigint) || BigInt(0),
      } as FiatLoan;
    })
    .filter((l): l is FiatLoan => l !== null);

  // Update store when data loads
  useEffect(() => {
    if (loans.length > 0) {
      setFiatLoans(loans);
    }
  }, [loans, setFiatLoans]);

  return { data: loans, isLoading, isError, refetch };
}

// Batch fetch fiat lender offers by IDs
export function useBatchFiatLenderOffers(offerIds: bigint[]) {
  const setFiatLenderOffers = useContractStore((state) => state.setFiatLenderOffers);
  const { data: offersData, isLoading, isError, refetch } = useReadContracts({
    contracts: offerIds.map((id) => ({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'fiatLenderOffers',
      args: [id],
    })),
    query: {
      enabled: offerIds.length > 0,
      refetchOnMount: 'always',
      staleTime: 0,
    },
  });

  const offers = (offersData || [])
    .map((result, index) => {
      if (result.status !== 'success' || !result.result) return null;

      const data = result.result;
      const isArray = Array.isArray(data);

      // Map based on FiatLoanBridge.FiatLenderOffer struct order:
      // offerId, lender, fiatAmountCents, remainingAmountCents, borrowedAmountCents,
      // currency, minCollateralValueUSD, duration, interestRate, createdAt, expireAt,
      // status, exchangeRateAtCreation, chainId
      let offerData;
      if (isArray) {
        const arr = data as readonly unknown[];
        offerData = {
          offerId: arr[0],
          lender: arr[1],
          fiatAmountCents: arr[2],
          remainingAmountCents: arr[3],
          borrowedAmountCents: arr[4],
          currency: arr[5],
          minCollateralValueUSD: arr[6],
          duration: arr[7],
          interestRate: arr[8],
          createdAt: arr[9],
          expireAt: arr[10],
          status: arr[11],
          exchangeRateAtCreation: arr[12],
          chainId: arr[13],
        };
      } else {
        offerData = data as Record<string, unknown>;
      }

      // Filter out empty offers
      if (!offerData.lender || offerData.lender === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        offerId: offerIds[index],
        lender: offerData.lender as Address,
        fiatAmountCents: offerData.fiatAmountCents as bigint,
        remainingAmountCents: (offerData.remainingAmountCents as bigint) || BigInt(0),
        borrowedAmountCents: (offerData.borrowedAmountCents as bigint) || BigInt(0),
        currency: offerData.currency as string,
        minCollateralValueUSD: offerData.minCollateralValueUSD as bigint,
        duration: offerData.duration as bigint,
        interestRate: offerData.interestRate as bigint,
        createdAt: offerData.createdAt as bigint,
        expireAt: offerData.expireAt as bigint,
        status: Number(offerData.status) as FiatLenderOfferStatus,
        exchangeRateAtCreation: (offerData.exchangeRateAtCreation as bigint) || BigInt(0),
        chainId: (offerData.chainId as bigint) || BigInt(0),
      } as FiatLenderOffer;
    })
    .filter((o): o is FiatLenderOffer => o !== null);

  // Update store when data loads
  useEffect(() => {
    if (offers.length > 0) {
      setFiatLenderOffers(offers);
    }
  }, [offers, setFiatLenderOffers]);

  return { data: offers, isLoading, isError, refetch };
}

// Fetch all pending fiat loans with details
export function usePendingFiatLoansWithDetails() {
  const { data: pendingIds, isLoading: isLoadingIds, refetch: refetchIds } = usePendingFiatLoans();
  const loanIds = (pendingIds as bigint[]) || [];

  const { data: loans, isLoading: isLoadingLoans, refetch: refetchLoans } = useBatchFiatLoans(loanIds);

  const refetch = useCallback(() => {
    refetchIds();
    refetchLoans();
  }, [refetchIds, refetchLoans]);

  return {
    data: loans || [],
    isLoading: isLoadingIds || isLoadingLoans,
    refetch,
  };
}

// Fetch all active fiat loans with details
export function useActiveFiatLoansWithDetails() {
  const { data: activeIds, isLoading: isLoadingIds, refetch: refetchIds } = useActiveFiatLoans();
  const loanIds = (activeIds as bigint[]) || [];

  const { data: loans, isLoading: isLoadingLoans, refetch: refetchLoans } = useBatchFiatLoans(loanIds);

  const refetch = useCallback(() => {
    refetchIds();
    refetchLoans();
  }, [refetchIds, refetchLoans]);

  return {
    data: loans || [],
    isLoading: isLoadingIds || isLoadingLoans,
    refetch,
  };
}

// Fetch user's fiat loans (as borrower)
export function useUserFiatLoansAsBorrower(userAddress: Address | undefined) {
  const { data: loanIds, isLoading: isLoadingIds, refetch: refetchIds } = useBorrowerFiatLoans(userAddress);
  const ids = (loanIds as bigint[]) || [];

  const { data: loans, isLoading: isLoadingLoans, refetch: refetchLoans } = useBatchFiatLoans(ids);

  const refetch = useCallback(() => {
    refetchIds();
    refetchLoans();
  }, [refetchIds, refetchLoans]);

  return {
    data: loans || [],
    isLoading: isLoadingIds || isLoadingLoans,
    refetch,
  };
}

// Fetch user's fiat loans (as supplier)
export function useUserFiatLoansAsSupplier(userAddress: Address | undefined) {
  const { data: loanIds, isLoading: isLoadingIds, refetch: refetchIds } = useSupplierFiatLoans(userAddress);
  const ids = (loanIds as bigint[]) || [];

  const { data: loans, isLoading: isLoadingLoans, refetch: refetchLoans } = useBatchFiatLoans(ids);

  const refetch = useCallback(() => {
    refetchIds();
    refetchLoans();
  }, [refetchIds, refetchLoans]);

  return {
    data: loans || [],
    isLoading: isLoadingIds || isLoadingLoans,
    refetch,
  };
}

// Fetch all active fiat lender offers with details
export function useActiveFiatLenderOffersWithDetails() {
  const { data: activeIds, isLoading: isLoadingIds, refetch: refetchIds } = useActiveFiatLenderOffers();
  const offerIds = (activeIds as bigint[]) || [];

  const { data: offers, isLoading: isLoadingOffers, refetch: refetchOffers } = useBatchFiatLenderOffers(offerIds);

  const refetch = useCallback(() => {
    refetchIds();
    refetchOffers();
  }, [refetchIds, refetchOffers]);

  return {
    data: offers || [],
    isLoading: isLoadingIds || isLoadingOffers,
    refetch,
  };
}

// Fetch user's fiat lender offers
export function useUserFiatLenderOffers(userAddress: Address | undefined) {
  const { data: offerIds, isLoading: isLoadingIds, refetch: refetchIds } = useLenderFiatOffers(userAddress);
  const ids = (offerIds as bigint[]) || [];

  const { data: offers, isLoading: isLoadingOffers, refetch: refetchOffers } = useBatchFiatLenderOffers(ids);

  const refetch = useCallback(() => {
    refetchIds();
    refetchOffers();
  }, [refetchIds, refetchOffers]);

  return {
    data: offers || [],
    isLoading: isLoadingIds || isLoadingOffers,
    refetch,
  };
}

// Write hooks

// Create a fiat loan request
export function useCreateFiatLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Simulate the transaction before executing
  const simulateCreateFiatLoanRequest = async (
    collateralAsset: Address,
    collateralAmount: bigint,
    fiatAmountCents: bigint,
    currency: string,
    interestRate: bigint,
    duration: bigint
  ): Promise<{ success: boolean; error?: string }> => {
    if (!publicClient || !address) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await publicClient.simulateContract({
        address: CONTRACT_ADDRESSES.fiatLoanBridge,
        abi: FiatLoanBridgeABI,
        functionName: 'createFiatLoanRequest',
        args: [collateralAsset, collateralAmount, fiatAmountCents, currency, interestRate, duration],
        account: address,
      });
      return { success: true };
    } catch (err: unknown) {
      const error = err as Error & { shortMessage?: string; cause?: { reason?: string } };
      // Extract meaningful error message
      let errorMessage = 'Transaction would fail';
      if (error.shortMessage) {
        errorMessage = error.shortMessage;
      } else if (error.cause?.reason) {
        errorMessage = error.cause.reason;
      } else if (error.message) {
        // Parse common contract errors
        if (error.message.includes('isAssetSupported')) {
          errorMessage = 'Collateral asset is not supported for fiat loans';
        } else if (error.message.includes('insufficient')) {
          errorMessage = 'Insufficient balance or allowance';
        } else if (error.message.includes('Currency not supported')) {
          errorMessage = 'Selected currency is not supported';
        } else {
          errorMessage = error.message.slice(0, 200);
        }
      }
      return { success: false, error: errorMessage };
    }
  };

  const createFiatLoanRequest = async (
    collateralAsset: Address,
    collateralAmount: bigint,
    fiatAmountCents: bigint,
    currency: string,
    interestRate: bigint,
    duration: bigint
  ) => {
    // First simulate to check if transaction would succeed
    const simulation = await simulateCreateFiatLoanRequest(
      collateralAsset,
      collateralAmount,
      fiatAmountCents,
      currency,
      interestRate,
      duration
    );

    if (!simulation.success) {
      throw new Error(simulation.error || 'Transaction simulation failed');
    }

    // If simulation passes, execute the actual transaction
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'createFiatLoanRequest',
      args: [collateralAsset, collateralAmount, fiatAmountCents, currency, interestRate, duration],
    });
  };

  return { createFiatLoanRequest, simulateCreateFiatLoanRequest, hash, isPending, isConfirming, isSuccess, error };
}

// Cancel a fiat loan request
export function useCancelFiatLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelFiatLoanRequest = async (loanId: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'cancelFiatLoanRequest',
      args: [loanId],
    });
  };

  return { cancelFiatLoanRequest, hash, isPending, isConfirming, isSuccess, error };
}

// Accept a fiat loan request (for suppliers)
export function useAcceptFiatLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const acceptFiatLoanRequest = async (loanId: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'acceptFiatLoanRequest',
      args: [loanId],
    });
  };

  return { acceptFiatLoanRequest, hash, isPending, isConfirming, isSuccess, error };
}

// Create a fiat lender offer (for suppliers)
export function useCreateFiatLenderOffer() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createFiatLenderOffer = async (
    fiatAmountCents: bigint,
    currency: string,
    minCollateralValueUSD: bigint,
    duration: bigint,
    interestRate: bigint
  ) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'createFiatLenderOffer',
      args: [fiatAmountCents, currency, minCollateralValueUSD, duration, interestRate],
    });
  };

  return { createFiatLenderOffer, hash, isPending, isConfirming, isSuccess, error };
}

// Accept a fiat lender offer (for borrowers)
export function useAcceptFiatLenderOffer() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const acceptFiatLenderOffer = async (
    offerId: bigint,
    collateralAsset: Address,
    collateralAmount: bigint
  ) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'acceptFiatLenderOffer',
      args: [offerId, collateralAsset, collateralAmount],
    });
  };

  return { acceptFiatLenderOffer, hash, isPending, isConfirming, isSuccess, error };
}

// Cancel a fiat lender offer
export function useCancelFiatLenderOffer() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelFiatLenderOffer = async (offerId: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'cancelFiatLenderOffer',
      args: [offerId],
    });
  };

  return { cancelFiatLenderOffer, hash, isPending, isConfirming, isSuccess, error };
}

// Calculate fiat loan stats with USD conversion using stored exchange rate at creation
export function useFiatLoanStats() {
  const { data: pendingLoans, isLoading: isLoadingPending } = usePendingFiatLoansWithDetails();
  const { data: activeLoans, isLoading: isLoadingActive } = useActiveFiatLoansWithDetails();

  // Helper to convert amount to USD cents using the stored exchange rate at creation
  const toUSDCentsWithStoredRate = (amountCents: bigint, currency: string, exchangeRateAtCreation: bigint): bigint => {
    // USD is 1:1 (rate is 1e8 for USD)
    if (currency === 'USD') return amountCents;

    // Use stored rate from creation time
    if (!exchangeRateAtCreation || exchangeRateAtCreation === BigInt(0)) {
      // Fallback: return as-is if no rate stored (legacy loans before this feature)
      return amountCents;
    }
    return convertToUSDCents(amountCents, exchangeRateAtCreation);
  };

  const stats = {
    pendingCount: pendingLoans.length,
    activeCount: activeLoans.length,
    totalPendingVolume: pendingLoans.reduce((sum, loan) => {
      const usdCents = toUSDCentsWithStoredRate(loan.fiatAmountCents, loan.currency, loan.exchangeRateAtCreation);
      return sum + Number(usdCents) / 100;
    }, 0),
    totalActiveVolume: activeLoans.reduce((sum, loan) => {
      const usdCents = toUSDCentsWithStoredRate(loan.fiatAmountCents, loan.currency, loan.exchangeRateAtCreation);
      return sum + Number(usdCents) / 100;
    }, 0),
    avgInterestRate: (() => {
      const allLoans = [...pendingLoans, ...activeLoans];
      if (allLoans.length === 0) return 0;
      const totalRate = allLoans.reduce((sum, loan) => sum + Number(loan.interestRate), 0);
      return totalRate / allLoans.length / 100;
    })(),
  };

  return {
    data: stats,
    isLoading: isLoadingPending || isLoadingActive,
  };
}

// Calculate fiat lender offer stats with USD conversion using stored exchange rate at creation
export function useFiatLenderOfferStats() {
  const { data: activeOffers, isLoading } = useActiveFiatLenderOffersWithDetails();

  // Helper to convert amount to USD cents using the stored exchange rate at creation
  const toUSDCentsWithStoredRate = (amountCents: bigint, currency: string, exchangeRateAtCreation: bigint): bigint => {
    // USD is 1:1 (rate is 1e8 for USD)
    if (currency === 'USD') return amountCents;

    // Use stored rate from creation time
    if (!exchangeRateAtCreation || exchangeRateAtCreation === BigInt(0)) {
      // Fallback: return as-is if no rate stored (legacy offers before this feature)
      return amountCents;
    }
    return convertToUSDCents(amountCents, exchangeRateAtCreation);
  };

  const stats = {
    activeCount: activeOffers.length,
    totalVolume: activeOffers.reduce((sum, offer) => {
      const usdCents = toUSDCentsWithStoredRate(offer.fiatAmountCents, offer.currency, offer.exchangeRateAtCreation);
      return sum + Number(usdCents) / 100;
    }, 0),
    avgInterestRate: (() => {
      if (activeOffers.length === 0) return 0;
      const totalRate = activeOffers.reduce((sum, offer) => sum + Number(offer.interestRate), 0);
      return totalRate / activeOffers.length / 100;
    })(),
    currencies: Array.from(new Set(activeOffers.map(o => o.currency))),
  };

  return {
    data: stats,
    isLoading,
  };
}
