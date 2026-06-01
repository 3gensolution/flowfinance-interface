'use client';

import {
  useReadContract,
  useReadContracts,
  useAccount,
  Address,
  CONTRACT_ADDRESSES,
  TOKEN_LIST,
  getActiveChainId,
  ZERO_ADDRESS,
  ConfigurationABI,
  LTVConfigABI,
} from './shared';

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

export function useMinRepaymentAmount() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'minRepaymentAmount',
    chainId: getActiveChainId(),
  });
}

export function usePlatformFeeRate() {
  const result = useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'platformFeeRate',
    chainId: getActiveChainId(),
  });

  const feeRateBps = result.data ? Number(result.data) : 0;
  const feeRatePercent = feeRateBps / 100;

  return {
    ...result,
    feeRateBps,
    feeRatePercent,
  };
}

export function useMinLoanDuration() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'minLoanDuration',
    chainId: getActiveChainId(),
  });
}

export function useMaxLoanDuration() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'maxLoanDuration',
    chainId: getActiveChainId(),
  });
}

export function useLoanConfigLimits() {
  const { data: maxInterestRateData, isLoading: loadingInterest } = useMaxInterestRate();
  const { data: minDurationData, isLoading: loadingMinDuration } = useMinLoanDuration();
  const { data: maxDurationData, isLoading: loadingMaxDuration } = useMaxLoanDuration();

  const isLoading = loadingInterest || loadingMinDuration || loadingMaxDuration;
  const minInterestRate = 1;
  const maxInterestRate = maxInterestRateData ? Number(maxInterestRateData) : 10000;
  const minDurationSeconds = minDurationData ? Number(minDurationData) : 86400;
  const maxDurationSeconds = maxDurationData ? Number(maxDurationData) : 31536000;
  const minDurationDays = Math.ceil(minDurationSeconds / 86400);
  const maxDurationDays = Math.floor(maxDurationSeconds / 86400);
  const minInterestPercent = minInterestRate / 100;
  const maxInterestPercent = maxInterestRate / 100;

  return {
    isLoading,
    minInterestRate,
    maxInterestRate,
    minInterestPercent,
    maxInterestPercent,
    minDurationSeconds,
    maxDurationSeconds,
    minDurationDays,
    maxDurationDays,
  };
}

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

export function useSupportedAssets() {
  const { isConnected } = useAccount();
  const chainId = getActiveChainId();
  const hasConfig = CONTRACT_ADDRESSES.configuration && CONTRACT_ADDRESSES.configuration !== ZERO_ADDRESS;
  const enabled = isConnected && hasConfig;

  const { data: supportedData, isLoading, isError, refetch } = useReadContracts({
    contracts: enabled
      ? TOKEN_LIST.map((token) => ({
          address: CONTRACT_ADDRESSES.configuration,
          abi: ConfigurationABI,
          functionName: 'isAssetSupported',
          args: [token.address],
          chainId,
        }))
      : [],
    query: {
      enabled,
    },
  });

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

export function useConfigMaxLTV(collateralAsset: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.configuration,
    abi: ConfigurationABI,
    functionName: 'getMaxLTV',
    args: collateralAsset ? [collateralAsset] : undefined,
    chainId: getActiveChainId(),
    query: {
      enabled: !!collateralAsset,
    },
  });
}

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
