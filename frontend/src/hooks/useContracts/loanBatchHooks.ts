'use client';

import {
  useReadContracts,
  Address,
  formatUnits,
  useCallback,
  CONTRACT_ADDRESSES,
  getActiveChainId,
  getTokenByAddress,
  LoanMarketPlaceABI,
} from './shared';
import { useNextLoanId, useNextLenderOfferId, useNextLoanRequestId } from './loanReadHooks';

export function useBatchLoanRequests(startId: number, count: number) {
  const { data: requestsData, isLoading, isError, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'loanRequests',
      args: [BigInt(startId + i)],
      chainId: getActiveChainId(),
    })),
    query: {
      enabled: count > 0,
    },
  });

  const requests = (requestsData || [])
    .map((result, index) => {
      if (result.status !== 'success' || !result.result) return null;

      const data = result.result;
      const isArray = Array.isArray(data);
      let requestData;
      if (isArray) {
        const arr = data as readonly unknown[];
        requestData = {
          requestId: arr[0],
          borrower: arr[1],
          collateralAmount: arr[2],
          collateralToken: arr[3],
          borrowAsset: arr[4],
          borrowAmount: arr[5],
          duration: arr[6],
          maxInterestRate: arr[7],
          interestRate: arr[8],
          createdAt: arr[9],
          expireAt: arr[10],
          status: arr[11],
          chainId: arr[12],
        };
      } else {
        const obj = data as Record<string, unknown>;
        requestData = {
          requestId: obj.requestId,
          borrower: obj.borrower,
          collateralAmount: obj.collateralAmount,
          collateralToken: obj.collateralToken,
          borrowAsset: obj.borrowAsset,
          borrowAmount: obj.borrowAmount,
          duration: obj.duration,
          maxInterestRate: obj.maxInterestRate,
          interestRate: obj.interestRate,
          createdAt: obj.createdAt,
          expireAt: obj.expireAt,
          status: obj.status,
          chainId: obj.chainId,
        };
      }

      if (!requestData.borrower || requestData.borrower === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        requestId: BigInt(startId + index),
        borrower: requestData.borrower as Address,
        collateralAmount: requestData.collateralAmount as bigint,
        collateralToken: requestData.collateralToken as Address,
        borrowAsset: requestData.borrowAsset as Address,
        borrowAmount: requestData.borrowAmount as bigint,
        duration: requestData.duration as bigint,
        maxInterestRate: (requestData.maxInterestRate || requestData.interestRate) as bigint,
        interestRate: requestData.interestRate as bigint,
        createdAt: requestData.createdAt as bigint,
        expireAt: requestData.expireAt as bigint,
        status: Number(requestData.status),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return { data: requests, isLoading, isError, refetch };
}

export function useBatchLenderOffers(startId: number, count: number) {
  const { data: offersData, isLoading, isError, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'lenderOffers',
      args: [BigInt(startId + i)],
      chainId: getActiveChainId(),
    })),
    query: {
      enabled: count > 0,
    },
  });

  const offers = (offersData || [])
    .map((result, index) => {
      if (result.status !== 'success' || !result.result) return null;

      const data = result.result;
      const isArray = Array.isArray(data);
      let offerData;
      if (isArray) {
        const arr = data as readonly unknown[];
        offerData = {
          offerId: arr[0],
          lender: arr[1],
          lendAsset: arr[2],
          lendAmount: arr[3],
          remainingAmount: arr[4],
          borrowedAmount: arr[5],
          requiredCollateralAsset: arr[6],
          minCollateralAmount: arr[7],
          duration: arr[8],
          interestRate: arr[9],
          createdAt: arr[10],
          expireAt: arr[11],
          status: arr[12],
          chainId: arr[13],
        };
      } else {
        const obj = data as Record<string, unknown>;
        offerData = {
          offerId: obj.offerId,
          lender: obj.lender,
          lendAsset: obj.lendAsset,
          lendAmount: obj.lendAmount,
          remainingAmount: obj.remainingAmount,
          borrowedAmount: obj.borrowedAmount,
          requiredCollateralAsset: obj.requiredCollateralAsset,
          minCollateralAmount: obj.minCollateralAmount,
          duration: obj.duration,
          interestRate: obj.interestRate,
          createdAt: obj.createdAt,
          expireAt: obj.expireAt,
          status: obj.status,
          chainId: obj.chainId,
        };
      }

      if (!offerData.lender || offerData.lender === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return {
        offerId: BigInt(startId + index),
        lender: offerData.lender as Address,
        lendAsset: offerData.lendAsset as Address,
        lendAmount: offerData.lendAmount as bigint,
        remainingAmount: offerData.remainingAmount as bigint,
        borrowedAmount: offerData.borrowedAmount as bigint,
        requiredCollateralAsset: offerData.requiredCollateralAsset as Address,
        minCollateralAmount: offerData.minCollateralAmount as bigint,
        duration: offerData.duration as bigint,
        interestRate: offerData.interestRate as bigint,
        createdAt: offerData.createdAt as bigint,
        expireAt: offerData.expireAt as bigint,
        status: Number(offerData.status),
        chainId: offerData.chainId as bigint,
      };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  return { data: offers, isLoading, isError, refetch };
}

export function useBatchLoans(startId: number, count: number) {
  const { data: loansData, isLoading, isError, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'loans',
      args: [BigInt(startId + i)],
      chainId: getActiveChainId(),
    })),
    query: {
      enabled: count > 0,
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
          requestId: arr[1],
          borrower: arr[2],
          lender: arr[3],
          collateralAsset: arr[4],
          collateralAmount: arr[5],
          collateralReleased: arr[6],
          borrowAsset: arr[7],
          principalAmount: arr[8],
          interestRate: arr[9],
          duration: arr[10],
          startTime: arr[11],
          dueDate: arr[12],
          amountRepaid: arr[13],
          status: arr[14],
          lastInterestUpdate: arr[15],
          gracePeriodEnd: arr[16],
          isCrossChain: arr[17],
          sourceChainId: arr[18],
          targetChainId: arr[19],
          remoteChainLoanId: arr[20],
        };
      } else {
        const obj = data as Record<string, unknown>;
        loanData = {
          loanId: obj.loanId,
          requestId: obj.requestId,
          borrower: obj.borrower,
          lender: obj.lender,
          collateralAsset: obj.collateralAsset,
          collateralAmount: obj.collateralAmount,
          collateralReleased: obj.collateralReleased,
          borrowAsset: obj.borrowAsset,
          principalAmount: obj.principalAmount,
          interestRate: obj.interestRate,
          duration: obj.duration,
          startTime: obj.startTime,
          dueDate: obj.dueDate,
          amountRepaid: obj.amountRepaid,
          status: obj.status,
          lastInterestUpdate: obj.lastInterestUpdate,
          gracePeriodEnd: obj.gracePeriodEnd,
          isCrossChain: obj.isCrossChain,
          sourceChainId: obj.sourceChainId,
          targetChainId: obj.targetChainId,
          remoteChainLoanId: obj.remoteChainLoanId,
        };
      }

      if (!loanData.borrower || loanData.borrower === '0x0000000000000000000000000000000000000000' || Number(loanData.status) === 0) {
        return null;
      }

      return {
        loanId: BigInt(startId + index),
        requestId: loanData.requestId as bigint,
        borrower: loanData.borrower as Address,
        lender: loanData.lender as Address,
        collateralAsset: loanData.collateralAsset as Address,
        collateralAmount: loanData.collateralAmount as bigint,
        collateralReleased: loanData.collateralReleased as bigint,
        borrowAsset: loanData.borrowAsset as Address,
        principalAmount: loanData.principalAmount as bigint,
        interestRate: loanData.interestRate as bigint,
        duration: loanData.duration as bigint,
        startTime: loanData.startTime as bigint,
        dueDate: loanData.dueDate as bigint,
        amountRepaid: loanData.amountRepaid as bigint,
        status: Number(loanData.status),
        lastInterestUpdate: loanData.lastInterestUpdate as bigint,
        gracePeriodEnd: loanData.gracePeriodEnd as bigint,
        isCrossChain: loanData.isCrossChain as boolean,
        sourceChainId: loanData.sourceChainId as bigint,
        targetChainId: loanData.targetChainId as bigint,
        remoteChainLoanId: loanData.remoteChainLoanId as bigint,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  return { data: loans, isLoading, isError, refetch };
}

const APPROX_USD_PRICES: Record<string, number> = {
  ETH: 3200,
  WETH: 3200,
  WBTC: 95000,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  LINK: 22,
  UNI: 12,
};

function getApproxUSDPrice(tokenSymbol: string | undefined): number {
  if (!tokenSymbol) return 1;
  return APPROX_USD_PRICES[tokenSymbol] || 1;
}

export function usePlatformStats() {
  const { data: nextLoanId, isLoading: isLoadingNextId, isError: isErrorNextId } = useNextLoanId();
  const { data: nextOfferId } = useNextLenderOfferId();

  const maxLoansToCheck = 100;
  const totalLoans = nextLoanId ? Number(nextLoanId) : 0;
  const loansToFetch = Math.min(totalLoans, maxLoansToCheck);
  const totalOffers = nextOfferId ? Number(nextOfferId) : 0;
  const offersToFetch = Math.min(totalOffers, maxLoansToCheck);

  const { data: loans, isLoading: isLoadingLoans, isError: isErrorLoans } = useBatchLoans(0, loansToFetch);
  const { data: offers } = useBatchLenderOffers(0, offersToFetch);

  const isLoading = isLoadingNextId || isLoadingLoans;
  const isError = isErrorNextId || isErrorLoans;

  const stats = {
    totalLoans,
    activeLoans: 0,
    totalBorrowedUSD: 0,
    totalCollateralUSD: 0,
    uniqueBorrowers: new Set<Address>(),
    uniqueLenders: new Set<Address>(),
  };

  (loans || []).forEach((loan) => {
    const borrowToken = getTokenByAddress(loan.borrowAsset as Address);
    const collateralToken = getTokenByAddress(loan.collateralAsset as Address);
    const borrowDecimals = borrowToken?.decimals || 18;
    const collateralDecimals = collateralToken?.decimals || 18;
    const borrowPriceUSD = getApproxUSDPrice(borrowToken?.symbol);
    const collateralPriceUSD = getApproxUSDPrice(collateralToken?.symbol);

    if (loan.status === 1) {
      stats.activeLoans++;
      const collateralFormatted = Number(formatUnits(loan.collateralAmount as bigint, collateralDecimals));
      stats.totalCollateralUSD += collateralFormatted * collateralPriceUSD;
    }

    const borrowedFormatted = Number(formatUnits(loan.principalAmount as bigint, borrowDecimals));
    stats.totalBorrowedUSD += borrowedFormatted * borrowPriceUSD;
    stats.uniqueBorrowers.add(loan.borrower as Address);
    stats.uniqueLenders.add(loan.lender as Address);
  });

  (offers || []).forEach((offer) => {
    stats.uniqueLenders.add(offer.lender as Address);
  });

  return {
    data: {
      totalLoans: stats.totalLoans,
      activeLoans: stats.activeLoans,
      totalBorrowed: stats.totalBorrowedUSD,
      totalCollateralValue: stats.totalCollateralUSD,
      activeUsers: stats.uniqueBorrowers.size + stats.uniqueLenders.size,
      uniqueBorrowers: stats.uniqueBorrowers.size,
      uniqueLenders: stats.uniqueLenders.size,
    },
    isLoading,
    isError,
  };
}

export function useUserLoanRequestsBatch(userAddress: Address | undefined) {
  const { data: nextRequestId, isLoading: isLoadingCount } = useNextLoanRequestId();
  const requestCount = nextRequestId ? Number(nextRequestId) : 0;
  const { data: allRequests, isLoading: isLoadingRequests, isError, refetch } = useBatchLoanRequests(0, Math.min(requestCount, 50));
  const userRequests = (allRequests || []).filter((r) =>
    userAddress && r.borrower.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userRequests,
    isLoading: isLoadingCount || isLoadingRequests,
    isError,
    refetch,
  };
}

export function useUserLenderOffersBatch(userAddress: Address | undefined) {
  const { data: nextOfferId, isLoading: isLoadingCount } = useNextLenderOfferId();
  const offerCount = nextOfferId ? Number(nextOfferId) : 0;
  const { data: allOffers, isLoading: isLoadingOffers, isError, refetch } = useBatchLenderOffers(0, Math.min(offerCount, 50));
  const userOffers = (allOffers || []).filter((o) =>
    userAddress && o.lender.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userOffers,
    isLoading: isLoadingCount || isLoadingOffers,
    isError,
    refetch,
  };
}

export function useUserBorrowedLoans(userAddress: Address | undefined) {
  const { data: nextLoanId, isLoading: isLoadingCount } = useNextLoanId();
  const loanCount = nextLoanId ? Number(nextLoanId) : 0;
  const { data: allLoans, isLoading: isLoadingLoans, isError, refetch } = useBatchLoans(0, Math.min(loanCount, 50));
  const userLoans = (allLoans || []).filter((l) =>
    userAddress && l.borrower.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userLoans,
    isLoading: isLoadingCount || isLoadingLoans,
    isError,
    refetch,
  };
}

export function useUserLentLoans(userAddress: Address | undefined) {
  const { data: nextLoanId, isLoading: isLoadingCount } = useNextLoanId();
  const loanCount = nextLoanId ? Number(nextLoanId) : 0;
  const { data: allLoans, isLoading: isLoadingLoans, isError, refetch } = useBatchLoans(0, Math.min(loanCount, 50));
  const userLoans = (allLoans || []).filter((l) =>
    userAddress && l.lender.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userLoans,
    isLoading: isLoadingCount || isLoadingLoans,
    isError,
    refetch,
  };
}

export function useUserDashboardData(userAddress: Address | undefined) {
  const { data: borrowedLoans, isLoading: isLoadingBorrowed, refetch: refetchBorrowed } = useUserBorrowedLoans(userAddress);
  const { data: lentLoans, isLoading: isLoadingLent, refetch: refetchLent } = useUserLentLoans(userAddress);
  const { data: loanRequests, isLoading: isLoadingRequests, refetch: refetchRequests } = useUserLoanRequestsBatch(userAddress);
  const { data: lenderOffers, isLoading: isLoadingOffers, refetch: refetchOffers } = useUserLenderOffersBatch(userAddress);

  const refetch = useCallback(() => {
    refetchBorrowed();
    refetchLent();
    refetchRequests();
    refetchOffers();
  }, [refetchBorrowed, refetchLent, refetchRequests, refetchOffers]);

  return {
    borrowedLoans: borrowedLoans || [],
    lentLoans: lentLoans || [],
    loanRequests: loanRequests || [],
    lenderOffers: lenderOffers || [],
    isLoading: isLoadingBorrowed || isLoadingLent || isLoadingRequests || isLoadingOffers,
    refetch,
  };
}
