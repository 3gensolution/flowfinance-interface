'use client';

import { useMemo } from 'react';
import { Address, formatUnits, parseUnits } from 'viem';
import { useLTV, useLiquidationThreshold, useTokenPrice } from '@/hooks/useContracts';
import { getTokenByAddress } from '@/config/contracts';
import { Card } from '@/components/ui/Card';
import { AlertCircle, TrendingUp, Shield, Info } from 'lucide-react';

interface LTVCalculatorProps {
  collateralToken: Address;
  collateralAmount: string;
  borrowToken: Address;
  borrowAmount: string;
  duration: number; // in days
}

export function LTVCalculator({
  collateralToken,
  collateralAmount,
  borrowToken,
  borrowAmount,
  duration,
}: LTVCalculatorProps) {
  const collateralTokenInfo = getTokenByAddress(collateralToken);
  const borrowTokenInfo = getTokenByAddress(borrowToken);

  // Get prices
  const { price: collateralPrice } = useTokenPrice(collateralToken);
  const { price: borrowPrice } = useTokenPrice(borrowToken);

  // Get LTV and liquidation threshold
  const { data: ltv } = useLTV(collateralToken, duration);
  const { data: liqThreshold } = useLiquidationThreshold(collateralToken, duration);

  // Calculate values
  const calculations = useMemo(() => {
    if (!collateralAmount || !borrowAmount || !collateralPrice || !borrowPrice || !collateralTokenInfo || !borrowTokenInfo) {
      return null;
    }

    try {
      // Parse amounts with correct decimals
      const collateralAmountBigInt = parseUnits(collateralAmount, collateralTokenInfo.decimals);
      const borrowAmountBigInt = parseUnits(borrowAmount, borrowTokenInfo.decimals);

      // Calculate USD values (prices are in 8 decimals from Chainlink)
      // collateralValueUSD = (collateralAmount * collateralPrice) / 1e(decimals + 8)
      const collateralValueUSD = (collateralAmountBigInt * collateralPrice) /
        BigInt(10 ** (collateralTokenInfo.decimals + 8));

      const borrowValueUSD = (borrowAmountBigInt * borrowPrice) /
        BigInt(10 ** (borrowTokenInfo.decimals + 8));

      // Calculate actual LTV ratio (in basis points, 10000 = 100%)
      const actualLTV = borrowValueUSD > BigInt(0)
        ? (borrowValueUSD * BigInt(10000)) / collateralValueUSD
        : BigInt(0);

      // Maximum allowed borrow based on LTV
      const maxLTV = (ltv as bigint) || BigInt(7500); // Default to 75% if not available
      const maxBorrowUSD = (collateralValueUSD * maxLTV) / BigInt(10000);

      // Convert max borrow back to borrow token amount
      const maxBorrowAmount = (maxBorrowUSD * BigInt(10 ** (borrowTokenInfo.decimals + 8))) / borrowPrice;

      // Liquidation threshold
      const liqThresholdValue = (liqThreshold as bigint) || BigInt(8000); // Default to 80%
      const liquidationPriceRatio = borrowValueUSD > BigInt(0)
        ? (borrowValueUSD * BigInt(10000)) / (collateralAmountBigInt * BigInt(10 ** (8 - collateralTokenInfo.decimals)))
        : BigInt(0);

      const liquidationPrice = (liquidationPriceRatio * BigInt(10000)) / liqThresholdValue;

      // Health factor (scaled to 100 = 100%)
      const healthFactor = borrowValueUSD > BigInt(0)
        ? (collateralValueUSD * liqThresholdValue) / (borrowValueUSD * BigInt(100))
        : BigInt(10000);

      return {
        collateralValueUSD: Number(collateralValueUSD),
        borrowValueUSD: Number(borrowValueUSD),
        actualLTV: Number(actualLTV),
        maxLTV: Number(maxLTV),
        maxBorrowAmount: formatUnits(maxBorrowAmount, borrowTokenInfo.decimals),
        maxBorrowUSD: Number(maxBorrowUSD),
        liquidationThreshold: Number(liqThresholdValue),
        liquidationPrice: Number(liquidationPrice),
        healthFactor: Number(healthFactor),
        isHealthy: healthFactor >= BigInt(10000),
        isSafe: actualLTV <= maxLTV,
      };
    } catch (error) {
      console.error('Error calculating LTV:', error);
      return null;
    }
  }, [collateralAmount, borrowAmount, collateralPrice, borrowPrice, collateralTokenInfo, borrowTokenInfo, ltv, liqThreshold]);

  if (!calculations) {
    return null;
  }

  const ltvPercentage = (calculations.actualLTV / 100).toFixed(2);
  const maxLTVPercentage = (calculations.maxLTV / 100).toFixed(2);
  const healthPercentage = (calculations.healthFactor / 100).toFixed(2);

  const getLTVColor = () => {
    if (calculations.actualLTV > calculations.maxLTV) return 'text-red-400';
    if (calculations.actualLTV > calculations.maxLTV * 0.9) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getHealthColor = () => {
    if (calculations.healthFactor < 10000) return 'text-red-400';
    if (calculations.healthFactor < 12000) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="w-5 h-5 text-primary-400" />
          <span>Loan-to-Value Analysis</span>
        </div>

        {/* LTV Ratio */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Current LTV Ratio</span>
            <span className={`text-lg font-bold ${getLTVColor()}`}>
              {ltvPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                calculations.actualLTV > calculations.maxLTV
                  ? 'bg-red-500'
                  : calculations.actualLTV > calculations.maxLTV * 0.9
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{
                width: `${Math.min((calculations.actualLTV / calculations.maxLTV) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Safe</span>
            <span>Max: {maxLTVPercentage}%</span>
          </div>
        </div>

        {/* Warning if LTV too high */}
        {!calculations.isSafe && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-400 font-medium">LTV Too High</p>
              <p className="text-gray-400 mt-1">
                Your loan-to-value ratio exceeds the maximum allowed for this collateral type and duration.
                Reduce borrow amount or increase collateral.
              </p>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Collateral Value</div>
            <div className="text-lg font-semibold">
              ${calculations.collateralValueUSD.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-gray-700/50 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Borrow Value</div>
            <div className="text-lg font-semibold">
              ${calculations.borrowValueUSD.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-gray-700/50 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Max Borrow</div>
            <div className="text-sm font-semibold text-primary-400">
              {parseFloat(calculations.maxBorrowAmount).toFixed(2)} {borrowTokenInfo?.symbol}
            </div>
            <div className="text-xs text-gray-500">
              ≈ ${calculations.maxBorrowUSD.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-gray-700/50 rounded-lg">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Health Factor
            </div>
            <div className={`text-lg font-semibold ${getHealthColor()}`}>
              {healthPercentage}%
            </div>
          </div>
        </div>

        {/* Liquidation Info */}
        <div className="p-3 bg-primary-500/10 border border-primary-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="text-primary-400 font-medium">Liquidation Threshold: {(calculations.liquidationThreshold / 100).toFixed(0)}%</p>
              <p className="text-gray-400">
                Your collateral will be at risk if the LTV ratio reaches the liquidation threshold.
                A health factor below 100% means your position can be liquidated.
              </p>
            </div>
          </div>
        </div>

        {/* Duration-based LTV Info */}
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>
            LTV varies by loan duration. Longer durations typically have lower LTV limits due to increased risk.
          </span>
        </div>
      </div>
    </Card>
  );
}
