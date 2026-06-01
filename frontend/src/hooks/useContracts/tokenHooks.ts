'use client';

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  Address,
  CONTRACT_ADDRESSES,
  getActiveChainId,
  getContractAddresses,
  getGasOverrides,
  ConfigurationABI,
  ERC20ABI,
} from './shared';
import { queryClient } from '@/lib/react-query-client';

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

  const priceDataTuple = priceData.data as readonly unknown[] | undefined;
  const contractPrice = priceDataTuple ? priceDataTuple[1] as bigint : undefined;
  const contractUpdatedAt = priceDataTuple ? Number(priceDataTuple[3]) : undefined;
  const price = contractPrice;
  const updatedAt = contractUpdatedAt;

  // Keep frontend staleness detection aligned with Configuration.getTokenPriceInUSD(),
  // which rejects prices older than 15 minutes on-chain.
  const STALENESS_THRESHOLD = 15 * 60;
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

export function useRefreshMockPrice() {
  const { writeContractAsync, isPending, error } = useWriteContract();
  const publicClient = usePublicClient();

  const refreshPrice = async (priceFeedAddress: Address, currentPrice: bigint, tokenAddress?: Address) => {
    void tokenAddress;
    const hash = await writeContractAsync({
      address: priceFeedAddress,
      abi: MockV3AggregatorABI,
      functionName: 'updateAnswer',
      args: [currentPrice],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });

    if (!publicClient) {
      throw new Error('Public client unavailable');
    }

    await publicClient.waitForTransactionReceipt({ hash });
    await queryClient.invalidateQueries();

    return hash;
  };

  return { refreshPrice, isPending, error };
}

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

export function useApproveToken() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const publicClient = usePublicClient();

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

  const approve = (tokenAddress: Address, spenderAddress: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spenderAddress, amount],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  const approveAsync = async (tokenAddress: Address, spenderAddress: Address, amount: bigint, chainId?: number) => {
    return await writeContractAsync({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spenderAddress, amount],
      chainId: chainId || getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { approve, approveAsync, simulateApprove, hash, isPending, isConfirming, isSuccess, error };
}
