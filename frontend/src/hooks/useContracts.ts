'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Address, Abi } from 'viem';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
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
    query: {
      enabled: requestId !== undefined,
    },
  });
}

// Read lender offer by ID
export function useLenderOffer(offerId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'lenderOffers',
    args: offerId !== undefined ? [offerId] : undefined,
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
    query: {
      enabled: loanId !== undefined,
    },
  });
}

// Calculate repayment amount
export function useRepaymentAmount(loanId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'calculateRepaymentAmount',
    args: loanId !== undefined ? [loanId] : undefined,
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
  });
}

// Get next lender offer ID
export function useNextLenderOfferId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLenderOfferId',
  });
}

// Get next loan ID
export function useNextLoanId() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanId',
  });
}

// Get user's loan requests
export function useUserLoanRequests(address: Address | undefined, index: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'userLoanRequests',
    args: address ? [address, BigInt(index)] : undefined,
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
  });
}

export function usePlatformFeeRate() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'platformFeeRate',
  });
}

export function useMinCollateralRatio() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'minCollateralRatio',
  });
}

export function useMaxInterestRate() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'maxInterestRate',
  });
}

// LTV Config reads
export function useLTV(collateralAsset: Address | undefined, durationDays: number | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.ltvConfig,
    abi: LTVConfigABI,
    functionName: 'getLTV',
    args: collateralAsset && durationDays !== undefined ? [collateralAsset, BigInt(durationDays)] : undefined,
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
    query: {
      enabled: !!asset,
    },
  });
}

export function useTokenPrice(tokenAddress: Address | undefined) {
  const priceFeedAddress = useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'priceFeeds',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress,
    },
  });

  const priceData = useReadContract({
    address: priceFeedAddress.data as Address,
    abi: [
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
    ],
    functionName: 'latestRoundData',
    query: {
      enabled: !!priceFeedAddress.data && priceFeedAddress.data !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Extract price and updatedAt from response
  const priceDataTuple = priceData.data as readonly unknown[] | undefined;
  const price = priceDataTuple ? priceDataTuple[1] as bigint : undefined;
  const updatedAt = priceDataTuple ? Number(priceDataTuple[3]) : undefined;

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

// Token balance
export function useTokenBalance(tokenAddress: Address | undefined, userAddress: Address | undefined) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!userAddress,
    },
  });
}

// Token allowance
export function useTokenAllowance(
  tokenAddress: Address | undefined,
  ownerAddress: Address | undefined,
  spenderAddress: Address | undefined
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!ownerAddress && !!spenderAddress,
    },
  });
}

// Write hooks
export function useApproveToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (tokenAddress: Address, spenderAddress: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [spenderAddress, amount],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
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
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const fundRequest = (requestId: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'fundLoanRequest',
      args: [requestId],
    });
  };

  return { fundRequest, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateLenderOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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

  return { createOffer, hash, isPending, isConfirming, isSuccess, error };
}

export function useAcceptLenderOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const acceptOffer = (offerId: bigint, collateralAmount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'acceptLenderOffer',
      args: [offerId, collateralAmount],
    });
  };

  return { acceptOffer, hash, isPending, isConfirming, isSuccess, error };
}

export function useRepayLoan() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const repay = (loanId: bigint, amount: bigint) => {
    writeContract({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'repayLoan',
      args: [loanId, amount],
    });
  };

  return { repay, hash, isPending, isConfirming, isSuccess, error };
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
  const { data: requestsData, isLoading, isError, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'loanRequests',
      args: [BigInt(startId + i)],
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

      // Map based on actual ABI structure
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
          interestRate: arr[7],
          maxInterestRate: arr[8],
          createdAt: arr[9],
          expireAt: arr[10],
          status: arr[11],
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
          interestRate: obj.interestRate,
          maxInterestRate: obj.maxInterestRate,
          createdAt: obj.createdAt,
          expireAt: obj.expireAt,
          status: obj.status,
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

  return { data: requests, isLoading, isError, refetch };
}

// Batch fetch lender offers using multicall
export function useBatchLenderOffers(startId: number, count: number) {
  const { data: offersData, isLoading, isError, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'lenderOffers',
      args: [BigInt(startId + i)],
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

      // Map based on actual ABI structure
      let offerData;
      if (isArray) {
        const arr = data as readonly unknown[];
        offerData = {
          offerId: arr[0],
          lender: arr[1],
          lendAsset: arr[2],
          lendAmount: arr[3],
          requiredCollateralAsset: arr[4],
          minCollateralAmount: arr[5],
          duration: arr[6],
          interestRate: arr[7],
          createdAt: arr[8],
          expireAt: arr[9],
          status: arr[10],
        };
      } else {
        const obj = data as Record<string, unknown>;
        offerData = {
          offerId: obj.offerId,
          lender: obj.lender,
          lendAsset: obj.lendAsset,
          lendAmount: obj.lendAmount,
          requiredCollateralAsset: obj.requiredCollateralAsset,
          minCollateralAmount: obj.minCollateralAmount,
          duration: obj.duration,
          interestRate: obj.interestRate,
          createdAt: obj.createdAt,
          expireAt: obj.expireAt,
          status: obj.status,
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
        requiredCollateralAsset: offerData.requiredCollateralAsset as Address,
        minCollateralAmount: offerData.minCollateralAmount as bigint,
        duration: offerData.duration as bigint,
        interestRate: offerData.interestRate as bigint,
        createdAt: offerData.createdAt as bigint,
        expireAt: offerData.expireAt as bigint,
        status: Number(offerData.status),
      };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  return { data: offers, isLoading, isError, refetch };
}

// Batch fetch loans using multicall
export function useBatchLoans(startId: number, count: number) {
  const { data: loansData, isLoading, isError, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'loans',
      args: [BigInt(startId + i)],
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

      // Map based on actual ABI structure
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
          borrowAsset: arr[6],
          principalAmount: arr[7],
          interestRate: arr[8],
          duration: arr[9],
          startTime: arr[10],
          endTime: arr[11],
          amountRepaid: arr[12],
          status: arr[13],
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
          borrowAsset: obj.borrowAsset,
          principalAmount: obj.principalAmount,
          interestRate: obj.interestRate,
          duration: obj.duration,
          startTime: obj.startTime,
          endTime: obj.endTime,
          amountRepaid: obj.amountRepaid,
          status: obj.status,
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
        borrowAsset: loanData.borrowAsset as Address,
        principalAmount: loanData.principalAmount as bigint,
        interestRate: loanData.interestRate as bigint,
        duration: loanData.duration as bigint,
        startTime: loanData.startTime as bigint,
        endTime: loanData.endTime as bigint,
        amountRepaid: loanData.amountRepaid as bigint,
        status: Number(loanData.status),
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  return { data: loans, isLoading, isError, refetch };
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
  const stats = {
    totalLoans,
    activeLoans: 0,
    totalBorrowed: BigInt(0),
    totalCollateralValue: BigInt(0),
    uniqueBorrowers: new Set<Address>(),
    uniqueLenders: new Set<Address>(),
  };

  (loans || []).forEach((loan) => {
    // LoanStatus: NULL=0, ACTIVE=1, REPAID=2, LIQUIDATED=3, DEFAULTED=4
    if (loan.status === 1) { // ACTIVE
      stats.activeLoans++;
      // For TVL, we only count active loans' collateral
      stats.totalCollateralValue += loan.collateralAmount;
    }

    // Count all non-null loans for total borrowed
    stats.totalBorrowed += loan.principalAmount;

    // Track unique users
    stats.uniqueBorrowers.add(loan.borrower as Address);
    stats.uniqueLenders.add(loan.lender as Address);
  });

  return {
    data: {
      totalLoans: stats.totalLoans,
      activeLoans: stats.activeLoans,
      totalBorrowed: stats.totalBorrowed,
      totalCollateralValue: stats.totalCollateralValue,
      activeUsers: stats.uniqueBorrowers.size + stats.uniqueLenders.size,
      uniqueBorrowers: stats.uniqueBorrowers.size,
      uniqueLenders: stats.uniqueLenders.size,
    },
    isLoading,
    isError,
  };
}
