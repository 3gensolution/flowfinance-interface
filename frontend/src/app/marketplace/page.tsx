'use client';

import { useState, useMemo, Suspense, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HandCoins, Info } from 'lucide-react';
import { useReadContracts, useReadContract, useAccount } from 'wagmi';
import { Abi, Address } from 'viem';
import { CHAIN_CONFIG, getContractAddresses, getActiveChainId, type ContractAddresses } from '@/config/contracts';
import { AVAILABLE_NETWORKS, type AvailableNetwork } from '@/contexts/NetworkContext';
import { config as wagmiConfig } from '@/config/wagmi';
import { MarketplaceNetworkSwitcher } from '@/components/network/MarketplaceNetworkSwitcher';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';
import {
  FilterBar,
  FilterState,
  CryptoBorrowRequestCard,
  FiatBorrowRequestCard,
  CryptoLendingOfferCard,
  FiatLendingOfferCard,
  ListingsGrid,
  Pagination,
} from '@/components/marketplace';
import { LoanRequest, LenderOffer, LoanRequestStatus } from '@/types';
import { FiatLoan, FiatLoanStatus, FiatLenderOffer, FiatLenderOfferStatus } from '@/hooks/useFiatLoan';
import { getTokenSymbol } from '@/lib/utils';
import { getTokenByAddressForChain } from '@/config/contracts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

type Tab = 'borrow_requests' | 'lending_offers';

// Tagged union types for proper type discrimination
type CryptoRequest = LoanRequest & { itemType: 'crypto_request' };
type FiatRequest = FiatLoan & { itemType: 'fiat_request' };
type CryptoOffer = LenderOffer & { itemType: 'crypto_offer' };
type FiatOffer = FiatLenderOffer & { itemType: 'fiat_offer' };

type MarketplaceItem = CryptoRequest | FiatRequest | CryptoOffer | FiatOffer;

const ITEMS_PER_PAGE = 12;
const MAX_ITEMS_TO_FETCH = 50;

// Hook to fetch crypto loan requests directly from contract (newest first)
function useCryptoLoanRequests(chainId: number, addresses: ContractAddresses) {
  // Get total count
  const { data: nextRequestId, refetch: refetchCount, error: errorCount } = useReadContract({
    address: addresses.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanRequestId',
    chainId,
    config: wagmiConfig,
  });

  const totalCount = nextRequestId ? Number(nextRequestId) : 0;
  const count = Math.min(totalCount, MAX_ITEMS_TO_FETCH);

  // Batch fetch newest requests first (from totalCount-1 descending)
  const { data: requestsData, isLoading, refetch: refetchData, error: errorData } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: addresses.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'loanRequests',
      args: [BigInt(totalCount - 1 - i)],
      chainId,
    })),
    config: wagmiConfig,
    query: {
      enabled: count > 0,
    },
  });

  const requests = useMemo(() => {
    if (!requestsData) return [];

    return requestsData
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
          requestData = data as Record<string, unknown>;
        }

        // Filter out empty or non-pending requests
        if (!requestData.borrower || requestData.borrower === '0x0000000000000000000000000000000000000000') {
          return null;
        }
        if (Number(requestData.status) !== LoanRequestStatus.PENDING) {
          return null;
        }

        return {
          requestId: BigInt(totalCount - 1 - index),
          borrower: requestData.borrower as Address,
          collateralAmount: requestData.collateralAmount as bigint,
          collateralToken: requestData.collateralToken as Address,
          borrowAsset: requestData.borrowAsset as Address,
          borrowAmount: requestData.borrowAmount as bigint,
          duration: requestData.duration as bigint,
          maxInterestRate: requestData.maxInterestRate as bigint,
          interestRate: requestData.interestRate as bigint,
          createdAt: requestData.createdAt as bigint,
          expireAt: requestData.expireAt as bigint,
          status: Number(requestData.status) as LoanRequestStatus,
          chainId: (requestData.chainId as bigint) || BigInt(0),
        } as LoanRequest;
      })
      .filter((r): r is LoanRequest => r !== null);
  }, [requestsData, totalCount]);

  const refetch = useCallback(() => {
    refetchCount();
    refetchData();
  }, [refetchCount, refetchData]);

  return { data: requests, isLoading, refetch, error: errorCount || errorData };
}

// Hook to fetch crypto lender offers directly from contract (newest first)
function useCryptoLenderOffers(chainId: number, addresses: ContractAddresses) {
  // Get total count
  const { data: nextOfferId, refetch: refetchCount, error: errorCount } = useReadContract({
    address: addresses.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLenderOfferId',
    chainId,
    config: wagmiConfig,
  });

  const totalCount = nextOfferId ? Number(nextOfferId) : 0;
  const count = Math.min(totalCount, MAX_ITEMS_TO_FETCH);

  // Batch fetch newest offers first (from totalCount-1 descending)
  const { data: offersData, isLoading, refetch: refetchData, error: errorData } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: addresses.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'lenderOffers',
      args: [BigInt(totalCount - 1 - i)],
      chainId,
    })),
    config: wagmiConfig,
    query: {
      enabled: count > 0,
    },
  });

  const offers = useMemo(() => {
    if (!offersData) return [];

    return offersData
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
          offerData = data as Record<string, unknown>;
        }

        // Filter out empty or non-pending offers
        if (!offerData.lender || offerData.lender === '0x0000000000000000000000000000000000000000') {
          return null;
        }
        if (Number(offerData.status) !== LoanRequestStatus.PENDING) {
          return null;
        }

        return {
          offerId: BigInt(totalCount - 1 - index),
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
          status: Number(offerData.status) as LoanRequestStatus,
          chainId: (offerData.chainId as bigint) || BigInt(0),
        } as LenderOffer;
      })
      .filter((o): o is LenderOffer => o !== null);
  }, [offersData, totalCount]);

  const refetch = useCallback(() => {
    refetchCount();
    refetchData();
  }, [refetchCount, refetchData]);

  return { data: offers, isLoading, refetch, error: errorCount || errorData };
}

// Hook to fetch active fiat lender offers — always from Base Sepolia regardless of marketplace chain
function useFiatLenderOffersData() {
  const baseChainId = CHAIN_CONFIG.baseSepolia.id;
  const baseAddresses = getContractAddresses(baseChainId);

  // Get active offer IDs
  const { data: activeIds, isLoading: isLoadingIds, refetch: refetchIds, error: errorIds } = useReadContract({
    address: baseAddresses.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getActiveFiatLenderOffers',
    chainId: baseChainId,
    config: wagmiConfig,
  });

  const offerIds = useMemo(() => (activeIds as bigint[]) || [], [activeIds]);

  // Batch fetch offer details
  const { data: offersData, isLoading: isLoadingOffers, refetch: refetchOffers, error: errorOffers } = useReadContracts({
    contracts: offerIds.map((id) => ({
      address: baseAddresses.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'fiatLenderOffers',
      args: [id],
      chainId: baseChainId,
    })),
    config: wagmiConfig,
    query: {
      enabled: offerIds.length > 0,
    },
  });

  const offers = useMemo(() => {
    if (!offersData) return [];

    return offersData
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
  }, [offersData, offerIds]);

  const refetch = useCallback(() => {
    refetchIds();
    refetchOffers();
  }, [refetchIds, refetchOffers]);

  return { data: offers, isLoading: isLoadingIds || isLoadingOffers, refetch, error: errorIds || errorOffers };
}

// Hook to fetch pending fiat loan requests (borrower requests awaiting supplier) — always from Base Sepolia
function useFiatLoanRequests() {
  const baseChainId = CHAIN_CONFIG.baseSepolia.id;
  const baseAddresses = getContractAddresses(baseChainId);

  // Get pending fiat loan IDs
  const { data: pendingIds, isLoading: isLoadingIds, refetch: refetchIds, error: errorIds } = useReadContract({
    address: baseAddresses.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getPendingFiatLoans',
    chainId: baseChainId,
    config: wagmiConfig,
  });

  const loanIds = useMemo(() => (pendingIds as bigint[]) || [], [pendingIds]);

  // Batch fetch loan details
  const { data: loansData, isLoading: isLoadingLoans, refetch: refetchLoans, error: errorLoans } = useReadContracts({
    contracts: loanIds.map((id) => ({
      address: baseAddresses.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'getFiatLoan',
      args: [id],
      chainId: baseChainId,
    })),
    config: wagmiConfig,
    query: {
      enabled: loanIds.length > 0,
    },
  });

  const loans = useMemo(() => {
    if (!loansData) return [];

    return loansData
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
            exchangeRateAtCreation: arr[17],
            chainId: arr[18],
          };
        } else {
          loanData = data as Record<string, unknown>;
        }

        // Filter out empty or non-pending loans
        if (!loanData.borrower || loanData.borrower === '0x0000000000000000000000000000000000000000') {
          return null;
        }
        if (Number(loanData.status) !== FiatLoanStatus.PENDING_SUPPLIER) {
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
  }, [loansData, loanIds]);

  const refetch = useCallback(() => {
    refetchIds();
    refetchLoans();
  }, [refetchIds, refetchLoans]);

  return { data: loans, isLoading: isLoadingIds || isLoadingLoans, refetch, error: errorIds || errorLoans };
}

function MarketplaceContent() {
  const { address: connectedAddress } = useAccount();

  // Local marketplace chain state — independent from the global NetworkContext / navbar
  // Default to whichever chain the app is currently on
  const [marketplaceNetwork, setMarketplaceNetwork] = useState<AvailableNetwork>(() => {
    const activeId = getActiveChainId();
    return AVAILABLE_NETWORKS.find(n => n.id === activeId) ?? CHAIN_CONFIG.baseSepolia;
  });
  const marketplaceAddresses = useMemo(() => getContractAddresses(marketplaceNetwork.id), [marketplaceNetwork.id]);

  const [activeTab, setActiveTab] = useState<Tab>('borrow_requests');
  const [currentPage, setCurrentPage] = useState(1);
  const [showLoadingTimeout, setShowLoadingTimeout] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    assetType: 'all',
    tokens: [],
    amountRange: { min: 0, max: 1000000 },
    interestRange: { min: 0, max: 100 },
    duration: [],
    sortBy: 'newest',
    crossChain: 'all',
  });

  // Crypto hooks use the marketplace-local chain; fiat hooks always from Base Sepolia
  const { data: cryptoRequests, isLoading: isLoadingCryptoRequests, refetch: refetchCryptoRequests, error: errorCryptoRequests } = useCryptoLoanRequests(marketplaceNetwork.id, marketplaceAddresses);
  const { data: cryptoOffers, isLoading: isLoadingCryptoOffers, refetch: refetchCryptoOffers, error: errorCryptoOffers } = useCryptoLenderOffers(marketplaceNetwork.id, marketplaceAddresses);
  const { data: fiatOffers, isLoading: isLoadingFiatOffers, refetch: refetchFiatOffers, error: errorFiatOffers } = useFiatLenderOffersData();
  const { data: fiatRequests, isLoading: isLoadingFiatRequests, refetch: refetchFiatRequests, error: errorFiatRequests } = useFiatLoanRequests();

  const isLoadingCrypto = isLoadingCryptoRequests || isLoadingCryptoOffers;
  const isLoading = isLoadingCrypto || isLoadingFiatOffers || isLoadingFiatRequests;

  const hasError = errorCryptoRequests || errorCryptoOffers || errorFiatOffers || errorFiatRequests;

  // Set timeout to stop showing loading spinner after 5 seconds
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowLoadingTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowLoadingTimeout(false);
    }
  }, [isLoading]);

  // If loading for too long or has error, treat as loaded with empty data
  const effectivelyLoading = isLoading && !showLoadingTimeout && !hasError;

  const _refetch = useCallback(() => {
    refetchCryptoRequests();
    refetchCryptoOffers();
    refetchFiatOffers();
    refetchFiatRequests();
  }, [refetchCryptoRequests, refetchCryptoOffers, refetchFiatOffers, refetchFiatRequests]);
  void _refetch; // Reserved for refresh button

  // Filter and sort data
  const filteredData = useMemo(() => {
    // Helper: Check if item belongs to connected user
    const isOwnItem = (item: MarketplaceItem): boolean => {
      if (!connectedAddress) return false;
      const normalizedAddress = connectedAddress.toLowerCase();

      if (item.itemType === 'crypto_request' || item.itemType === 'fiat_request') {
        return item.borrower.toLowerCase() === normalizedAddress;
      }
      if (item.itemType === 'crypto_offer' || item.itemType === 'fiat_offer') {
        return item.lender.toLowerCase() === normalizedAddress;
      }
      return false;
    };

    // Show items whose tokens ALL exist on this chain (fundable here).
    // Checks both asset addresses to filter corrupt old data.
    const matchesNetworkFilter = (item: MarketplaceItem): boolean => {
      if (item.itemType === 'fiat_offer' || item.itemType === 'fiat_request') return true;
      if (item.itemType === 'crypto_request') {
        return !!getTokenByAddressForChain(item.borrowAsset, marketplaceNetwork.id)
          && !!getTokenByAddressForChain(item.collateralToken, marketplaceNetwork.id);
      }
      if (item.itemType === 'crypto_offer') {
        const validLend = !!getTokenByAddressForChain(item.lendAsset, marketplaceNetwork.id);
        // address(0) means "any collateral accepted" — always valid
        const validCollateral = item.requiredCollateralAsset === '0x0000000000000000000000000000000000000000'
          || !!getTokenByAddressForChain(item.requiredCollateralAsset, marketplaceNetwork.id);
        return validLend && validCollateral;
      }
      return true;
    };

    const matchesTokenFilter = (item: MarketplaceItem): boolean => {
      if (filters.tokens.length === 0) return true;

      if (item.itemType === 'crypto_request') {
        const symbol = getTokenSymbol(item.borrowAsset);
        return filters.tokens.some(t => symbol.toLowerCase().includes(t.toLowerCase()));
      } else if (item.itemType === 'crypto_offer') {
        const symbol = getTokenSymbol(item.lendAsset);
        return filters.tokens.some(t => symbol.toLowerCase().includes(t.toLowerCase()));
      } else if (item.itemType === 'fiat_offer' || item.itemType === 'fiat_request') {
        return filters.tokens.some(t => item.currency?.toLowerCase().includes(t.toLowerCase()));
      }
      return false;
    };

    const matchesInterestFilter = (item: MarketplaceItem): boolean => {
      const interestRate = Number(item.interestRate) / 100;
      return interestRate >= filters.interestRange.min && interestRate <= filters.interestRange.max;
    };

    const matchesDurationFilter = (item: MarketplaceItem): boolean => {
      if (filters.duration.length === 0) return true;
      const durationDays = Math.ceil(Number(item.duration) / 86400);
      return filters.duration.some(d => {
        const days = parseInt(d);
        return durationDays <= days + 3 && durationDays >= days - 3;
      });
    };

    const matchesCrossChainFilter = (item: MarketplaceItem): boolean => {
      if (filters.crossChain === 'all') return true;
      // Fiat items are always same-chain (Base Sepolia only)
      if (item.itemType === 'fiat_offer' || item.itemType === 'fiat_request') {
        return filters.crossChain === 'same_chain';
      }
      // Determine if the item is cross-chain
      const itemChainId = 'chainId' in item ? Number(item.chainId) : 0;
      const chainIdMismatch = itemChainId !== 0 && itemChainId !== marketplaceNetwork.id;
      // Check if tokens are foreign to the marketplace chain
      let hasForeignTokens = false;
      if (item.itemType === 'crypto_request') {
        hasForeignTokens = !getTokenByAddressForChain(item.borrowAsset, marketplaceNetwork.id)
          || !getTokenByAddressForChain(item.collateralToken, marketplaceNetwork.id);
      } else if (item.itemType === 'crypto_offer') {
        hasForeignTokens = !getTokenByAddressForChain(item.lendAsset, marketplaceNetwork.id)
          || !getTokenByAddressForChain(item.requiredCollateralAsset, marketplaceNetwork.id);
      }
      const isItemCrossChain = chainIdMismatch || hasForeignTokens;
      return filters.crossChain === 'cross_chain' ? isItemCrossChain : !isItemCrossChain;
    };

    const getAmount = (item: MarketplaceItem): number => {
      switch (item.itemType) {
        case 'crypto_request':
          return Number(item.borrowAmount);
        case 'fiat_request':
          return Number(item.fiatAmountCents);
        case 'crypto_offer':
          return Number(item.lendAmount);
        case 'fiat_offer':
          return Number(item.fiatAmountCents);
      }
    };

    let items: MarketplaceItem[] = [];

    if (activeTab === 'borrow_requests') {
      if (filters.assetType === 'all' || filters.assetType === 'crypto') {
        items = [...items, ...cryptoRequests.map(r => ({ ...r, itemType: 'crypto_request' as const }))];
      }
      if (filters.assetType === 'all' || filters.assetType === 'fiat') {
        items = [...items, ...fiatRequests.map(r => ({ ...r, itemType: 'fiat_request' as const }))];
      }
    } else {
      if (filters.assetType === 'all' || filters.assetType === 'crypto') {
        items = [...items, ...cryptoOffers.map(o => ({ ...o, itemType: 'crypto_offer' as const }))];
      }
      if (filters.assetType === 'all' || filters.assetType === 'fiat') {
        items = [...items, ...fiatOffers.map(o => ({ ...o, itemType: 'fiat_offer' as const }))];
      }
    }

    // Apply filters: exclude own items, then apply user filters
    items = items
      .filter(item => !isOwnItem(item))
      .filter(matchesNetworkFilter)
      .filter(matchesCrossChainFilter)
      .filter(matchesTokenFilter)
      .filter(matchesInterestFilter)
      .filter(matchesDurationFilter);

    // Sort
    switch (filters.sortBy) {
      case 'newest':
        items.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        break;
      case 'lowest_interest':
        items.sort((a, b) => Number(a.interestRate) - Number(b.interestRate));
        break;
      case 'highest_interest':
        items.sort((a, b) => Number(b.interestRate) - Number(a.interestRate));
        break;
      case 'amount_high':
        items.sort((a, b) => getAmount(b) - getAmount(a));
        break;
      case 'amount_low':
        items.sort((a, b) => getAmount(a) - getAmount(b));
        break;
    }

    return items;
  }, [activeTab, cryptoRequests, fiatRequests, cryptoOffers, fiatOffers, filters, connectedAddress, marketplaceNetwork]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters or tab change
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Get counts for tabs — filter by token existence + own-item exclusion so counts match displayed items
  const borrowRequestsCount = useMemo(() => {
    let count = 0;
    if (filters.assetType === 'all' || filters.assetType === 'crypto') {
      count += cryptoRequests.filter(r => {
        if (connectedAddress && r.borrower.toLowerCase() === connectedAddress.toLowerCase()) return false;
        return !!getTokenByAddressForChain(r.borrowAsset, marketplaceNetwork.id)
          && !!getTokenByAddressForChain(r.collateralToken, marketplaceNetwork.id);
      }).length;
    }
    if (filters.assetType === 'all' || filters.assetType === 'fiat') {
      count += fiatRequests.filter(r =>
        !(connectedAddress && r.borrower.toLowerCase() === connectedAddress.toLowerCase())
      ).length;
    }
    return count;
  }, [cryptoRequests, fiatRequests, filters.assetType, connectedAddress, marketplaceNetwork]);

  const lendingOffersCount = useMemo(() => {
    let count = 0;
    if (filters.assetType === 'all' || filters.assetType === 'crypto') {
      count += cryptoOffers.filter(o => {
        if (connectedAddress && o.lender.toLowerCase() === connectedAddress.toLowerCase()) return false;
        const validLend = !!getTokenByAddressForChain(o.lendAsset, marketplaceNetwork.id);
        const validCollateral = o.requiredCollateralAsset === '0x0000000000000000000000000000000000000000'
          || !!getTokenByAddressForChain(o.requiredCollateralAsset, marketplaceNetwork.id);
        return validLend && validCollateral;
      }).length;
    }
    if (filters.assetType === 'all' || filters.assetType === 'fiat') {
      count += fiatOffers.filter(o =>
        !(connectedAddress && o.lender.toLowerCase() === connectedAddress.toLowerCase())
      ).length;
    }
    return count;
  }, [cryptoOffers, fiatOffers, filters.assetType, connectedAddress, marketplaceNetwork]);

  // Render item based on type
  const renderItem = (item: MarketplaceItem, index: number) => {
    switch (item.itemType) {
      case 'crypto_request':
        return (
          <CryptoBorrowRequestCard
            key={`crypto-request-${item.requestId}`}
            request={item}
            index={index}
            chainId={marketplaceNetwork.id}
          />
        );
      case 'fiat_request':
        return (
          <FiatBorrowRequestCard
            key={`fiat-request-${item.loanId}`}
            request={item}
            index={index}
          />
        );
      case 'crypto_offer':
        return (
          <CryptoLendingOfferCard
            key={`crypto-offer-${item.offerId}`}
            offer={item}
            index={index}
            chainId={marketplaceNetwork.id}
          />
        );
      case 'fiat_offer':
        return (
          <FiatLendingOfferCard
            offer={item}
            index={index}
          />
        );
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-3xl sm:text-4xl font-bold">
              <span className="gradient-text">Marketplace</span>
            </h1>
            <div className="hidden sm:block">
              <MarketplaceNetworkSwitcher
                selectedNetwork={marketplaceNetwork}
                onNetworkChange={setMarketplaceNetwork}
              />
            </div>
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              loading={isLoading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button> */}
          </div>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Browse loan requests and lending offers. Find the perfect match for your needs.
          </p>
          {/* Mobile network switcher */}
          <div className="sm:hidden mt-4">
            <MarketplaceNetworkSwitcher
              selectedNetwork={marketplaceNetwork}
              onNetworkChange={setMarketplaceNetwork}
            />
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8 overflow-x-auto"
        >
          <div className="flex rounded-2xl p-1.5 bg-white/5 border border-white/10 flex-shrink-0">
            <button
              onClick={() => handleTabChange('borrow_requests')}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                activeTab === 'borrow_requests'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              Loan Requests
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs',
                activeTab === 'borrow_requests'
                  ? 'bg-white/20'
                  : 'bg-white/10'
              )}>
                {borrowRequestsCount}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('lending_offers')}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                activeTab === 'lending_offers'
                  ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <HandCoins className="w-4 h-4 flex-shrink-0" />
              Instant offers
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs',
                activeTab === 'lending_offers'
                  ? 'bg-white/20'
                  : 'bg-white/10'
              )}>
                {lendingOffersCount}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          resultCount={filteredData.length}
        />


        {/* Error or Loading Timeout Message */}
        {(hasError || showLoadingTimeout) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl bg-orange-500/10 border border-orange-500/20 text-sm text-orange-400"
          >
            <Info className="w-4 h-4 flex-shrink-0" />
            <p>
              {hasError
                ? 'Unable to load marketplace data. Please check your network connection and try refreshing.'
                : 'Data is taking longer than usual to load. Showing available results...'
              }
            </p>
          </motion.div>
        )}

        {/* Info Message */}
        {connectedAddress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400"
          >
            <Info className="w-4 h-4 flex-shrink-0 text-primary-400" />
            <p>
              Your own {activeTab === 'borrow_requests' ? 'requests' : 'offers'} are hidden.{' '}
              <Link href="/dashboard" className="text-primary-400 hover:text-primary-300 underline underline-offset-2">
                View your listings in Dashboard
              </Link>
            </p>
          </motion.div>
        )}

        {/* Fiat info bar — only show when marketplace is viewing a non-Base chain */}
        {marketplaceNetwork.id !== CHAIN_CONFIG.baseSepolia.id && (filters.assetType === 'all' || filters.assetType === 'fiat') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400"
          >
            <Info className="w-4 h-4 flex-shrink-0" />
            <p>Fiat offers are sourced from Base Sepolia regardless of the selected network.</p>
          </motion.div>
        )}

        {/* Listings Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ListingsGrid
              isLoading={effectivelyLoading}
              isEmpty={paginatedData.length === 0}
              emptyTitle={
                activeTab === 'borrow_requests'
                  ? 'No borrow requests found'
                  : 'No lending offers found'
              }
              emptyDescription={
                activeTab === 'borrow_requests'
                  ? 'There are no active borrow requests matching your criteria. Try adjusting your filters or create your own request.'
                  : 'There are no active lending offers matching your criteria. Try adjusting your filters or create your own offer.'
              }
              emptyAction={
                activeTab === 'borrow_requests'
                  ? { label: 'Create Borrow Request', href: '/borrow' }
                  : { label: 'Create Lending Offer', href: '/lend' }
              }
            >
              {paginatedData.map((item, index) => renderItem(item, index))}
            </ListingsGrid>
          </motion.div>
        </AnimatePresence>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="glass-card p-8 rounded-2xl max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-2">
              {activeTab === 'borrow_requests'
                ? "Ready to fund a loan?"
                : "Looking to borrow?"}
            </h3>
            <p className="text-gray-400 mb-6">
              {activeTab === 'borrow_requests'
                ? "Browse the requests above or create your own lending offer to earn interest on your crypto."
                : "Browse the offers above or create your own borrow request to get the funds you need."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={activeTab === 'borrow_requests' ? '/lend' : '/borrow'}>
                <Button variant="primary" size="lg">
                  {activeTab === 'borrow_requests' ? 'Create Lending Offer' : 'Create Borrow Request'}
                </Button>
              </Link>
              <Link href={activeTab === 'borrow_requests' ? '/borrow' : '/lend'}>
                <Button variant="secondary" size="lg">
                  {activeTab === 'borrow_requests' ? 'Create Borrow Request' : 'Create Lending Offer'}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Skeleton for Suspense fallback
function PageSkeleton() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header skeleton */}
        <div className="text-center mb-8">
          <div className="h-10 w-48 bg-white/10 rounded mx-auto mb-4 animate-pulse" />
          <div className="h-4 w-96 max-w-full bg-white/10 rounded mx-auto animate-pulse" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex justify-center mb-8">
          <div className="h-12 w-80 bg-white/10 rounded-2xl animate-pulse" />
        </div>

        {/* Filter bar skeleton */}
        <div className="h-16 bg-white/5 rounded-xl mb-6 animate-pulse" />

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-6 rounded-2xl animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/10" />
                  <div className="h-4 w-16 bg-white/10 rounded" />
                </div>
                <div className="h-5 w-20 bg-white/10 rounded-full" />
              </div>
              <div className="mb-4">
                <div className="h-3 w-20 bg-white/10 rounded mb-2" />
                <div className="h-6 w-32 bg-white/10 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="h-3 w-16 bg-white/10 rounded mb-2" />
                  <div className="h-5 w-20 bg-white/10 rounded" />
                </div>
                <div>
                  <div className="h-3 w-16 bg-white/10 rounded mb-2" />
                  <div className="h-5 w-20 bg-white/10 rounded" />
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg mb-4">
                <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                <div className="h-5 w-28 bg-white/10 rounded" />
              </div>
              <div className="h-10 w-full bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MarketplaceV2Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketplaceContent />
    </Suspense>
  );
}
