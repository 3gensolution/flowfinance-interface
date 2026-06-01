'use client';

import { useMemo, useCallback } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { Abi, Address } from 'viem';
import { CHAIN_CONFIG, getContractAddresses, ZERO_ADDRESS } from '@/config/contracts';
import { config as wagmiConfig } from '@/config/wagmi';
import { LoanRequest, LenderOffer, LoanRequestStatus } from '@/types';
import {
  FiatLoan,
  FiatLoanStatus,
  FiatLenderOffer,
  FiatLenderOfferStatus,
} from '@/hooks/useFiatLoan';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;
const MAX_ITEMS_TO_FETCH = 50;

export function useCryptoMarketplaceRequests(chainId: number) {
  const { isConnected } = useAccount();
  const addresses = getContractAddresses(chainId);
  const enabled = isConnected && addresses.loanMarketPlace !== ZERO_ADDRESS;

  const { data: nextRequestId, refetch: refetchCount, error: errorCount } = useReadContract({
    address: addresses.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanRequestId',
    chainId,
    config: wagmiConfig,
    query: { enabled },
  });

  const totalCount = nextRequestId ? Number(nextRequestId) : 0;
  const count = Math.min(totalCount, MAX_ITEMS_TO_FETCH);

  const { data: requestsData, isLoading, refetch: refetchData, error: errorData } = useReadContracts({
    contracts: enabled
      ? Array.from({ length: count }, (_, i) => ({
          address: addresses.loanMarketPlace,
          abi: LoanMarketPlaceABI,
          functionName: 'loanRequests',
          args: [BigInt(totalCount - 1 - i)],
          chainId,
        }))
      : [],
    config: wagmiConfig,
    query: {
      enabled: enabled && count > 0,
    },
  });

  const data = useMemo(() => {
    if (!requestsData) return [];

    return requestsData
      .map((result, index) => {
        if (result.status !== 'success' || !result.result) return null;

        const raw = result.result;
        const parsed = Array.isArray(raw)
          ? {
              requestId: raw[0],
              borrower: raw[1],
              collateralAmount: raw[2],
              collateralToken: raw[3],
              borrowAsset: raw[4],
              borrowAmount: raw[5],
              duration: raw[6],
              maxInterestRate: raw[7],
              interestRate: raw[8],
              createdAt: raw[9],
              expireAt: raw[10],
              status: raw[11],
              chainId: raw[12],
            }
          : raw as Record<string, unknown>;

        if (!parsed.borrower || parsed.borrower === ZERO_ADDRESS) return null;
        if (Number(parsed.status) !== LoanRequestStatus.PENDING) return null;

        return {
          requestId: BigInt(totalCount - 1 - index),
          borrower: parsed.borrower as Address,
          collateralAmount: parsed.collateralAmount as bigint,
          collateralToken: parsed.collateralToken as Address,
          borrowAsset: parsed.borrowAsset as Address,
          borrowAmount: parsed.borrowAmount as bigint,
          duration: parsed.duration as bigint,
          maxInterestRate: parsed.maxInterestRate as bigint,
          interestRate: parsed.interestRate as bigint,
          createdAt: parsed.createdAt as bigint,
          expireAt: parsed.expireAt as bigint,
          status: Number(parsed.status) as LoanRequestStatus,
          chainId: (parsed.chainId as bigint) || BigInt(0),
        } as LoanRequest;
      })
      .filter((item): item is LoanRequest => item !== null);
  }, [requestsData, totalCount]);

  const refetch = useCallback(() => {
    refetchCount();
    refetchData();
  }, [refetchCount, refetchData]);

  return { data, isLoading, refetch, error: errorCount || errorData };
}

export function useCryptoMarketplaceOffers(chainId: number) {
  const { isConnected } = useAccount();
  const addresses = getContractAddresses(chainId);
  const enabled = isConnected && addresses.loanMarketPlace !== ZERO_ADDRESS;

  const { data: nextOfferId, refetch: refetchCount, error: errorCount } = useReadContract({
    address: addresses.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLenderOfferId',
    chainId,
    config: wagmiConfig,
    query: { enabled },
  });

  const totalCount = nextOfferId ? Number(nextOfferId) : 0;
  const count = Math.min(totalCount, MAX_ITEMS_TO_FETCH);

  const { data: offersData, isLoading, refetch: refetchData, error: errorData } = useReadContracts({
    contracts: enabled
      ? Array.from({ length: count }, (_, i) => ({
          address: addresses.loanMarketPlace,
          abi: LoanMarketPlaceABI,
          functionName: 'lenderOffers',
          args: [BigInt(totalCount - 1 - i)],
          chainId,
        }))
      : [],
    config: wagmiConfig,
    query: {
      enabled: enabled && count > 0,
    },
  });

  const data = useMemo(() => {
    if (!offersData) return [];

    return offersData
      .map((result, index) => {
        if (result.status !== 'success' || !result.result) return null;

        const raw = result.result;
        const parsed = Array.isArray(raw)
          ? {
              offerId: raw[0],
              lender: raw[1],
              lendAsset: raw[2],
              lendAmount: raw[3],
              remainingAmount: raw[4],
              borrowedAmount: raw[5],
              requiredCollateralAsset: raw[6],
              minCollateralAmount: raw[7],
              duration: raw[8],
              interestRate: raw[9],
              createdAt: raw[10],
              expireAt: raw[11],
              status: raw[12],
              chainId: raw[13],
            }
          : raw as Record<string, unknown>;

        if (!parsed.lender || parsed.lender === ZERO_ADDRESS) return null;
        if (Number(parsed.status) !== LoanRequestStatus.PENDING) return null;

        return {
          offerId: BigInt(totalCount - 1 - index),
          lender: parsed.lender as Address,
          lendAsset: parsed.lendAsset as Address,
          lendAmount: parsed.lendAmount as bigint,
          remainingAmount: parsed.remainingAmount as bigint,
          borrowedAmount: parsed.borrowedAmount as bigint,
          requiredCollateralAsset: parsed.requiredCollateralAsset as Address,
          minCollateralAmount: parsed.minCollateralAmount as bigint,
          duration: parsed.duration as bigint,
          interestRate: parsed.interestRate as bigint,
          createdAt: parsed.createdAt as bigint,
          expireAt: parsed.expireAt as bigint,
          status: Number(parsed.status) as LoanRequestStatus,
          chainId: (parsed.chainId as bigint) || BigInt(0),
        } as LenderOffer;
      })
      .filter((item): item is LenderOffer => item !== null);
  }, [offersData, totalCount]);

  const refetch = useCallback(() => {
    refetchCount();
    refetchData();
  }, [refetchCount, refetchData]);

  return { data, isLoading, refetch, error: errorCount || errorData };
}

export function useFiatMarketplaceOffers() {
  const { isConnected } = useAccount();
  const baseChainId = CHAIN_CONFIG.baseSepolia.id;
  const addresses = getContractAddresses(baseChainId);
  const enabled = isConnected && addresses.fiatLoanBridge !== ZERO_ADDRESS;

  const { data: activeIds, isLoading: isLoadingIds, refetch: refetchIds, error: errorIds } = useReadContract({
    address: addresses.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getActiveFiatLenderOffers',
    chainId: baseChainId,
    config: wagmiConfig,
    query: { enabled },
  });

  const offerIds = useMemo(() => (activeIds as bigint[]) || [], [activeIds]);

  const { data: offersData, isLoading: isLoadingOffers, refetch: refetchOffers, error: errorOffers } = useReadContracts({
    contracts: enabled
      ? offerIds.map((id) => ({
          address: addresses.fiatLoanBridge,
          abi: FiatLoanBridgeABI,
          functionName: 'fiatLenderOffers',
          args: [id],
          chainId: baseChainId,
        }))
      : [],
    config: wagmiConfig,
    query: {
      enabled: enabled && offerIds.length > 0,
    },
  });

  const data = useMemo(() => {
    if (!offersData) return [];

    return offersData
      .map((result, index) => {
        if (result.status !== 'success' || !result.result) return null;

        const raw = result.result;
        const parsed = Array.isArray(raw)
          ? {
              offerId: raw[0],
              lender: raw[1],
              fiatAmountCents: raw[2],
              remainingAmountCents: raw[3],
              borrowedAmountCents: raw[4],
              currency: raw[5],
              minCollateralValueUSD: raw[6],
              duration: raw[7],
              interestRate: raw[8],
              createdAt: raw[9],
              expireAt: raw[10],
              status: raw[11],
              exchangeRateAtCreation: raw[12],
              chainId: raw[13],
            }
          : raw as Record<string, unknown>;

        if (!parsed.lender || parsed.lender === ZERO_ADDRESS) return null;

        return {
          offerId: offerIds[index],
          lender: parsed.lender as Address,
          fiatAmountCents: parsed.fiatAmountCents as bigint,
          remainingAmountCents: (parsed.remainingAmountCents as bigint) || BigInt(0),
          borrowedAmountCents: (parsed.borrowedAmountCents as bigint) || BigInt(0),
          currency: parsed.currency as string,
          minCollateralValueUSD: parsed.minCollateralValueUSD as bigint,
          duration: parsed.duration as bigint,
          interestRate: parsed.interestRate as bigint,
          createdAt: parsed.createdAt as bigint,
          expireAt: parsed.expireAt as bigint,
          status: Number(parsed.status) as FiatLenderOfferStatus,
          exchangeRateAtCreation: (parsed.exchangeRateAtCreation as bigint) || BigInt(0),
          chainId: (parsed.chainId as bigint) || BigInt(0),
        } as FiatLenderOffer;
      })
      .filter((item): item is FiatLenderOffer => item !== null);
  }, [offersData, offerIds]);

  const refetch = useCallback(() => {
    refetchIds();
    refetchOffers();
  }, [refetchIds, refetchOffers]);

  return { data, isLoading: isLoadingIds || isLoadingOffers, refetch, error: errorIds || errorOffers };
}

export function useFiatMarketplaceRequests() {
  const { isConnected } = useAccount();
  const baseChainId = CHAIN_CONFIG.baseSepolia.id;
  const addresses = getContractAddresses(baseChainId);
  const enabled = isConnected && addresses.fiatLoanBridge !== ZERO_ADDRESS;

  const { data: pendingIds, isLoading: isLoadingIds, refetch: refetchIds, error: errorIds } = useReadContract({
    address: addresses.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getPendingFiatLoans',
    chainId: baseChainId,
    config: wagmiConfig,
    query: { enabled },
  });

  const loanIds = useMemo(() => (pendingIds as bigint[]) || [], [pendingIds]);

  const { data: loansData, isLoading: isLoadingLoans, refetch: refetchLoans, error: errorLoans } = useReadContracts({
    contracts: enabled
      ? loanIds.map((id) => ({
          address: addresses.fiatLoanBridge,
          abi: FiatLoanBridgeABI,
          functionName: 'getFiatLoan',
          args: [id],
          chainId: baseChainId,
        }))
      : [],
    config: wagmiConfig,
    query: {
      enabled: enabled && loanIds.length > 0,
    },
  });

  const data = useMemo(() => {
    if (!loansData) return [];

    return loansData
      .map((result, index) => {
        if (result.status !== 'success' || !result.result) return null;

        const raw = result.result;
        const parsed = Array.isArray(raw)
          ? {
              loanId: raw[0],
              borrower: raw[1],
              supplier: raw[2],
              collateralAsset: raw[3],
              collateralAmount: raw[4],
              fiatAmountCents: raw[5],
              currency: raw[6],
              interestRate: raw[7],
              duration: raw[8],
              status: raw[9],
              createdAt: raw[10],
              activatedAt: raw[11],
              dueDate: raw[12],
              gracePeriodEnd: raw[13],
              claimableAmountCents: raw[14],
              fundsWithdrawn: raw[15],
              repaymentDepositId: raw[16],
              exchangeRateAtCreation: raw[17],
              chainId: raw[18],
            }
          : raw as Record<string, unknown>;

        if (!parsed.borrower || parsed.borrower === ZERO_ADDRESS) return null;
        if (Number(parsed.status) !== FiatLoanStatus.PENDING_SUPPLIER) return null;

        return {
          loanId: loanIds[index],
          borrower: parsed.borrower as Address,
          supplier: parsed.supplier as Address,
          collateralAsset: parsed.collateralAsset as Address,
          collateralAmount: parsed.collateralAmount as bigint,
          fiatAmountCents: parsed.fiatAmountCents as bigint,
          currency: parsed.currency as string,
          interestRate: parsed.interestRate as bigint,
          duration: parsed.duration as bigint,
          status: Number(parsed.status) as FiatLoanStatus,
          createdAt: parsed.createdAt as bigint,
          activatedAt: parsed.activatedAt as bigint,
          dueDate: parsed.dueDate as bigint,
          gracePeriodEnd: parsed.gracePeriodEnd as bigint,
          claimableAmountCents: parsed.claimableAmountCents as bigint,
          fundsWithdrawn: parsed.fundsWithdrawn as boolean,
          repaymentDepositId: parsed.repaymentDepositId as `0x${string}`,
          exchangeRateAtCreation: (parsed.exchangeRateAtCreation as bigint) || BigInt(0),
          chainId: (parsed.chainId as bigint) || BigInt(0),
        } as FiatLoan;
      })
      .filter((item): item is FiatLoan => item !== null);
  }, [loansData, loanIds]);

  const refetch = useCallback(() => {
    refetchIds();
    refetchLoans();
  }, [refetchIds, refetchLoans]);

  return { data, isLoading: isLoadingIds || isLoadingLoans, refetch, error: errorIds || errorLoans };
}
