'use client';

import {
  useReadContract,
  useReadContracts,
  Address,
  CONTRACT_ADDRESSES,
  getActiveChainId,
  getContractAddresses,
  CONTRACT_ADDRESSES_BY_CHAIN,
  LoanMarketPlaceABI,
} from './shared';

export function useLoanRequest(requestId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'loanRequests',
    args: requestId !== undefined ? [requestId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: requestId !== undefined,
    },
  });
}

export function useLoanRequestMultiChain(requestId: bigint | undefined, preferredChainId?: number) {
  const activeChainId = preferredChainId ?? getActiveChainId();
  const ZERO = '0x0000000000000000000000000000000000000000';
  const chainIds = Object.keys(CONTRACT_ADDRESSES_BY_CHAIN).map(Number);
  const validChains = chainIds.filter((cid) => {
    const addrs = getContractAddresses(cid);
    return addrs.loanMarketPlace && addrs.loanMarketPlace !== ZERO;
  });

  const orderedChains = [
    ...validChains.filter((c) => c === activeChainId),
    ...validChains.filter((c) => c !== activeChainId),
  ];

  const contracts = orderedChains.map((cid) => ({
    address: getContractAddresses(cid).loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'loanRequests' as const,
    args: [requestId!] as const,
    chainId: cid,
  }));

  const result = useReadContracts({
    contracts: requestId !== undefined ? contracts : [],
    query: {
      enabled: requestId !== undefined,
    },
  });

  let data: unknown = undefined;
  let foundChainId: number = activeChainId;

  if (result.data) {
    for (let i = 0; i < orderedChains.length; i++) {
      const entry = result.data[i];
      if (entry?.status === 'success' && entry.result) {
        const tuple = entry.result as readonly unknown[];
        const borrower = tuple[1] as string;
        if (borrower && borrower !== ZERO) {
          data = entry.result;
          foundChainId = orderedChains[i];
          break;
        }
      }
    }
  }

  return {
    data,
    foundChainId,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useLenderOffer(offerId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'lenderOffers',
    args: offerId !== undefined ? [offerId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: offerId !== undefined,
    },
  });
}

export function useLoan(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'loans',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}

export function useLoanHealthFactor(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'getLoanHealthFactor',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}

export function useRepaymentAmount(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'calculateRepaymentAmount',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}

export function useOutstandingDebt(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'getOutstandingDebt',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}

export function useNextLoanRequestId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanRequestId',
    chainId: getActiveChainId(),
  });
}

export function useNextLenderOfferId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLenderOfferId',
    chainId: getActiveChainId(),
  });
}

export function useNextLoanId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanId',
    chainId: getActiveChainId(),
  });
}

export function useUserLoanRequests(address: Address | undefined, index: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'userLoanRequests',
    args: address ? [address, BigInt(index)] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!address,
    },
  });
}

export function useBorrowerLoans(address: Address | undefined, index: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'borrowerLoans',
    args: address ? [address, BigInt(index)] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!address,
    },
  });
}

export function useLenderLoans(address: Address | undefined, index: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'lenderLoans',
    args: address ? [address, BigInt(index)] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!address,
    },
  });
}

export function useRepaymentInfo(loanId: bigint | undefined, options?: { chainId?: number; contractAddress?: Address }) {
  const resolvedAddress = options?.contractAddress || CONTRACT_ADDRESSES.loanMarketPlace;
  const resolvedChainId = options?.chainId || getActiveChainId();
  return useReadContract({
    address: resolvedAddress,
    abi: LoanMarketPlaceABI,
    functionName: 'getRepaymentInfo',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: resolvedChainId,
    query: {
      enabled: loanId !== undefined,
    },
  });
}

export function useMinRepaymentInTokens(loanId: bigint | undefined, options?: { chainId?: number; contractAddress?: Address }) {
  const resolvedAddress = options?.contractAddress || CONTRACT_ADDRESSES.loanMarketPlace;
  const resolvedChainId = options?.chainId || getActiveChainId();
  return useReadContract({
    address: resolvedAddress,
    abi: LoanMarketPlaceABI,
    functionName: 'getMinRepaymentInTokens',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: resolvedChainId,
    query: {
      enabled: loanId !== undefined,
    },
  });
}

export function useCanLiquidate(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'canLiquidate',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}

export function useLoanExtension(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'loanExtensions',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}
