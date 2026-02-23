'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { Address, Abi, formatUnits } from 'viem';
import { useEffect, useCallback } from 'react';
import { CONTRACT_ADDRESSES, getTokenByAddress, TOKEN_LIST, getActiveChainId, getContractAddresses, CONTRACT_ADDRESSES_BY_CHAIN } from '@/config/contracts';
import { useContractStore } from '@/stores/contractStore';
import { LoanRequest, LenderOffer, Loan } from '@/types';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import ConfigurationABIJson from '@/contracts/ConfigurationABI.json';
import LTVConfigABIJson from '@/contracts/LTVConfigABI.json';
import ERC20ABIJson from '@/contracts/ERC20ABI.json';

// Cast ABIs to proper Abi type for use with wagmi hooks
const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
const ConfigurationABI = ConfigurationABIJson as Abi;
const LTVConfigABI = LTVConfigABIJson as Abi;
const ERC20ABI = ERC20ABIJson as Abi;

// Read loan request by ID
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

// Read loan request by ID across ALL configured chains.
// Returns the first valid result (non-zero borrower) and the chainId it was found on.
// Prioritises the active chain so same-chain requests resolve instantly.
export function useLoanRequestMultiChain(requestId: bigint | undefined) {
  const activeChainId = getActiveChainId();

  // Build one read call per chain that has a non-zero marketplace address
  const ZERO = '0x0000000000000000000000000000000000000000';
  const chainIds = Object.keys(CONTRACT_ADDRESSES_BY_CHAIN).map(Number);
  const validChains = chainIds.filter((cid) => {
    const addrs = getContractAddresses(cid);
    return addrs.loanMarketPlace && addrs.loanMarketPlace !== ZERO;
  });

  // Put active chain first so it gets priority
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

  // Find first valid (non-zero borrower) result
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

// Read lender offer by ID
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

// Read loan by ID
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

// Get loan health factor
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

// Calculate repayment amount (total debt = principal + interest)
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

// Get outstanding debt (remaining debt = total debt - amount already repaid)
// Use this for repayment UI to show what's actually owed
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

// Get next loan request ID (for counting)
export function useNextLoanRequestId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanRequestId',
    chainId: getActiveChainId(),
  });
}

// Get next lender offer ID
export function useNextLenderOfferId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLenderOfferId',
    chainId: getActiveChainId(),
  });
}

// Get next loan ID
export function useNextLoanId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanId',
    chainId: getActiveChainId(),
  });
}

// Get user's loan requests
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

// Get borrower's loans
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

// Get lender's loans
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

// Configuration reads
export function useGracePeriod() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'gracePeriod',
    chainId: getActiveChainId(),
  });
}

export function useMinCollateralRatio() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'minCollateralRatio',
    chainId: getActiveChainId(),
  });
}

export function useMaxInterestRate() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'maxInterestRate',
    chainId: getActiveChainId(),
  });
}

// Get minimum repayment amount (in USD with 8 decimals, e.g., 1e8 = $1)
export function useMinRepaymentAmount() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'minRepaymentAmount',
    chainId: getActiveChainId(),
  });
}

// Get comprehensive repayment info from contract
// This is the recommended way to get all repayment-related data
export function useRepaymentInfo(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'getRepaymentInfo',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Get minimum repayment in token units from contract
// This handles the USD to token conversion properly with correct decimals
export function useMinRepaymentInTokens(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'getMinRepaymentInTokens',
    args: loanId !== undefined ? [loanId] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Get platform fee rate (in basis points, e.g., 100 = 1%)
export function usePlatformFeeRate() {
  const result = useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'platformFeeRate',
    chainId: getActiveChainId(),
  });

  // Convert basis points to percentage for display
  const feeRateBps = result.data ? Number(result.data) : 0;
  const feeRatePercent = feeRateBps / 100; // 100 bps = 1%

  return {
    ...result,
    feeRateBps,
    feeRatePercent,
  };
}

// Get minimum loan duration (in seconds)
export function useMinLoanDuration() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'minLoanDuration',
    chainId: getActiveChainId(),
  });
}

// Get maximum loan duration (in seconds)
export function useMaxLoanDuration() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'maxLoanDuration',
    chainId: getActiveChainId(),
  });
}

// Combined hook for loan configuration limits
// Returns interest rate and duration constraints from the Configuration contract
export function useLoanConfigLimits() {
  const { data: maxInterestRateData, isLoading: loadingInterest } = useMaxInterestRate();
  const { data: minDurationData, isLoading: loadingMinDuration } = useMinLoanDuration();
  const { data: maxDurationData, isLoading: loadingMaxDuration } = useMaxLoanDuration();

  const isLoading = loadingInterest || loadingMinDuration || loadingMaxDuration;

  // Interest rate is in basis points (100 = 1%, 10000 = 100%)
  // Minimum is > 0, so effectively 1 bps (0.01%)
  const minInterestRate = 1; // 0.01% - contract requires > 0
  const maxInterestRate = maxInterestRateData ? Number(maxInterestRateData) : 10000; // Default 100%

  // Duration is in seconds
  const minDurationSeconds = minDurationData ? Number(minDurationData) : 86400; // Default 1 day
  const maxDurationSeconds = maxDurationData ? Number(maxDurationData) : 31536000; // Default 365 days

  // Convert to days for easier use
  const minDurationDays = Math.ceil(minDurationSeconds / 86400);
  const maxDurationDays = Math.floor(maxDurationSeconds / 86400);

  // Convert to percentage for display
  const minInterestPercent = minInterestRate / 100; // 0.01%
  const maxInterestPercent = maxInterestRate / 100; // 100%

  return {
    isLoading,
    // Interest rate in basis points
    minInterestRate,
    maxInterestRate,
    // Interest rate as percentage
    minInterestPercent,
    maxInterestPercent,
    // Duration in seconds
    minDurationSeconds,
    maxDurationSeconds,
    // Duration in days
    minDurationDays,
    maxDurationDays,
  };
}

// Check if a single asset is supported
export function useIsAssetSupported(assetAddress: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'isAssetSupported',
    args: assetAddress ? [assetAddress] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!assetAddress,
    },
  });
}

// Batch check which assets are supported from TOKEN_LIST
export function useSupportedAssets() {
  const { data: supportedData, isLoading, isError, refetch } = useReadContracts({
    contracts: TOKEN_LIST.map((token) => ({
      address: CONTRACT_ADDRESSES.configuration,
      abi: ConfigurationABI,
      functionName: 'isAssetSupported',
      args: [token.address],
      chainId: getActiveChainId(),
    })),
    query: {
      enabled: true,
    },
  });

  // Filter tokens that are supported
  const supportedTokens = TOKEN_LIST.filter((token, index) => {
    const result = supportedData?.[index];
    return result?.status === 'success' && result.result === true;
  });

  return {
    supportedTokens,
    isLoading,
    isError,
    refetch,
  };
}

// LTV Config reads
export function useLTV(collateralAsset: Address | undefined, durationDays: number | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ltvConfig,
    abi: LTVConfigABI,
    functionName: 'getLTV',
    args: collateralAsset && durationDays !== undefined ? [collateralAsset, BigInt(durationDays)] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!collateralAsset && durationDays !== undefined,
    },
  });
}

export function useLiquidationThreshold(collateralAsset: Address | undefined, durationDays: number | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ltvConfig,
    abi: LTVConfigABI,
    functionName: 'getLiquidationThreshold',
    args: collateralAsset && durationDays !== undefined ? [collateralAsset, BigInt(durationDays)] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!collateralAsset && durationDays !== undefined,
    },
  });
}

export function useMaxLoanAmount(
  collateralAsset: Address | undefined,
  collateralAmount: bigint | undefined,
  collateralPriceUSD: bigint | undefined,
  loanDurationDays: number | undefined
) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ltvConfig,
    abi: LTVConfigABI,
    functionName: 'getMaxLoanAmount',
    args: collateralAsset && collateralAmount && collateralPriceUSD && loanDurationDays !== undefined
      ? [collateralAsset, collateralAmount, collateralPriceUSD, BigInt(loanDurationDays)]
      : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!collateralAsset && !!collateralAmount && !!collateralPriceUSD && loanDurationDays !== undefined,
    },
  });
}

export function useHealthFactor(
  collateralAsset: Address | undefined,
  collateralAmount: bigint | undefined,
  collateralPriceUSD: bigint | undefined,
  loanAmountUSD: bigint | undefined,
  loanDurationDays: number | undefined
) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ltvConfig,
    abi: LTVConfigABI,
    functionName: 'getHealthFactor',
    args: collateralAsset && collateralAmount && collateralPriceUSD && loanAmountUSD && loanDurationDays !== undefined
      ? [collateralAsset, collateralAmount, collateralPriceUSD, loanAmountUSD, BigInt(loanDurationDays)]
      : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!collateralAsset && !!collateralAmount && !!collateralPriceUSD && !!loanAmountUSD && loanDurationDays !== undefined,
    },
  });
}

export function useAssetLTVData(asset: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ltvConfig,
    abi: LTVConfigABI,
    functionName: 'getAssetData',
    args: asset ? [asset] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!asset,
    },
  });
}

// MockV3Aggregator ABI for updating prices on testnet
const MockV3AggregatorABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestAnswer',
    outputs: [{ name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_answer', type: 'int256' }],
    name: 'updateAnswer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function useTokenPrice(tokenAddress: Address | undefined, chainId?: number) {
  const effectiveChainId = chainId ?? getActiveChainId();
  const configAddress = chainId ? getContractAddresses(chainId).configuration : CONTRACT_ADDRESSES.configuration;

  const setTokenPrice = useContractStore((state) => state.setTokenPrice);
  const storedPrice = useContractStore((state) =>
    tokenAddress ? state.tokenPrices[tokenAddress.toLowerCase()] : undefined
  );

  const priceFeedAddress = useReadContract({
    address: configAddress,
    abi: ConfigurationABI,
    functionName: 'priceFeeds',
    args: tokenAddress ? [tokenAddress] : undefined,
    chainId: effectiveChainId,
    query: {
      enabled: !!tokenAddress,
    },
  });

  const priceData = useReadContract({
    address: priceFeedAddress.data as Address,
    abi: MockV3AggregatorABI,
    functionName: 'latestRoundData',
    chainId: effectiveChainId,
    query: {
      enabled: !!priceFeedAddress.data && priceFeedAddress.data !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Extract price and updatedAt from response
  const priceDataTuple = priceData.data as readonly unknown[] | undefined;
  const contractPrice = priceDataTuple ? priceDataTuple[1] as bigint : undefined;
  const contractUpdatedAt = priceDataTuple ? Number(priceDataTuple[3]) : undefined;

  // Update store when we get new data from contract
  useEffect(() => {
    if (tokenAddress && contractPrice !== undefined && contractUpdatedAt !== undefined && priceFeedAddress.data) {
      const storedData = storedPrice;
      // Only update if we have newer data
      if (!storedData || contractUpdatedAt > storedData.updatedAt) {
        setTokenPrice(tokenAddress, contractPrice, contractUpdatedAt, priceFeedAddress.data as Address);
      }
    }
  }, [tokenAddress, contractPrice, contractUpdatedAt, priceFeedAddress.data, setTokenPrice, storedPrice]);

  // Use store price if it's newer than contract data, otherwise use contract data
  const price = storedPrice && contractUpdatedAt && storedPrice.updatedAt > contractUpdatedAt
    ? storedPrice.price
    : contractPrice ?? storedPrice?.price;
  const updatedAt = storedPrice && contractUpdatedAt && storedPrice.updatedAt > contractUpdatedAt
    ? storedPrice.updatedAt
    : contractUpdatedAt ?? storedPrice?.updatedAt;

  // Check if price is stale (>15 minutes old) - matches contract requirement
  const STALENESS_THRESHOLD = 15 * 60; // 15 minutes in seconds
  const currentTime = Math.floor(Date.now() / 1000);
  const isStale = updatedAt ? (currentTime - updatedAt) > STALENESS_THRESHOLD : false;
  const secondsUntilStale = updatedAt ? Math.max(0, STALENESS_THRESHOLD - (currentTime - updatedAt)) : 0;

  return {
    ...priceData,
    price,
    updatedAt,
    isStale,
    secondsUntilStale,
    priceFeedAddress: priceFeedAddress.data,
    refetch: priceData.refetch,
  };
}

// Hook to refresh mock price feed on testnet
// This calls updateAnswer with the current price to refresh the timestamp
export function useRefreshMockPrice() {
  const { writeContractAsync, isPending, error } = useWriteContract();
  const setTokenPrice = useContractStore((state) => state.setTokenPrice);

  const refreshPrice = async (priceFeedAddress: Address, currentPrice: bigint, tokenAddress?: Address) => {
    const result = await writeContractAsync({
      address: priceFeedAddress,
      abi: MockV3AggregatorABI,
      functionName: 'updateAnswer',
      args: [currentPrice],
    });

    // Update the store immediately with the new timestamp
    if (tokenAddress) {
      const newTimestamp = Math.floor(Date.now() / 1000);
      setTokenPrice(tokenAddress, currentPrice, newTimestamp, priceFeedAddress);
    }

    return result;
  };

  return { refreshPrice, isPending, error };
}

// Token balance
export function useTokenBalance(tokenAddress: Address | undefined, userAddress: Address | undefined, chainId?: number) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: chainId ?? getActiveChainId(),
    query: {
      enabled: !!tokenAddress && !!userAddress,
    },
  });
}

// Token allowance
export function useTokenAllowance(
  tokenAddress: Address | undefined,
  ownerAddress: Address | undefined,
  spenderAddress: Address | undefined,
  chainId?: number
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    chainId: chainId ?? getActiveChainId(),
    query: {
      enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
    },
  });
}

// Minimal ABI for CollateralEscrow read operations
const CollateralEscrowReadABI = [
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'loanCollateralAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'loanCollateralToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'loanDepositor',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'isCryptoLoan',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'loanId', type: 'uint256' }],
    name: 'getCollateralInfo',
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'depositor', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Read escrow collateral amount for a loan
export function useEscrowCollateralAmount(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.collateralEscrow,
    abi: CollateralEscrowReadABI,
    functionName: 'loanCollateralAmount',
    args: loanId !== undefined ? [loanId] : undefined,
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Read full escrow collateral info for a loan
export function useEscrowCollateralInfo(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.collateralEscrow,
    abi: CollateralEscrowReadABI,
    functionName: 'getCollateralInfo',
    args: loanId !== undefined ? [loanId] : undefined,
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Write hooks
export function useApproveToken() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const publicClient = usePublicClient();

  // Simulate approval before executing to catch errors early
  const simulateApprove = async (
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    account: Address
  ): Promise<{ success: boolean; error?: string }> => {
    if (!publicClient) {
      return { success: false, error: 'Public client not available' };
    }

    try {
      await publicClient.simulateContract({
        address: tokenAddress,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
        account,
      });
      return { success: true };
    } catch (err: unknown) {
      const error = err as Error & { shortMessage?: string; cause?: { reason?: string } };
      let errorMessage = 'Approval simulation failed';
      if (error.shortMessage) {
        errorMessage = error.shortMessage;
      } else if (error.cause?.reason) {
        errorMessage = error.cause.reason;
      } else if (error.message) {
        errorMessage = error.message.slice(0, 200);
      }
      return { success: false, error: errorMessage };
    }
  };

  // Fire-and-forget version (for backward compatibility)
  const approve = (tokenAddress: Address, spenderAddress: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spenderAddress, amount],
    });
  };

  // Async version that returns the transaction hash
  const approveAsync = async (tokenAddress: Address, spenderAddress: Address, amount: bigint) => {
    return await writeContractAsync({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spenderAddress, amount],
    });
  };

  return { approve, approveAsync, simulateApprove, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createRequest = async (
    collateralToken: Address,
    collateralAmount: bigint,
    borrowAsset: Address,
    borrowAmount: bigint,
    interestRate: bigint,
    duration: bigint
  ) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'createLoanRequest',
      args: [collateralToken, collateralAmount, borrowAsset, borrowAmount, interestRate, duration],
    });
  };

  return { createRequest, hash, isPending, isConfirming, isSuccess, error };
}

export function useFundLoanRequest() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const fundRequest = (requestId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'fundLoanRequest',
      args: [requestId],
    });
  };

  const fundRequestAsync = async (requestId: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'fundLoanRequest',
      args: [requestId],
    });
  };

  return { fundRequest, fundRequestAsync, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateLenderOffer() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const publicClient = usePublicClient();

  // Simulate before executing to catch errors early
  const simulateCreateOffer = async (
    lendAsset: Address,
    lendAmount: bigint,
    requiredCollateralAsset: Address,
    minCollateralAmount: bigint,
    interestRate: bigint,
    duration: bigint,
    account: Address
  ): Promise<{ success: boolean; error?: string }> => {
    if (!publicClient) {
      return { success: false, error: 'Public client not available' };
    }

    try {
      await publicClient.simulateContract({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'createLenderOffer',
        args: [lendAsset, lendAmount, requiredCollateralAsset, minCollateralAmount, interestRate, duration],
        account,
      });
      return { success: true };
    } catch (err: unknown) {
      const error = err as Error & { shortMessage?: string; cause?: { reason?: string } };
      let errorMessage = 'Transaction simulation failed';
      if (error.shortMessage) {
        errorMessage = error.shortMessage;
      } else if (error.cause?.reason) {
        errorMessage = error.cause.reason;
      } else if (error.message) {
        errorMessage = error.message.slice(0, 200);
      }
      return { success: false, error: errorMessage };
    }
  };

  // Fire-and-forget version
  const createOffer = (
    lendAsset: Address,
    lendAmount: bigint,
    requiredCollateralAsset: Address,
    minCollateralAmount: bigint,
    interestRate: bigint,
    duration: bigint
  ) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'createLenderOffer',
      args: [lendAsset, lendAmount, requiredCollateralAsset, minCollateralAmount, interestRate, duration],
    });
  };

  // Async version that returns the transaction hash
  const createOfferAsync = async (
    lendAsset: Address,
    lendAmount: bigint,
    requiredCollateralAsset: Address,
    minCollateralAmount: bigint,
    interestRate: bigint,
    duration: bigint
  ) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'createLenderOffer',
      args: [lendAsset, lendAmount, requiredCollateralAsset, minCollateralAmount, interestRate, duration],
    });
  };

  return { createOffer, createOfferAsync, simulateCreateOffer, hash, isPending, isConfirming, isSuccess, error };
}

export function useAcceptLenderOffer() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Fire-and-forget version (for backward compatibility)
  const acceptOffer = (offerId: bigint, collateralAsset: `0x${string}`, collateralAmount: bigint, borrowAmount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'acceptLenderOffer',
      args: [offerId, collateralAsset, collateralAmount, borrowAmount],
    });
  };

  // Async version that returns the transaction hash
  const acceptOfferAsync = async (offerId: bigint, collateralAsset: `0x${string}`, collateralAmount: bigint, borrowAmount: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'acceptLenderOffer',
      args: [offerId, collateralAsset, collateralAmount, borrowAmount],
    });
  };

  return { acceptOffer, acceptOfferAsync, hash, isPending, isConfirming, isSuccess, error };
}

export function useRepayLoan() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Fire-and-forget version (for backward compatibility)
  const repay = (loanId: bigint, amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'repayLoan',
      args: [loanId, amount],
    });
  };

  // Async version that returns the transaction hash
  const repayAsync = async (loanId: bigint, amount: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'repayLoan',
      args: [loanId, amount],
    });
  };

  return { repay, repayAsync, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelLoanRequest() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelRequest = (requestId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'cancelLoanRequest',
      args: [requestId],
    });
  };

  return { cancelRequest, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelLenderOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelOffer = (offerId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'cancelLenderOffer',
      args: [offerId],
    });
  };

  return { cancelOffer, hash, isPending, isConfirming, isSuccess, error };
}

export function useRequestExtension() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const requestExtension = (loanId: bigint, additionalDuration: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'requestLoanExtension',
      args: [loanId, additionalDuration],
    });
  };

  return { requestExtension, hash, isPending, isConfirming, isSuccess, error };
}

export function useApproveExtension() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approveExtension = (loanId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'approveLoanExtension',
      args: [loanId],
    });
  };

  return { approveExtension, hash, isPending, isConfirming, isSuccess, error };
}

export function useLiquidateLoan() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const liquidate = (loanId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'liquidateLoan',
      args: [loanId],
    });
  };

  return { liquidate, hash, isPending, isConfirming, isSuccess, error };
}

// Batch fetch loan requests using multicall
export function useBatchLoanRequests(startId: number, count: number) {
  const setLoanRequests = useContractStore((state) => state.setLoanRequests);
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

      // Contract returns tuple array, not object
      const data = result.result;

      // Check if data is array (tuple) or object
      const isArray = Array.isArray(data);

      // Map based on actual ABI structure from DataTypes.LoanRequest
      // Order: requestId, borrower, collateralAmount, collateralToken, borrowAsset,
      //        borrowAmount, duration, maxInterestRate, interestRate, createdAt,
      //        expireAt, status, chainId
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

      // Filter out empty requests (zero address)
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

  // Update store when data loads
  useEffect(() => {
    if (requests.length > 0) {
      setLoanRequests(requests as LoanRequest[]);
    }
  }, [requests, setLoanRequests]);

  return { data: requests, isLoading, isError, refetch };
}

// Batch fetch lender offers using multicall
export function useBatchLenderOffers(startId: number, count: number) {
  const setLenderOffers = useContractStore((state) => state.setLenderOffers);
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

      // Map based on actual ABI structure from DataTypes.LenderOffer
      // Order: offerId, lender, lendAsset, lendAmount, remainingAmount, borrowedAmount,
      //        requiredCollateralAsset, minCollateralAmount, duration, interestRate,
      //        createdAt, expireAt, status, chainId
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

      // Filter out empty offers (zero address)
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

  // Update store when data loads
  useEffect(() => {
    if (offers.length > 0) {
      setLenderOffers(offers as LenderOffer[]);
    }
  }, [offers, setLenderOffers]);

  return { data: offers, isLoading, isError, refetch };
}

// Batch fetch loans using multicall
export function useBatchLoans(startId: number, count: number) {
  const setLoans = useContractStore((state) => state.setLoans);
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

      // Map based on actual ABI structure from DataTypes.Loan
      // Order: loanId, requestId, borrower, lender, collateralAsset, collateralAmount,
      //        collateralReleased, borrowAsset, principalAmount, interestRate, duration,
      //        startTime, dueDate, amountRepaid, status, lastInterestUpdate, gracePeriodEnd,
      //        isCrossChain, sourceChainId, targetChainId, remoteChainLoanId
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

      // Filter out empty loans (zero address or NULL status)
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

  // Update store when data loads
  useEffect(() => {
    if (loans.length > 0) {
      setLoans(loans as Loan[]);
    }
  }, [loans, setLoans]);

  return { data: loans, isLoading, isError, refetch };
}

// Approximate USD prices for testnet tokens (for display purposes)
// In production, these would come from price feeds
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

// Get approximate USD price for a token
function getApproxUSDPrice(tokenSymbol: string | undefined): number {
  if (!tokenSymbol) return 1;
  return APPROX_USD_PRICES[tokenSymbol] || 1;
}

// Platform Statistics - aggregates data from multiple contract calls using efficient multicall
export function usePlatformStats() {
  const { data: nextLoanId } = useNextLoanId();

  // Calculate total loans and batch size
  const maxLoansToCheck = 100;
  const totalLoans = nextLoanId ? Number(nextLoanId) - 1 : 0;
  const loansToFetch = Math.min(totalLoans, maxLoansToCheck);

  // Fetch all loans using efficient multicall
  const { data: loans, isLoading, isError } = useBatchLoans(1, loansToFetch);

  // Calculate stats from loan data
  // Use numbers for formatted values in USD
  const stats = {
    totalLoans,
    activeLoans: 0,
    totalBorrowedUSD: 0, // Total borrowed converted to USD
    totalCollateralUSD: 0, // Total collateral value in USD (TVL)
    uniqueBorrowers: new Set<Address>(),
    uniqueLenders: new Set<Address>(),
  };

  (loans || []).forEach((loan) => {
    // Get token info for proper decimal handling
    const borrowToken = getTokenByAddress(loan.borrowAsset as Address);
    const collateralToken = getTokenByAddress(loan.collateralAsset as Address);
    const borrowDecimals = borrowToken?.decimals || 18;
    const collateralDecimals = collateralToken?.decimals || 18;

    // Get USD prices for conversion
    const borrowPriceUSD = getApproxUSDPrice(borrowToken?.symbol);
    const collateralPriceUSD = getApproxUSDPrice(collateralToken?.symbol);

    // LoanStatus: NULL=0, ACTIVE=1, REPAID=2, LIQUIDATED=3, DEFAULTED=4
    if (loan.status === 1) { // ACTIVE
      stats.activeLoans++;
      // For TVL, we only count active loans' collateral converted to USD
      const collateralFormatted = Number(formatUnits(loan.collateralAmount as bigint, collateralDecimals));
      stats.totalCollateralUSD += collateralFormatted * collateralPriceUSD;
    }

    // Count all non-null loans for total borrowed, converted to USD
    const borrowedFormatted = Number(formatUnits(loan.principalAmount as bigint, borrowDecimals));
    stats.totalBorrowedUSD += borrowedFormatted * borrowPriceUSD;

    // Track unique users
    stats.uniqueBorrowers.add(loan.borrower as Address);
    stats.uniqueLenders.add(loan.lender as Address);
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

// Fetch user's loan requests - filters from all requests
export function useUserLoanRequestsBatch(userAddress: Address | undefined) {
  const { data: nextRequestId, isLoading: isLoadingCount } = useNextLoanRequestId();
  const requestCount = nextRequestId ? Number(nextRequestId) : 0;

  const { data: allRequests, isLoading: isLoadingRequests, isError, refetch } = useBatchLoanRequests(0, Math.min(requestCount, 50));

  // Filter for user's requests
  const userRequests = (allRequests || []).filter((r) =>
    userAddress && r.borrower.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userRequests,
    isLoading: isLoadingCount || isLoadingRequests,
    isError,
    refetch
  };
}

// Fetch user's lender offers - filters from all offers
export function useUserLenderOffersBatch(userAddress: Address | undefined) {
  const { data: nextOfferId, isLoading: isLoadingCount } = useNextLenderOfferId();
  const offerCount = nextOfferId ? Number(nextOfferId) : 0;

  const { data: allOffers, isLoading: isLoadingOffers, isError, refetch } = useBatchLenderOffers(0, Math.min(offerCount, 50));

  // Filter for user's offers
  const userOffers = (allOffers || []).filter((o) =>
    userAddress && o.lender.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userOffers,
    isLoading: isLoadingCount || isLoadingOffers,
    isError,
    refetch
  };
}

// Fetch user's borrowed loans (where user is borrower)
export function useUserBorrowedLoans(userAddress: Address | undefined) {
  const { data: nextLoanId, isLoading: isLoadingCount } = useNextLoanId();
  const loanCount = nextLoanId ? Number(nextLoanId) : 0;

  const { data: allLoans, isLoading: isLoadingLoans, isError, refetch } = useBatchLoans(0, Math.min(loanCount, 50));

  // Filter for user's borrowed loans
  const userLoans = (allLoans || []).filter((l) =>
    userAddress && l.borrower.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userLoans,
    isLoading: isLoadingCount || isLoadingLoans,
    isError,
    refetch
  };
}

// Fetch user's lent loans (where user is lender)
export function useUserLentLoans(userAddress: Address | undefined) {
  const { data: nextLoanId, isLoading: isLoadingCount } = useNextLoanId();
  const loanCount = nextLoanId ? Number(nextLoanId) : 0;

  const { data: allLoans, isLoading: isLoadingLoans, isError, refetch } = useBatchLoans(0, Math.min(loanCount, 50));

  // Filter for user's lent loans
  const userLoans = (allLoans || []).filter((l) =>
    userAddress && l.lender.toLowerCase() === userAddress.toLowerCase()
  );

  return {
    data: userLoans,
    isLoading: isLoadingCount || isLoadingLoans,
    isError,
    refetch
  };
}

// Combined hook for all user dashboard data
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

// ── Cross-Chain Lending ──────────────────────────────────────────────

import CrossChainLoanManagerABIJson from '@/contracts/CrossChainLoanManagerABI.json';
const CrossChainLoanManagerABI = CrossChainLoanManagerABIJson as Abi;

export function useFundCrossChainLoanRequest() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const fundRequest = (
    requestId: bigint,
    sourceChainId: bigint,
    sourceLoanId: bigint,
    crossChainManagerAddress?: Address,
  ) => {
    writeContract({
      address: crossChainManagerAddress || CONTRACT_ADDRESSES.crossChainManager,
      abi: CrossChainLoanManagerABI,
      functionName: 'fundCrossChainLoanRequest',
      args: [requestId, sourceChainId, sourceLoanId],
    });
  };

  const fundRequestAsync = async (
    requestId: bigint,
    sourceChainId: bigint,
    sourceLoanId: bigint,
    crossChainManagerAddress?: Address,
  ) => {
    return writeContractAsync({
      address: crossChainManagerAddress || CONTRACT_ADDRESSES.crossChainManager,
      abi: CrossChainLoanManagerABI,
      functionName: 'fundCrossChainLoanRequest',
      args: [requestId, sourceChainId, sourceLoanId],
    });
  };

  return { fundRequest, fundRequestAsync, hash, isPending, isConfirming, isSuccess, error };
}

export function useInitiateCrossChainLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const initiateRequest = async (
    targetChainId: bigint,
    collateralToken: Address,
    collateralAmount: bigint,
    borrowAsset: Address,
    borrowAmount: bigint,
    interestRate: bigint,
    duration: bigint
  ) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.crossChainManager,
      abi: CrossChainLoanManagerABI,
      functionName: 'initiateCrossChainLoanRequest',
      args: [targetChainId, collateralToken, collateralAmount, borrowAsset, borrowAmount, interestRate, duration],
    });
  };

  return { initiateRequest, hash, isPending, isConfirming, isSuccess, error };
}

// NOTE: useInvalidateContractQueries, useContractEventListener, and useAutoRefreshOnTx
// have been removed. Use the event hooks from '@/hooks/events' instead for real-time updates.
// The store at '@/stores/contractStore' is automatically updated by event watchers.
