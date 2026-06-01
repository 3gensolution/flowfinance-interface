'use client';

import { useMemo } from 'react';
import { Address } from 'viem';
import {
  useBatchLenderOffers,
  useBatchLoanRequests,
  useBatchLoans,
  useLenderOffer,
  useLoan,
  useLoanRequest,
  useNextLenderOfferId,
  useNextLoanId,
  useNextLoanRequestId,
  useTokenPrice,
  useUserBorrowedLoans,
  useUserLenderOffersBatch,
  useUserLentLoans,
  useUserLoanRequestsBatch,
} from '@/hooks/useContracts';
import {
  FiatLenderOffer,
  FiatLenderOfferStatus,
  FiatLoan,
  FiatLoanStatus,
  useActiveFiatLenderOffersWithDetails,
  useActiveFiatLoansWithDetails,
  useBatchFiatLenderOffers,
  useBatchFiatLoans,
  useFiatLenderOffer,
  useFiatLoan,
  usePendingFiatLoansWithDetails,
  useUserFiatLenderOffers,
  useUserFiatLoansAsBorrower,
  useUserFiatLoansAsSupplier,
} from '@/hooks/useFiatLoan';
import { LenderOffer, Loan, LoanRequest, LoanRequestStatus, LoanStatus } from '@/types';

const MAX_ITEMS_TO_FETCH = 50;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function useLimitedCount(countHookData: bigint | undefined) {
  return countHookData ? Math.min(Number(countHookData), MAX_ITEMS_TO_FETCH) : 0;
}

function dedupeById<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseLoanRequest(result: unknown, fallbackId?: bigint): LoanRequest | undefined {
  if (!result) return undefined;

  const isArray = Array.isArray(result);
  const data = isArray ? {
    requestId: result[0],
    borrower: result[1],
    collateralAmount: result[2],
    collateralToken: result[3],
    borrowAsset: result[4],
    borrowAmount: result[5],
    duration: result[6],
    maxInterestRate: result[7],
    interestRate: result[8],
    createdAt: result[9],
    expireAt: result[10],
    status: result[11],
    chainId: result[12],
  } : result as Record<string, unknown>;

  if (!data.borrower || data.borrower === ZERO_ADDRESS) return undefined;

  return {
    requestId: (fallbackId ?? data.requestId) as bigint,
    borrower: data.borrower as Address,
    collateralAmount: data.collateralAmount as bigint,
    collateralToken: data.collateralToken as Address,
    borrowAsset: data.borrowAsset as Address,
    borrowAmount: data.borrowAmount as bigint,
    duration: data.duration as bigint,
    maxInterestRate: (data.maxInterestRate ?? data.interestRate) as bigint,
    interestRate: data.interestRate as bigint,
    createdAt: data.createdAt as bigint,
    expireAt: data.expireAt as bigint,
    status: Number(data.status) as LoanRequestStatus,
    chainId: (data.chainId as bigint | undefined) ?? BigInt(0),
  };
}

function parseLenderOffer(result: unknown, fallbackId?: bigint): LenderOffer | undefined {
  if (!result) return undefined;

  const isArray = Array.isArray(result);
  const data = isArray ? {
    offerId: result[0],
    lender: result[1],
    lendAsset: result[2],
    lendAmount: result[3],
    remainingAmount: result[4],
    borrowedAmount: result[5],
    requiredCollateralAsset: result[6],
    minCollateralAmount: result[7],
    duration: result[8],
    interestRate: result[9],
    createdAt: result[10],
    expireAt: result[11],
    status: result[12],
    chainId: result[13],
  } : result as Record<string, unknown>;

  if (!data.lender || data.lender === ZERO_ADDRESS) return undefined;

  return {
    offerId: (fallbackId ?? data.offerId) as bigint,
    lender: data.lender as Address,
    lendAsset: data.lendAsset as Address,
    lendAmount: data.lendAmount as bigint,
    remainingAmount: data.remainingAmount as bigint,
    borrowedAmount: data.borrowedAmount as bigint,
    requiredCollateralAsset: data.requiredCollateralAsset as Address,
    minCollateralAmount: data.minCollateralAmount as bigint,
    duration: data.duration as bigint,
    interestRate: data.interestRate as bigint,
    createdAt: data.createdAt as bigint,
    expireAt: data.expireAt as bigint,
    status: Number(data.status) as LoanRequestStatus,
    chainId: (data.chainId as bigint | undefined) ?? BigInt(0),
  };
}

function parseLoan(result: unknown, fallbackId?: bigint): Loan | undefined {
  if (!result) return undefined;

  const isArray = Array.isArray(result);
  const data = isArray ? {
    loanId: result[0],
    requestId: result[1],
    borrower: result[2],
    lender: result[3],
    collateralAsset: result[4],
    collateralAmount: result[5],
    collateralReleased: result[6],
    borrowAsset: result[7],
    principalAmount: result[8],
    interestRate: result[9],
    duration: result[10],
    startTime: result[11],
    dueDate: result[12],
    amountRepaid: result[13],
    status: result[14],
    lastInterestUpdate: result[15],
    gracePeriodEnd: result[16],
    isCrossChain: result[17],
    sourceChainId: result[18],
    targetChainId: result[19],
    remoteChainLoanId: result[20],
  } : result as Record<string, unknown>;

  if (!data.borrower || data.borrower === ZERO_ADDRESS) return undefined;

  return {
    loanId: (fallbackId ?? data.loanId) as bigint,
    requestId: data.requestId as bigint,
    borrower: data.borrower as Address,
    lender: data.lender as Address,
    collateralAsset: data.collateralAsset as Address,
    collateralAmount: data.collateralAmount as bigint,
    collateralReleased: data.collateralReleased as bigint,
    borrowAsset: data.borrowAsset as Address,
    principalAmount: data.principalAmount as bigint,
    interestRate: data.interestRate as bigint,
    duration: data.duration as bigint,
    startTime: data.startTime as bigint,
    dueDate: data.dueDate as bigint,
    amountRepaid: data.amountRepaid as bigint,
    status: Number(data.status) as LoanStatus,
    lastInterestUpdate: data.lastInterestUpdate as bigint,
    gracePeriodEnd: data.gracePeriodEnd as bigint,
    isCrossChain: Boolean(data.isCrossChain),
    sourceChainId: data.sourceChainId as bigint,
    targetChainId: data.targetChainId as bigint,
    remoteChainLoanId: data.remoteChainLoanId as bigint,
  };
}

function parseFiatLoan(result: unknown, fallbackId?: bigint): FiatLoan | undefined {
  if (!result) return undefined;

  const isArray = Array.isArray(result);
  const data = isArray ? {
    loanId: result[0],
    borrower: result[2],
    supplier: result[3],
    collateralAsset: result[4],
    collateralAmount: result[5],
    fiatAmountCents: result[6],
    currency: result[7],
    interestRate: result[8],
    duration: result[9],
    status: result[10],
    createdAt: result[11],
    activatedAt: result[12],
    dueDate: result[13],
    gracePeriodEnd: result[14],
    claimableAmountCents: result[15],
    fundsWithdrawn: result[16],
    repaymentDepositId: result[17],
    exchangeRateAtCreation: result[18],
    chainId: result[19],
  } : result as Record<string, unknown>;

  if (!data.borrower || data.borrower === ZERO_ADDRESS) return undefined;

  return {
    loanId: (fallbackId ?? data.loanId) as bigint,
    borrower: data.borrower as Address,
    supplier: data.supplier as Address,
    collateralAsset: data.collateralAsset as Address,
    collateralAmount: data.collateralAmount as bigint,
    fiatAmountCents: data.fiatAmountCents as bigint,
    currency: data.currency as string,
    interestRate: data.interestRate as bigint,
    duration: data.duration as bigint,
    status: Number(data.status) as FiatLoanStatus,
    createdAt: data.createdAt as bigint,
    activatedAt: data.activatedAt as bigint,
    dueDate: data.dueDate as bigint,
    gracePeriodEnd: data.gracePeriodEnd as bigint,
    claimableAmountCents: data.claimableAmountCents as bigint,
    fundsWithdrawn: Boolean(data.fundsWithdrawn),
    repaymentDepositId: data.repaymentDepositId as `0x${string}`,
    exchangeRateAtCreation: (data.exchangeRateAtCreation as bigint | undefined) ?? BigInt(0),
    chainId: (data.chainId as bigint | undefined) ?? BigInt(0),
  };
}

function parseFiatLenderOffer(result: unknown, fallbackId?: bigint): FiatLenderOffer | undefined {
  if (!result) return undefined;

  const isArray = Array.isArray(result);
  const data = isArray ? {
    offerId: result[0],
    lender: result[1],
    fiatAmountCents: result[2],
    remainingAmountCents: result[3],
    borrowedAmountCents: result[4],
    currency: result[5],
    minCollateralValueUSD: result[6],
    duration: result[7],
    interestRate: result[8],
    createdAt: result[9],
    expireAt: result[10],
    status: result[11],
    exchangeRateAtCreation: result[12],
    chainId: result[13],
  } : result as Record<string, unknown>;

  if (!data.lender || data.lender === ZERO_ADDRESS) return undefined;

  return {
    offerId: (fallbackId ?? data.offerId) as bigint,
    lender: data.lender as Address,
    fiatAmountCents: data.fiatAmountCents as bigint,
    remainingAmountCents: (data.remainingAmountCents as bigint | undefined) ?? BigInt(0),
    borrowedAmountCents: (data.borrowedAmountCents as bigint | undefined) ?? BigInt(0),
    currency: data.currency as string,
    minCollateralValueUSD: data.minCollateralValueUSD as bigint,
    duration: data.duration as bigint,
    interestRate: data.interestRate as bigint,
    createdAt: data.createdAt as bigint,
    expireAt: data.expireAt as bigint,
    status: Number(data.status) as FiatLenderOfferStatus,
    exchangeRateAtCreation: (data.exchangeRateAtCreation as bigint | undefined) ?? BigInt(0),
    chainId: (data.chainId as bigint | undefined) ?? BigInt(0),
  };
}

export function useLoanRequestsArray() {
  const { data: nextRequestId } = useNextLoanRequestId() as { data: bigint | undefined };
  const requestCount = useLimitedCount(nextRequestId);
  const { data } = useBatchLoanRequests(0, requestCount);
  return data || [];
}

export function usePendingLoanRequests() {
  const requests = useLoanRequestsArray();
  return useMemo(
    () => requests.filter((request) => request.status === LoanRequestStatus.PENDING),
    [requests],
  );
}

export function useLoanRequestsByBorrower(borrower: Address | undefined) {
  const { data } = useUserLoanRequestsBatch(borrower);
  return data || [];
}

export function useLenderOffersArray() {
  const { data: nextOfferId } = useNextLenderOfferId() as { data: bigint | undefined };
  const offerCount = useLimitedCount(nextOfferId);
  const { data } = useBatchLenderOffers(0, offerCount);
  return data || [];
}

export function useActiveLenderOffers() {
  const offers = useLenderOffersArray();
  return useMemo(
    () => offers.filter((offer) => offer.status === LoanRequestStatus.PENDING),
    [offers],
  );
}

export function useLenderOffersByLender(lender: Address | undefined) {
  const { data } = useUserLenderOffersBatch(lender);
  return data || [];
}

export function useLoansArray() {
  const { data: nextLoanId } = useNextLoanId() as { data: bigint | undefined };
  const loanCount = useLimitedCount(nextLoanId);
  const { data } = useBatchLoans(0, loanCount);
  return data || [];
}

export function useActiveLoans() {
  const loans = useLoansArray();
  return useMemo(
    () => loans.filter((loan) => loan.status === LoanStatus.ACTIVE),
    [loans],
  );
}

export function useLoansByBorrower(borrower: Address | undefined) {
  const { data } = useUserBorrowedLoans(borrower);
  return data || [];
}

export function useLoansByLender(lender: Address | undefined) {
  const { data } = useUserLentLoans(lender);
  return data || [];
}

export function useLoanRequestById(id: bigint | undefined) {
  const { data } = useLoanRequest(id);
  return useMemo(() => parseLoanRequest(data, id), [data, id]);
}

export function useLenderOfferById(id: bigint | undefined) {
  const { data } = useLenderOffer(id);
  return useMemo(() => parseLenderOffer(data, id), [data, id]);
}

export function useLoanById(id: bigint | undefined) {
  const { data } = useLoan(id);
  return useMemo(() => parseLoan(data, id), [data, id]);
}

export function useFiatLoansArray() {
  const { data: pendingLoans = [] } = usePendingFiatLoansWithDetails();
  const { data: activeLoans = [] } = useActiveFiatLoansWithDetails();

  return useMemo(
    () => dedupeById([...pendingLoans, ...activeLoans], (loan) => loan.loanId.toString()),
    [pendingLoans, activeLoans],
  );
}

export function usePendingFiatLoansFromStore() {
  const { data } = usePendingFiatLoansWithDetails();
  return data || [];
}

export function useActiveFiatLoansFromStore() {
  const { data } = useActiveFiatLoansWithDetails();
  return data || [];
}

export function useFiatLoansByBorrower(borrower: Address | undefined) {
  const { data } = useUserFiatLoansAsBorrower(borrower);
  return data || [];
}

export function useFiatLoansBySupplier(supplier: Address | undefined) {
  const { data } = useUserFiatLoansAsSupplier(supplier);
  return data || [];
}

export function useFiatLoanById(id: bigint | undefined) {
  const { data } = useFiatLoan(id);
  return useMemo(() => parseFiatLoan(data, id), [data, id]);
}

export function useFiatLenderOffersArray() {
  const { data } = useActiveFiatLenderOffersWithDetails();
  return data || [];
}

export function useActiveFiatLenderOffersFromStore() {
  const { data } = useActiveFiatLenderOffersWithDetails();
  return data || [];
}

export function useFiatLenderOffersByLender(lender: Address | undefined) {
  const { data } = useUserFiatLenderOffers(lender);
  return data || [];
}

export function useFiatLenderOfferById(id: bigint | undefined) {
  const { data } = useFiatLenderOffer(id);
  return useMemo(() => parseFiatLenderOffer(data, id), [data, id]);
}

export function useTokenPriceFromStore(tokenAddress: Address | undefined) {
  const { price, updatedAt, priceFeedAddress } = useTokenPrice(tokenAddress);

  return useMemo(() => {
    if (!tokenAddress || price === undefined || updatedAt === undefined || !priceFeedAddress) {
      return undefined;
    }

    return {
      price,
      updatedAt,
      priceFeedAddress: priceFeedAddress as Address,
    };
  }, [price, priceFeedAddress, tokenAddress, updatedAt]);
}

export function usePendingFiatLoanById(id: bigint | undefined) {
  const ids = id !== undefined ? [id] : [];
  const { data } = useBatchFiatLoans(ids);
  return data?.[0];
}

export function useActiveFiatLenderOfferById(id: bigint | undefined) {
  const ids = id !== undefined ? [id] : [];
  const { data } = useBatchFiatLenderOffers(ids);
  return data?.[0];
}
