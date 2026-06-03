'use client';

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useAccount,
  Address,
  CONTRACT_ADDRESSES,
  getActiveChainId,
  getGasOverrides,
  LoanMarketPlaceABI,
} from './shared';
import { useInvalidateLeaderboardOnSuccess } from '@/hooks/useInvalidateLeaderboardOnSuccess';

export function useCreateLoanRequest() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { address } = useAccount();

  useInvalidateLeaderboardOnSuccess(isSuccess, address);

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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { createRequest, hash, isPending, isConfirming, isSuccess, error };
}

export function useFundLoanRequest() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { address } = useAccount();

  useInvalidateLeaderboardOnSuccess(isSuccess, address);

  const fundRequest = (requestId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'fundLoanRequest',
      args: [requestId],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  const fundRequestAsync = async (requestId: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'fundLoanRequest',
      args: [requestId],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { fundRequest, fundRequestAsync, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateLenderOffer() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const publicClient = usePublicClient();
  const { address } = useAccount();

  useInvalidateLeaderboardOnSuccess(isSuccess, address);

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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { createOffer, createOfferAsync, simulateCreateOffer, hash, isPending, isConfirming, isSuccess, error };
}

export function useAcceptLenderOffer() {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { address } = useAccount();

  useInvalidateLeaderboardOnSuccess(isSuccess, address);

  const acceptOffer = (offerId: bigint, collateralAsset: `0x${string}`, collateralAmount: bigint, borrowAmount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'acceptLenderOffer',
      args: [offerId, collateralAsset, collateralAmount, borrowAmount],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  const acceptOfferAsync = async (offerId: bigint, collateralAsset: `0x${string}`, collateralAmount: bigint, borrowAmount: bigint) => {
    return await writeContractAsync({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'acceptLenderOffer',
      args: [offerId, collateralAsset, collateralAmount, borrowAmount],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { acceptOffer, acceptOfferAsync, hash, isPending, isConfirming, isSuccess, error };
}

export function useRepayLoan(options?: { contractAddress?: Address; chainId?: number; isCrossChain?: boolean }) {
  const { writeContract, writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { address } = useAccount();

  useInvalidateLeaderboardOnSuccess(isSuccess, address);

  const resolvedAddress = options?.contractAddress || CONTRACT_ADDRESSES.loanMarketPlace;
  const resolvedChainId = options?.chainId || getActiveChainId();
  const functionName = options?.isCrossChain ? 'repayCrossChainLoan' : 'repayLoan';

  const repay = (loanId: bigint, amount: bigint) => {
    writeContract({
      address: resolvedAddress,
      abi: LoanMarketPlaceABI,
      functionName,
      args: [loanId, amount],
      chainId: resolvedChainId,
      ...getGasOverrides(),
    });
  };

  const repayAsync = async (loanId: bigint, amount: bigint) => {
    return await writeContractAsync({
      address: resolvedAddress,
      abi: LoanMarketPlaceABI,
      functionName,
      args: [loanId, amount],
      chainId: resolvedChainId,
      ...getGasOverrides(),
    });
  };

  return { repay, repayAsync, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelLoanRequest() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { address } = useAccount();

  useInvalidateLeaderboardOnSuccess(isSuccess, address);

  const cancelRequest = (requestId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'cancelLoanRequest',
      args: [requestId],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { cancelRequest, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelLenderOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { address } = useAccount();

  useInvalidateLeaderboardOnSuccess(isSuccess, address);

  const cancelOffer = (offerId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'cancelLenderOffer',
      args: [offerId],
      chainId: getActiveChainId(),
      ...getGasOverrides(),
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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
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
      chainId: getActiveChainId(),
      ...getGasOverrides(),
    });
  };

  return { liquidate, hash, isPending, isConfirming, isSuccess, error };
}
