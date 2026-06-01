'use client';

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  Address,
  CONTRACT_ADDRESSES,
  getActiveChainId,
  getGasOverrides,
  CrossChainLoanManagerABI,
} from './shared';

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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { initiateRequest, hash, isPending, isConfirming, isSuccess, error };
}
