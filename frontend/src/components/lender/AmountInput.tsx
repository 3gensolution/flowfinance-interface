'use client';

import { AmountInput as SharedAmountInput, Asset } from '@/components/ui/AmountInput';

// Re-export Asset type for backwards compatibility
export type { Asset };

// Lender-specific asset type that includes null (matches AssetTypeSelector)
export type AssetType = 'crypto' | 'cash' | null;

interface LenderAmountInputProps {
  assetType: AssetType;
  asset: Asset | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  minAmount?: string;
}

export function AmountInput({
  assetType,
  asset,
  amount,
  onAmountChange,
  minAmount = '10',
}: LenderAmountInputProps) {
  // Don't render if assetType is null
  if (assetType === null) return null;

  // Convert 'cash' to 'fiat' for the shared component
  const sharedAssetType = assetType === 'cash' ? 'fiat' : assetType;

  return (
    <SharedAmountInput
      assetType={sharedAssetType}
      asset={asset}
      amount={amount}
      onAmountChange={onAmountChange}
      minAmount={minAmount}
      title="How much do you want to lend?"
    />
  );
}
