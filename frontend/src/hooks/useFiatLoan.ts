'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useCallback, useEffect } from 'react';
import { Address, Abi } from 'viem';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';
import { useInvalidateContractQueries } from './useContracts';

const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

// Fiat loan status enum matching contract
export enum FiatLoanStatus {
  PENDING_SUPPLIER = 0,
  ACTIVE = 1,
  REPAID = 2,
  LIQUIDATED = 3,
  CANCELLED = 4,
}

// Fiat loan type
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
}

// Get next fiat loan ID
export function useNextFiatLoanId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'nextFiatLoanId',
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
      } as FiatLoan;
    })
    .filter((l): l is FiatLoan => l !== null);

  return { data: loans, isLoading, isError, refetch };
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

// Write hooks

// Create a fiat loan request
export function useCreateFiatLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { invalidateAll } = useInvalidateContractQueries();

  useEffect(() => {
    if (isSuccess) {
      invalidateAll();
    }
  }, [isSuccess, invalidateAll]);

  const createFiatLoanRequest = async (
    collateralAsset: Address,
    collateralAmount: bigint,
    fiatAmountCents: bigint,
    currency: string,
    interestRate: bigint,
    duration: bigint
  ) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'createFiatLoanRequest',
      args: [collateralAsset, collateralAmount, fiatAmountCents, currency, interestRate, duration],
    });
  };

  return { createFiatLoanRequest, hash, isPending, isConfirming, isSuccess, error };
}

// Cancel a fiat loan request
export function useCancelFiatLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { invalidateAll } = useInvalidateContractQueries();

  useEffect(() => {
    if (isSuccess) {
      invalidateAll();
    }
  }, [isSuccess, invalidateAll]);

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
  const { invalidateAll } = useInvalidateContractQueries();

  useEffect(() => {
    if (isSuccess) {
      invalidateAll();
    }
  }, [isSuccess, invalidateAll]);

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

// Calculate fiat loan stats
export function useFiatLoanStats() {
  const { data: pendingLoans, isLoading: isLoadingPending } = usePendingFiatLoansWithDetails();
  const { data: activeLoans, isLoading: isLoadingActive } = useActiveFiatLoansWithDetails();

  const stats = {
    pendingCount: pendingLoans.length,
    activeCount: activeLoans.length,
    totalPendingVolume: pendingLoans.reduce((sum, loan) => sum + Number(loan.fiatAmountCents) / 100, 0),
    totalActiveVolume: activeLoans.reduce((sum, loan) => sum + Number(loan.fiatAmountCents) / 100, 0),
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
