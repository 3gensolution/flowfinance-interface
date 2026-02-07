'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Address, parseUnits, formatUnits, zeroAddress } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { TOKEN_LIST, CONTRACT_ADDRESSES } from '@/config/contracts';
import { useApproveToken, useCreateLenderOffer, useTokenBalance, useTokenAllowance, useMaxInterestRate, useSupportedAssets, usePlatformFeeRate } from '@/hooks/useContracts';
import { formatTokenAmount, daysToSeconds, getTokenDecimals } from '@/lib/utils';
import { ArrowRight, AlertCircle, CheckCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

const durationOptions = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
];

export function CreateLenderOfferForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [lendToken, setLendToken] = useState<Address>(TOKEN_LIST[1].address);
  const [lendAmount, setLendAmount] = useState('');
  const [interestRate, setInterestRate] = useState('12');
  const [duration, setDuration] = useState('30');
  const [step, setStep] = useState<'form' | 'approve' | 'confirm'>('form');
  const [simulationError, setSimulationError] = useState<string>('');

  // Get max interest rate from configuration
  const { data: maxInterestRateData } = useMaxInterestRate();
  const maxInterestRate = maxInterestRateData ? Number(maxInterestRateData) / 100 : 50; // Default 50% if not loaded

  // Get platform fee rate
  const { feeRatePercent: platformFeePercent } = usePlatformFeeRate();

  // Get supported assets from Configuration contract
  const { supportedTokens } = useSupportedAssets();
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  const lendDecimals = getTokenDecimals(lendToken);

  const { data: lendBalance } = useTokenBalance(lendToken, address);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
    lendToken,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  const { approveAsync, isPending: isApproving, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { createOffer, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateLenderOffer();

  const parsedLendAmount = lendAmount
    ? parseUnits(lendAmount, lendDecimals)
    : BigInt(0);

  const needsApproval = allowance !== undefined && parsedLendAmount > (allowance as bigint);

  // Balance calculations
  const maxLendBalance = lendBalance
    ? formatUnits(lendBalance as bigint, lendDecimals)
    : '0';
  const maxLendBalanceNumber = parseFloat(maxLendBalance);

  // Check balance status
  const hasZeroBalance = maxLendBalanceNumber === 0;
  const hasEnoughBalance = lendBalance !== undefined && lendBalance !== null && parsedLendAmount > 0
    ? BigInt(lendBalance as bigint) >= parsedLendAmount
    : true;
  const hasInsufficientBalance = parsedLendAmount > 0 && !hasEnoughBalance;

  // Calculate interest amount for display
  const interestDecimal = (parseFloat(interestRate) || 0) / 100;
  const lendAmountNum = parseFloat(lendAmount) || 0;
  const interestAmount = lendAmountNum * interestDecimal;
  const totalRepayment = lendAmountNum + interestAmount;

  // Check if submit button should be disabled
  const isSubmitDisabled =
    !lendAmount ||
    hasZeroBalance ||
    hasInsufficientBalance;

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Token approved successfully!');
      refetchAllowance();
      setStep('confirm');
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (createSuccess) {
      toast.success('Lender offer created successfully! It is now visible in the marketplace.');
      router.push('/marketplace?tab=offers');
    }
  }, [createSuccess, router]);

  useEffect(() => {
    if (createError) {
      toast.error('Failed to create lender offer');
    }
  }, [createError]);

  // Limit input to max balance
  const handleLendAmountChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > maxLendBalanceNumber && maxLendBalanceNumber > 0) {
      setLendAmount(maxLendBalance);
    } else {
      setLendAmount(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!lendAmount) {
      toast.error('Please enter a lend amount');
      return;
    }

    if (hasZeroBalance) {
      toast.error('You have no tokens to lend');
      return;
    }

    if (!hasEnoughBalance) {
      toast.error('Insufficient balance');
      return;
    }

    setSimulationError('');

    if (needsApproval) {
      setStep('approve');
      return;
    }

    setStep('confirm');
  };

  const handleApprove = async () => {
    setSimulationError('');

    try {
      // Simulate approval first
      const simulation = await simulateContractWrite({
        address: lendToken,
        abi: [
          {
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          }
        ],
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.loanMarketPlace, parsedLendAmount],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Simulation failed');
        toast.error(simulation.errorMessage || 'Transaction will fail');
        return;
      }

      await approveAsync(lendToken, CONTRACT_ADDRESSES.loanMarketPlace, parsedLendAmount);
      // Transaction submitted - useEffect will handle success
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCreateOffer = async () => {
    setSimulationError('');

    // Always use address(0) - borrower chooses collateral from supported assets
    const requiredCollateral = zeroAddress;
    // Minimum collateral amount of 1 (borrower will provide based on LTV)
    const minCollateralAmount = BigInt(1);
    const interestRateBps = BigInt(Math.floor(parseFloat(interestRate) * 100));
    const durationSeconds = daysToSeconds(parseInt(duration));

    try {
      // Simulate first
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'createLenderOffer',
        args: [
          lendToken,
          parsedLendAmount,
          requiredCollateral,
          minCollateralAmount,
          interestRateBps,
          durationSeconds
        ],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Transaction would fail');
        toast.error(simulation.errorMessage || 'Transaction would fail');
        return;
      }

      createOffer(
        lendToken,
        parsedLendAmount,
        requiredCollateral,
        minCollateralAmount,
        interestRateBps,
        durationSeconds
      );
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const tokenOptions = availableTokens.map((token) => ({
    value: token.address,
    label: token.symbol,
  }));

  if (!isConnected) {
    return (
      <Card className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-gray-400">Please connect your wallet to create a lender offer</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-6">Create Lender Offer</h2>

      {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info about how offers work */}
          <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
            <div className="flex gap-3 items-start">
              <Info className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-primary-400 font-medium">How Lender Offers Work</p>
                <p className="text-gray-400 text-sm mt-1">
                  You provide liquidity and set your terms. When a borrower accepts your offer,
                  they choose which collateral to deposit from the platform&apos;s supported assets.
                  The required collateral amount is calculated based on LTV ratios.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-accent-400">You Lend</h3>
            <Select
              label="Lend Token"
              options={tokenOptions}
              value={lendToken}
              onChange={(e) => setLendToken(e.target.value as Address)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Lend Amount</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    step="any"
                    placeholder="0.0"
                    value={lendAmount}
                    onChange={(e) => handleLendAmountChange(e.target.value)}
                    className="input-field w-full"
                  />
                </div>
                {maxLendBalanceNumber > 0 && (
                  <button
                    type="button"
                    onClick={() => setLendAmount(maxLendBalance)}
                    className="px-3 py-2 text-xs font-semibold text-primary-400 hover:text-primary-300 bg-primary-400/10 hover:bg-primary-400/20 rounded-lg transition-colors"
                  >
                    MAX
                  </button>
                )}
                <span className="text-sm text-gray-400 min-w-[40px]">
                  {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
                </span>
              </div>
            </div>
            {lendBalance !== undefined && lendBalance !== null && (
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Balance: {formatTokenAmount(lendBalance as bigint, lendDecimals)}{' '}
                    {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
                  </span>
                </div>

                {/* Zero Balance Warning */}
                {hasZeroBalance && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 font-medium">No {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol} Balance</p>
                        <p className="text-gray-400 mt-1">
                          You need tokens to create an offer.{' '}
                          <Link
                            href="/faucet"
                            className="text-primary-400 hover:text-primary-300 hover:underline font-medium"
                          >
                            Get test tokens from the faucet
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Insufficient Balance Warning */}
                {hasInsufficientBalance && !hasZeroBalance && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-400 font-medium">Insufficient Balance</p>
                        <p className="text-gray-400 mt-1">
                          Maximum available: {formatTokenAmount(lendBalance as bigint, lendDecimals)}.{' '}
                          <Link
                            href="/faucet"
                            className="text-primary-400 hover:text-primary-300 hover:underline font-medium"
                          >
                            Get more tokens from the faucet
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collateral Info */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>Collateral:</strong> Borrowers can use any supported collateral token.
              The required amount will be calculated based on platform LTV ratios when they accept your offer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">0%</span>
                  <span className="text-lg font-semibold text-primary-400">{interestRate}%</span>
                  <span className="text-xs text-gray-400">{maxInterestRate}% max</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                This is the total interest borrower will pay, not annual. The same rate applies regardless of duration.
              </p>
            </div>
            <Select
              label="Loan Duration"
              options={durationOptions}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div className="glass-card p-4 space-y-2">
            <h4 className="font-semibold text-gray-300">Summary</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You Lend</span>
              <span>
                {lendAmount || '0'} {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interest Rate</span>
              <span>{interestRate}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span>{duration} days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-gray-300">{platformFeePercent}%</span>
            </div>
            {interestAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Interest Earned</span>
                <span className="text-green-400">
                  +{interestAmount.toFixed(6)} {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
                </span>
              </div>
            )}
            {totalRepayment > 0 && (
              <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                <span className="text-gray-400">Total Repayment</span>
                <span className="font-medium">
                  {totalRepayment.toFixed(6)} {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-white/10 pt-2">
              <span className="text-gray-400">Collateral</span>
              <span className="text-primary-400">Borrower chooses</span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            icon={<ArrowRight className="w-5 h-5" />}
            disabled={isSubmitDisabled}
          >
            Continue
          </Button>
        </form>
      )}

      {step === 'approve' && (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 mx-auto glass-card rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Token Approval Required</h3>
            <p className="text-gray-400">
              Before you can create this lender offer, you need to approve the contract to transfer your{' '}
              {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol} tokens.
            </p>
          </div>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-left">
            <p className="text-sm text-gray-300 mb-2">
              <span className="text-yellow-400 font-medium">Why is this needed?</span>
            </p>
            <p className="text-xs text-gray-400">
              ERC-20 tokens require a two-step process: first you approve the contract to access your tokens, then you can create the offer. When a borrower accepts your offer, the contract will transfer your tokens to fund the loan.
            </p>
          </div>

          {/* Simulation Error */}
          {simulationError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Transaction Error</p>
                  <p className="text-gray-400 mt-1">{simulationError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setStep('form')} className="flex-1" disabled={isApproving || isApprovalConfirming}>
              Back
            </Button>
            <Button onClick={handleApprove} loading={isApproving || isApprovalConfirming} className="flex-1">
              {isApproving ? 'Approving...' : isApprovalConfirming ? 'Confirming...' : 'Approve'}
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 mx-auto glass-card rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Confirm Transaction</h3>
            <p className="text-gray-400">
              Create your lender offer for {lendAmount}{' '}
              {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
            </p>
          </div>

          {/* Simulation Error */}
          {simulationError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Transaction Error</p>
                  <p className="text-gray-400 mt-1">{simulationError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setStep('form')} className="flex-1">
              Back
            </Button>
            <Button onClick={handleCreateOffer} loading={isCreating} className="flex-1">
              Create Offer
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
