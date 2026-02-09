'use client';

import { AmountInput } from '@/components/ui/AmountInput';
import { CollateralAsset } from './CollateralSelector';

interface CollateralAmountInputProps {
  asset: CollateralAsset | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  minAmount?: string;
  usdValue?: number;
}

export function CollateralAmountInput({
  asset,
  amount,
  onAmountChange,
  minAmount = '0.001',
  usdValue,
}: CollateralAmountInputProps) {
  if (!asset) return null;

  // Convert CollateralAsset to AmountInput Asset format
  const amountInputAsset = {
    symbol: asset.symbol,
    name: asset.name,
    address: asset.address,
    decimals: asset.decimals,
    balance: asset.balance,
    rawBalance: asset.rawBalance,
    icon: asset.icon,
  };

  return (
    <AmountInput
      assetType="crypto"
      asset={amountInputAsset}
      amount={amount}
      onAmountChange={onAmountChange}
      minAmount={minAmount}
      title="How much collateral?"
      showUsdValue={true}
      usdValue={usdValue}
    />
  );
}
