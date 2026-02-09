'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { useCreateFiatLenderOffer } from '@/hooks/useFiatLoan';
import { useSupplierDetails } from '@/hooks/useSupplier';
import { useMaxInterestRate } from '@/hooks/useContracts';
import { SUPPORTED_FIAT_CURRENCIES, useSupplierBalance, useSupplierBalances, useBatchExchangeRates, getCurrencySymbol, convertToUSDCents, formatCentsToDecimal } from '@/hooks/useFiatOracle';
import { daysToSeconds } from '@/lib/utils';
import { ArrowRight, AlertCircle, DollarSign, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const durationOptions = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
];

export function CreateFiatLenderOfferForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [currency, setCurrency] = useState('USD');
  const [fiatAmount, setFiatAmount] = useState('');
  const [interestRate, setInterestRate] = useState('12');
  const [duration, setDuration] = useState('30');

  // Get max interest rate from configuration
  const { data: maxInterestRateData } = useMaxInterestRate();
  const maxInterestRate = maxInterestRateData ? Number(maxInterestRateData) / 100 : 50; // Default 50% if not loaded

  // Check supplier status
  const { isVerified: isSupplierVerified, isActive: isSupplierActive } = useSupplierDetails(address);
  const isVerifiedSupplier = isSupplierVerified && isSupplierActive;

  // Get supplier's fiat balance for selected currency
  const { data: supplierBalance } = useSupplierBalance(address, currency);
  const balanceInCents = supplierBalance as bigint | undefined;
  const balanceAmount = balanceInCents ? Number(balanceInCents) / 100 : 0;

  // Get all supplier balances to show available funds
  const { data: allBalances, isLoading: isLoadingBalances } = useSupplierBalances(address);
  const currenciesWithFunds = SUPPORTED_FIAT_CURRENCIES
    .filter(curr => {
      const balance = allBalances?.[curr.code];
      return balance && balance > BigInt(0);
    })
    .map(curr => ({
      ...curr,
      balance: allBalances?.[curr.code] || BigInt(0),
    }));

  // Get exchange rates
  const { data: exchangeRates } = useBatchExchangeRates();
  const currentRate = exchangeRates?.[currency];

  const { createFiatLenderOffer, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateFiatLenderOffer();

  // Calculate values
  const fiatAmountNumber = parseFloat(fiatAmount) || 0;
  const fiatAmountCents = BigInt(Math.floor(fiatAmountNumber * 100));

  // Convert fiat amount to USD for comparison
  const fiatAmountUSD = currentRate && fiatAmountNumber > 0
    ? Number(convertToUSDCents(fiatAmountCents, currentRate)) / 100
    : 0;

  // Calculate interest in the selected currency (same as borrowing)
  const interestDecimal = (parseFloat(interestRate) || 0) / 100;
  const interestAmountInCurrency = fiatAmountNumber * interestDecimal;
  const totalRepaymentInCurrency = fiatAmountNumber + interestAmountInCurrency;

  // Auto-calculate min collateral based on 75% LTV (collateral = total repayment / 0.75)
  const totalRepaymentUSD = fiatAmountUSD * (1 + interestDecimal);
  const minCollateralUSDAmount = BigInt(Math.floor(totalRepaymentUSD / 0.75));

  // Balance checks
  const hasZeroBalance = balanceAmount === 0;
  const hasEnoughBalance = balanceAmount >= fiatAmountNumber;
  const hasInsufficientBalance = fiatAmountNumber > 0 && !hasEnoughBalance;

  // Form validation
  const isFormValid =
    isVerifiedSupplier &&
    fiatAmount &&
    fiatAmountNumber > 0 &&
    hasEnoughBalance &&
    !hasZeroBalance &&
    currentRate;

  useEffect(() => {
    if (createSuccess) {
      toast.success('Fiat lender offer created successfully! It is now visible in the marketplace.');
      router.push('/marketplace?tab=offers');
    }
  }, [createSuccess, router]);

  useEffect(() => {
    if (createError) {
      toast.error('Failed to create fiat lender offer');
    }
  }, [createError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isVerifiedSupplier) {
      toast.error('You must be a verified fiat supplier to create offers');
      return;
    }

    if (!fiatAmount || fiatAmountNumber <= 0) {
      toast.error('Please enter a valid fiat amount');
      return;
    }

    if (hasZeroBalance) {
      toast.error('You have no fiat balance in this currency');
      return;
    }

    if (!hasEnoughBalance) {
      toast.error('Insufficient balance in ' + currency);
      return;
    }

    if (!currentRate) {
      toast.error('Exchange rate not available. Please try again.');
      return;
    }

    try {
      const durationSeconds = BigInt(daysToSeconds(parseInt(duration)));
      const interestRateBps = BigInt(parseFloat(interestRate) * 100); // 12% = 1200 bps

      await createFiatLenderOffer(
        fiatAmountCents,
        currency,
        minCollateralUSDAmount,
        durationSeconds,
        interestRateBps
      );
    } catch (error) {
      console.error('Error creating fiat lender offer:', error);
      toast.error('Failed to create offer. Please try again.');
    }
  };

  if (!isConnected) {
    return (
      <Card className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Wallet Not Connected</h3>
        <p className="text-gray-400">Please connect your wallet to create a fiat lender offer.</p>
      </Card>
    );
  }

  if (!isVerifiedSupplier) {
    return (
      <Card className="text-center py-12 border-yellow-500/20">
        <Banknote className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Supplier Verification Required</h3>
        <p className="text-gray-400 mb-6">
          You must be a verified fiat supplier to create fiat lender offers.
        </p>
        <Link href="/dashboard">
          <Button className="bg-green-600 hover:bg-green-700">
            Register as Fiat Supplier
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Fiat Lender Offer Details
        </h3>

        {/* Available Balances */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Your Available Balances</label>
          <div className="bg-white/5 rounded-lg border border-gray-700/50 max-h-32 overflow-y-auto">
            {isLoadingBalances ? (
              <div className="p-3 text-center text-xs text-gray-500">Loading balances...</div>
            ) : currenciesWithFunds.length > 0 ? (
              <div className="divide-y divide-gray-700/30">
                {currenciesWithFunds.map((curr) => (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => setCurrency(curr.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors text-left ${
                      currency === curr.code ? 'bg-green-500/10 border-l-2 border-green-500' : ''
                    }`}
                  >
                    <span className="text-sm">
                      <span className="font-medium">{curr.code}</span>
                      <span className="text-gray-500 ml-1">{curr.name}</span>
                    </span>
                    <span className="text-sm font-semibold text-green-400">
                      {curr.symbol}{formatCentsToDecimal(curr.balance)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">No fiat funds available</p>
                <Link href="/dashboard" className="text-xs text-green-400 hover:text-green-300 underline">
                  Deposit funds via Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Currency Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Currency</label>
          <Select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full"
          >
            {SUPPORTED_FIAT_CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.symbol} {curr.code} - {curr.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-400 mt-1">
            Your Balance: {getCurrencySymbol(currency)}{balanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </p>
        </div>

        {/* Fiat Amount */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Fiat Amount to Lend
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={fiatAmount}
              onChange={(e) => setFiatAmount(e.target.value)}
              placeholder="0.00"
              className="input-field w-full pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {currency}
            </span>
          </div>
          {fiatAmountUSD > 0 && (
            <p className="text-xs text-green-400 mt-1">
              ≈ ${fiatAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </p>
          )}
          {hasZeroBalance && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              You have no balance in {currency}
            </p>
          )}
          {hasInsufficientBalance && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Insufficient balance
            </p>
          )}
        </div>

        {/* Interest Rate */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Interest Rate (Total Interest)
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={maxInterestRate}
              step="0.5"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">0%</span>
              <span className="text-lg font-semibold text-green-400">{interestRate}%</span>
              <span className="text-xs text-gray-400">{maxInterestRate}% max</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            This is the total interest borrower will pay, not annual. The same rate applies regardless of duration.
          </p>
        </div>

        {/* Duration */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Loan Duration</label>
          <Select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full"
          >
            {durationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Summary */}
        {fiatAmountNumber > 0 && totalRepaymentInCurrency > 0 && (
          <div className="glass-card p-4 mt-6">
            <h4 className="text-sm font-semibold mb-3 text-green-400">Offer Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Lend Amount:</span>
                <span className="font-medium">{getCurrencySymbol(currency)}{fiatAmountNumber.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Interest ({interestRate}%):</span>
                <span className="font-medium text-green-400">
                  {getCurrencySymbol(currency)}{interestAmountInCurrency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="text-gray-400">Total Repayment:</span>
                <span className="font-semibold text-green-400">
                  {getCurrencySymbol(currency)}{totalRepaymentInCurrency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                </span>
              </div>
              {fiatAmountUSD > 0 && currency !== 'USD' && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>USD Equivalent:</span>
                  <span>≈ ${totalRepaymentUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-500 pt-2">
                <span>Min Collateral (auto 75% LTV):</span>
                <span>${Number(minCollateralUSDAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={isCreating}
          disabled={!isFormValid || isCreating}
          className="flex-1 bg-green-600 hover:bg-green-700"
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Create Offer
        </Button>
      </div>

      {/* Info Box */}
      <Card className="bg-primary-500/10 border-primary-500/30">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-primary-400 mb-1">How Fiat Lender Offers Work</p>
            <ul className="space-y-1 text-xs">
              <li>• Your offer will be visible to all borrowers in the marketplace</li>
              <li>• Borrowers can accept your offer by providing crypto collateral</li>
              <li>• The fiat amount will be deducted from your balance when accepted</li>
              <li>• You will need to disburse the fiat to the borrower off-chain</li>
              <li>• Offers expire after 7 days if not accepted</li>
            </ul>
          </div>
        </div>
      </Card>
    </form>
  );
}
