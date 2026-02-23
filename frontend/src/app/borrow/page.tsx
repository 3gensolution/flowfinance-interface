'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Info, Sparkles, Globe } from 'lucide-react';
import { useAccount, useReadContracts, useReadContract } from 'wagmi';
import Link from 'next/link';
import { Address, formatUnits, parseUnits, Abi } from 'viem';
import { Button } from '@/components/ui/Button';
import { PriceStaleWarning } from '@/components/ui/PriceStaleWarning';
import {
  CollateralSelector,
  CollateralAsset,
  CollateralAmountInput,
  StablecoinSelector,
  StablecoinAsset,
  BorrowAsset,
  BorrowType,
  LoanTerms,
  QuotationPanel,
  BorrowSubmitCTA,
} from '@/components/borrower';
import {
  useSupportedAssets,
  useTokenPrice,
  useLTV,
  useLiquidationThreshold,
} from '@/hooks/useContracts';
import { getCurrencySymbol, useExchangeRate, convertFromUSDCents } from '@/hooks/useFiatOracle';
import { CONTRACT_ADDRESSES, TOKEN_LIST, isFiatSupportedChain, getTokenListForChain, getChainById } from '@/config/contracts';
import { useNetwork, NETWORKS_WITH_CONTRACTS } from '@/contexts/NetworkContext';
import { config as wagmiConfig } from '@/config/wagmi';
import { LoanRequestStatus } from '@/types';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';
import ERC20ABIJson from '@/contracts/ERC20ABI.json';

const ERC20ABI = ERC20ABIJson as Abi;
const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

// Define wizard steps - Start with borrow asset, then collateral
const STEPS = [
  { id: 1, title: 'Borrow', description: 'Choose the stablecoin you want to borrow' },
  { id: 2, title: 'Collateral', description: 'Select the crypto asset to lock as security' },
  { id: 3, title: 'Amount', description: 'Enter collateral amount and set your LTV' },
  { id: 4, title: 'Terms', description: 'Set your interest rate and duration' },
  { id: 5, title: 'Review', description: 'Review and submit your loan request' },
];

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const { selectedNetwork } = useNetwork();

  // Wizard state (1-indexed to match Step ids)
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [selectedStablecoin, setSelectedStablecoin] = useState<StablecoinAsset | null>(null);
  const [selectedCollateral, setSelectedCollateral] = useState<CollateralAsset | null>(null);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowType] = useState<BorrowType>('crypto'); // Default to crypto for now
  const [selectedBorrowAsset, setSelectedBorrowAsset] = useState<BorrowAsset | null>(null);
  const [selectedLTV, setSelectedLTV] = useState(0); // User-selected LTV percentage
  const [interestRate, setInterestRate] = useState(10);
  const [duration, setDuration] = useState(30);
  const [customDate, setCustomDate] = useState<Date | null>(null);

  // Cross-chain: target chain for receiving funds (defaults to current chain = same-chain)
  const [targetChainId, setTargetChainId] = useState<number>(selectedNetwork.id);
  const isCrossChain = targetChainId !== selectedNetwork.id;

  // Available target chains (chains with deployed contracts)
  const targetChainOptions = useMemo(() => {
    return NETWORKS_WITH_CONTRACTS
      .map(cid => getChainById(cid))
      .filter((c): c is NonNullable<typeof c> => !!c);
  }, []);

  // Reset stablecoin selection when target chain changes
  useEffect(() => {
    setSelectedStablecoin(null);
    setSelectedBorrowAsset(null);
  }, [targetChainId]);

  // Fetch available lender offers count for informational banner
  const { data: nextCryptoOfferId } = useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLenderOfferId',
    chainId: selectedNetwork.id,
    config: wagmiConfig,
  });

  const cryptoOfferCount = nextCryptoOfferId ? Number(nextCryptoOfferId) : 0;

  // Fetch crypto offers to filter out user's own offers
  const { data: cryptoOffersData } = useReadContracts({
    contracts: Array.from({ length: cryptoOfferCount }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'lenderOffers',
      args: [BigInt(i)],
      chainId: selectedNetwork.id,
    })),
    config: wagmiConfig,
    query: {
      enabled: cryptoOfferCount > 0 && isConnected,
    },
  });

  const fiatSupported = isFiatSupportedChain(selectedNetwork.id);

  const { data: activeFiatOfferIds } = useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getActiveFiatLenderOffers',
    chainId: selectedNetwork.id,
    config: wagmiConfig,
    query: { enabled: fiatSupported },
  });

  const fiatOfferIds = useMemo(() => (activeFiatOfferIds as bigint[]) || [], [activeFiatOfferIds]);

  // Fetch fiat offers to filter out user's own offers (Base only)
  const { data: fiatOffersData } = useReadContracts({
    contracts: fiatOfferIds.map((id) => ({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'fiatLenderOffers',
      args: [id],
      chainId: selectedNetwork.id,
    })),
    config: wagmiConfig,
    query: {
      enabled: fiatSupported && fiatOfferIds.length > 0 && isConnected,
    },
  });

  // Calculate total available offers (excluding user's own offers)
  const totalAvailableOffers = useMemo(() => {
    if (!isConnected || !address) {
      // If not connected, show total count
      return cryptoOfferCount + fiatOfferIds.length;
    }

    // Filter out user's own crypto offers
    let cryptoCount = 0;
    if (cryptoOffersData) {
      cryptoCount = cryptoOffersData.filter((result) => {
        if (result.status !== 'success' || !result.result) return false;

        const data = result.result;
        const isArray = Array.isArray(data);

        let offerData;
        if (isArray) {
          const arr = data as readonly unknown[];
          offerData = {
            lender: arr[1],
            status: arr[12],
          };
        } else {
          offerData = data as Record<string, unknown>;
        }

        // Filter out user's own offers, empty offers, and non-pending offers
        if (!offerData.lender || offerData.lender === '0x0000000000000000000000000000000000000000') {
          return false;
        }
        if ((offerData.lender as string).toLowerCase() === address.toLowerCase()) {
          return false;
        }
        if (Number(offerData.status) !== LoanRequestStatus.PENDING) {
          return false;
        }

        return true;
      }).length;
    }

    // Filter out user's own fiat offers
    let fiatCount = 0;
    if (fiatOffersData) {
      fiatCount = fiatOffersData.filter((result) => {
        if (result.status !== 'success' || !result.result) return false;

        const data = result.result;
        const isArray = Array.isArray(data);

        let offerData;
        if (isArray) {
          const arr = data as readonly unknown[];
          offerData = {
            lender: arr[1],
            status: arr[9],
          };
        } else {
          offerData = data as Record<string, unknown>;
        }

        // Filter out user's own offers and empty offers
        if (!offerData.lender || offerData.lender === '0x0000000000000000000000000000000000000000') {
          return false;
        }
        if ((offerData.lender as string).toLowerCase() === address.toLowerCase()) {
          return false;
        }
        // For fiat offers, status 0 = ACTIVE
        if (Number(offerData.status) !== 0) {
          return false;
        }

        return true;
      }).length;
    }

    return cryptoCount + fiatCount;
  }, [isConnected, address, cryptoOffersData, fiatOffersData, cryptoOfferCount, fiatOfferIds.length]);

  // Get supported assets from Configuration contract
  const { supportedTokens, isLoading: isLoadingSupportedTokens } = useSupportedAssets();

  // Use supported tokens or fallback to TOKEN_LIST
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  // Fetch balances for all supported tokens
  const balanceContracts = availableTokens.map((token) => ({
    address: token.address,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  }));

  const { data: balancesData, isLoading: isLoadingBalances } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: !!address && availableTokens.length > 0,
    },
  });

  // Build collateral assets with real balances
  const collateralAssets: CollateralAsset[] = useMemo(() => {
    return availableTokens.map((token, index) => {
      const balanceResult = balancesData?.[index];
      const rawBalance = balanceResult?.status === 'success' ? (balanceResult.result as bigint) : BigInt(0);
      const formattedBalance = formatUnits(rawBalance, token.decimals);
      const hasBalance = rawBalance > BigInt(0);

      return {
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        decimals: token.decimals,
        balance: parseFloat(formattedBalance).toFixed(4),
        rawBalance,
        hasBalance,
        icon: token.icon,
      };
    });
  }, [availableTokens, balancesData]);

  // Filter stablecoins for borrowing (USDC, USDT, DAI, etc.)
  // For cross-chain: stablecoins come from the TARGET chain (funds are received there)
  const stablecoinSymbols = ['USDC', 'USDT', 'DAI'];
  const stablecoins: StablecoinAsset[] = useMemo(() => {
    const tokenSource = isCrossChain ? getTokenListForChain(targetChainId) : availableTokens;
    return tokenSource
      .filter(token => stablecoinSymbols.includes(token.symbol))
      .map(token => ({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        decimals: token.decimals,
        icon: token.icon,
      }));
  }, [availableTokens, isCrossChain, targetChainId]);

  // Sync selectedBorrowAsset with selectedStablecoin
  useEffect(() => {
    if (selectedStablecoin) {
      setSelectedBorrowAsset({
        symbol: selectedStablecoin.symbol,
        name: selectedStablecoin.name,
        address: selectedStablecoin.address,
        decimals: selectedStablecoin.decimals,
        icon: selectedStablecoin.icon,
        type: 'crypto',
      });
    } else {
      setSelectedBorrowAsset(null);
    }
  }, [selectedStablecoin]);

  // Get collateral price
  const collateralPriceHook = useTokenPrice(selectedCollateral?.address as Address | undefined);
  const collateralPrice = collateralPriceHook.price;

  // Get borrow asset price
  // For cross-chain: borrow asset is on the target chain, but price feeds are on the source chain.
  // Look up the source chain's equivalent token by symbol for the price query.
  const borrowPriceAddress = useMemo(() => {
    if (!selectedBorrowAsset) return undefined;
    if (!isCrossChain) return selectedBorrowAsset.address as Address;
    // Find the same-symbol token on the source chain
    const sourceToken = availableTokens.find(
      t => t.symbol.toLowerCase() === selectedBorrowAsset.symbol.toLowerCase()
    );
    return sourceToken?.address as Address | undefined;
  }, [selectedBorrowAsset, isCrossChain, availableTokens]);
  const borrowPriceHook = useTokenPrice(borrowPriceAddress);
  const borrowPrice = borrowPriceHook.price;

  // Get LTV from contract
  const { data: ltvBps, isLoading: isLoadingLTV } = useLTV(
    selectedCollateral?.address as Address | undefined,
    duration
  );

  // Get liquidation threshold from contract
  const { data: liquidationThresholdBps } = useLiquidationThreshold(
    selectedCollateral?.address as Address | undefined,
    duration
  );

  // Get exchange rate for selected fiat currency (for cash loans)
  const { data: fiatExchangeRate } = useExchangeRate(
    borrowType === 'cash' && selectedBorrowAsset ? selectedBorrowAsset.symbol : ''
  );

  // Calculate collateral value in USD
  const collateralValue = useMemo(() => {
    if (!selectedCollateral || !collateralAmount || !collateralPrice) return 0;
    const amount = parseFloat(collateralAmount);
    if (isNaN(amount) || amount <= 0) return 0;
    // Price has 8 decimals from Chainlink
    return (amount * Number(collateralPrice)) / 1e8;
  }, [selectedCollateral, collateralAmount, collateralPrice]);

  // Calculate max LTV percentage from contract
  const maxLTVPercent = ltvBps ? Number(ltvBps) / 100 : 0;

  // Liquidation threshold percentage (available for future use)
  const _liquidationThreshold = liquidationThresholdBps ? Number(liquidationThresholdBps) / 100 : 85;
  void _liquidationThreshold; // Suppress unused variable warning

  // Minimum LTV - use 1% if contract doesn't return a minimum
  const minLTVPercent = 1;

  // Calculate fiat borrow amount with exchange rate conversion
  const fiatBorrowAmount = useMemo(() => {
    if (borrowType !== 'cash' || !selectedBorrowAsset || !collateralValue || collateralValue <= 0 || selectedLTV <= 0) {
      return { amount: 0, formatted: '' };
    }

    // Calculate USD value based on LTV
    const borrowUSDValue = (collateralValue * selectedLTV) / 100;

    // For USD, no conversion needed
    if (selectedBorrowAsset.symbol === 'USD') {
      return {
        amount: borrowUSDValue,
        formatted: `${getCurrencySymbol('USD')}${borrowUSDValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      };
    }

    // Convert USD to target currency using exchange rate
    if (!fiatExchangeRate || fiatExchangeRate === BigInt(0)) {
      return { amount: 0, formatted: '' };
    }

    // Exchange rate is units per 1 USD (scaled by 1e8)
    // So: fiatAmount = borrowUSDValue * exchangeRate / 1e8
    const borrowUSDCents = BigInt(Math.floor(borrowUSDValue * 100));
    const fiatAmountCents = convertFromUSDCents(borrowUSDCents, fiatExchangeRate as bigint);
    const fiatAmount = Number(fiatAmountCents) / 100;

    return {
      amount: fiatAmount,
      formatted: `${getCurrencySymbol(selectedBorrowAsset.symbol)}${fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
  }, [borrowType, selectedBorrowAsset, collateralValue, selectedLTV, fiatExchangeRate]);

  // Initialize/reset selectedLTV when maxLTV changes
  useEffect(() => {
    if (maxLTVPercent > 0) {
      setSelectedLTV(maxLTVPercent);
    }
  }, [maxLTVPercent]);

  // Calculate borrow amount based on selected LTV using BigInt (like working page)
  const { borrowAmount, borrowAmountUSD, isCalculatingLoan: _isCalculatingLoan } = useMemo(() => {
    const isCalculating = collateralPriceHook.isLoading || borrowPriceHook.isLoading || isLoadingLTV;

    if (!collateralAmount || parseFloat(collateralAmount) <= 0 || !collateralPrice || !borrowPrice || !selectedBorrowAsset || selectedLTV <= 0) {
      return { borrowAmount: 0, borrowAmountUSD: 0, isCalculatingLoan: isCalculating };
    }

    try {
      const collateralDecimals = selectedCollateral?.decimals || 18;
      const borrowDecimals = selectedBorrowAsset?.decimals || 6;

      const collateralAmountBigInt = parseUnits(collateralAmount, collateralDecimals);

      // Calculate collateral value in USD (8 decimals from Chainlink)
      const collateralValueUSD = (collateralAmountBigInt * (collateralPrice as bigint)) / BigInt(10 ** collateralDecimals);

      // Apply selected LTV (convert percentage to basis points)
      const selectedLTVBps = BigInt(Math.floor(selectedLTV * 100));
      const loanUSD = (collateralValueUSD * selectedLTVBps) / BigInt(10000);

      // Convert to borrow token amount
      const borrowAmountCalc = (loanUSD * BigInt(10 ** borrowDecimals)) / (borrowPrice as bigint);

      // Format for display
      const borrowFormatted = formatUnits(borrowAmountCalc, borrowDecimals);
      const borrowNum = parseFloat(borrowFormatted);

      // Calculate USD value
      const borrowUSD = (borrowNum * Number(borrowPrice)) / 1e8;

      return {
        borrowAmount: borrowNum,
        borrowAmountUSD: borrowUSD,
        isCalculatingLoan: false,
      };
    } catch (error) {
      console.error('Error calculating borrow amount:', error);
      return { borrowAmount: 0, borrowAmountUSD: 0, isCalculatingLoan: false };
    }
  }, [collateralAmount, collateralPrice, borrowPrice, selectedBorrowAsset, selectedLTV, selectedCollateral, collateralPriceHook.isLoading, borrowPriceHook.isLoading, isLoadingLTV]);
  void _isCalculatingLoan; // Suppress unused variable warning

  // Step validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: // Stablecoin selection (what to borrow)
        return selectedStablecoin !== null;
      case 2: // Collateral selection
        return selectedCollateral !== null;
      case 3: // Amount input + LTV
        if (!collateralAmount || !selectedCollateral) return false;
        const numAmount = parseFloat(collateralAmount);
        const maxBalance = parseFloat(selectedCollateral.balance.replace(/,/g, ''));
        return numAmount > 0 && numAmount <= maxBalance && selectedLTV > 0 && selectedLTV <= maxLTVPercent;
      case 4: // Interest rate and duration
        return duration > 0 && interestRate >= 5 && interestRate <= 15;
      case 5: // Review
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedStablecoin, selectedCollateral, collateralAmount, selectedLTV, maxLTVPercent, duration, interestRate]);

  // Navigation
  const goNext = () => {
    if (currentStep < STEPS.length && canProceed) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle collateral selection
  const handleCollateralSelect = (asset: CollateralAsset) => {
    setSelectedCollateral(asset);
  };

  // Is form valid for submission
  const isFormValid = useMemo(() => {
    return (
      selectedStablecoin !== null &&
      selectedCollateral !== null &&
      collateralAmount !== '' &&
      parseFloat(collateralAmount) > 0 &&
      selectedBorrowAsset !== null &&
      selectedLTV > 0 &&
      selectedLTV <= maxLTVPercent &&
      duration > 0 &&
      borrowAmount > 0
    );
  }, [selectedStablecoin, selectedCollateral, collateralAmount, selectedBorrowAsset, selectedLTV, maxLTVPercent, borrowAmount, duration]);

  // Get current step info
  const currentStepInfo = STEPS.find(s => s.id === currentStep);

  // Loading states
  const isLoadingAssets = isLoadingSupportedTokens || isLoadingBalances;

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        // Step 1: Select stablecoin to borrow
        return (
          <div className="space-y-6">
            {/* Available Offers Banner */}
            {totalAvailableOffers > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <Link href="/marketplace?tab=lending_offers">
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-500/10 to-primary-500/10 border border-accent-500/30 hover:border-accent-500/50 transition-all duration-300 group cursor-pointer">
                    <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent-400 group-hover:scale-110 transition-transform" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-accent-400 mb-1">
                        {totalAvailableOffers} lender offer{totalAvailableOffers !== 1 ? 's' : ''} available
                      </p>
                      <p className="text-xs text-white/60">
                        Browse the marketplace to find competitive rates from lenders ready to fund your loan
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-accent-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </div>
                </Link>
              </motion.div>
            )}

            {/* Target Chain Selector */}
            {targetChainOptions.length > 1 && (
              <div className="max-w-2xl mx-auto">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-primary-400" />
                    <span className="text-sm font-medium text-white/70">Receive funds on</span>
                  </div>
                  <div className="flex gap-2">
                    {targetChainOptions.map(chain => (
                      <button
                        key={chain.id}
                        onClick={() => setTargetChainId(chain.id)}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          targetChainId === chain.id
                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {chain.name}
                        {chain.id === selectedNetwork.id && (
                          <span className="text-xs opacity-60 ml-1">(current)</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {isCrossChain && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs text-accent-400 mt-2 flex items-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      Cross-chain: collateral locked on {selectedNetwork.name}, funds received on {getChainById(targetChainId)?.name}
                    </motion.p>
                  )}
                </div>
              </div>
            )}

            <StablecoinSelector
              selected={selectedStablecoin}
              onSelect={setSelectedStablecoin}
              assets={stablecoins}
              isLoading={isLoadingSupportedTokens}
            />
          </div>
        );
      case 2:
        // Step 2: Select collateral asset
        return (
          <div className="space-y-6">
            {/* Available Offers Banner */}
            {totalAvailableOffers > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <Link href="/marketplace?tab=lending_offers">
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-500/10 to-primary-500/10 border border-accent-500/30 hover:border-accent-500/50 transition-all duration-300 group cursor-pointer">
                    <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent-400 group-hover:scale-110 transition-transform" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-accent-400 mb-1">
                        {totalAvailableOffers} lender offer{totalAvailableOffers !== 1 ? 's' : ''} available
                      </p>
                      <p className="text-xs text-white/60">
                        Skip the wait - match with a lender instantly on the marketplace
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-accent-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </div>
                </Link>
              </motion.div>
            )}

            <CollateralSelector
              selected={selectedCollateral}
              onSelect={handleCollateralSelect}
              assets={collateralAssets.filter(a => a.symbol !== selectedStablecoin?.symbol)}
              isLoading={isLoadingAssets}
            />

            {/* Faucet Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400 max-w-2xl mx-auto"
            >
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>
                Need testnet tokens?{' '}
                <Link href="/faucet" className="font-semibold underline underline-offset-2 hover:text-blue-300 transition-colors">
                  Visit our Faucet page
                </Link>
                {' '}to get free testnet tokens for collateral.
              </p>
            </motion.div>
          </div>
        );
      case 3:
        // Step 3: Enter collateral amount + LTV
        return (
          <div className="space-y-6">
            <CollateralAmountInput
              asset={selectedCollateral}
              amount={collateralAmount}
              onAmountChange={setCollateralAmount}
              usdValue={collateralValue}
            />
            {/* LTV Slider */}
            {collateralAmount && parseFloat(collateralAmount) > 0 && (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 max-w-xl mx-auto">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white/70 text-sm">Loan-to-Value (LTV)</span>
                  <span className="text-lg font-semibold text-primary-400">{selectedLTV.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={minLTVPercent}
                  max={maxLTVPercent}
                  step={1}
                  value={selectedLTV}
                  onChange={(e) => setSelectedLTV(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:shadow-primary-500/30"
                />
                <div className="flex justify-between text-xs text-white/40 mt-2">
                  <span>{minLTVPercent}%</span>
                  <span>Max: {maxLTVPercent.toFixed(0)}%</span>
                </div>
                {/* Borrow amount preview */}
                {borrowAmount > 0 && (
                  <div className="mt-4 p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                    <p className="text-sm text-white/70">You will receive:</p>
                    <p className="text-xl font-bold text-primary-400">
                      {borrowAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedStablecoin?.symbol}
                    </p>
                    <p className="text-xs text-white/50">~${borrowAmountUSD.toFixed(2)} USD</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <LoanTerms
            borrowAsset={selectedBorrowAsset}
            interestRate={interestRate}
            duration={duration}
            customDate={customDate}
            onInterestRateChange={setInterestRate}
            onDurationChange={setDuration}
            onCustomDateChange={setCustomDate}
          />
        );
      case 5:
        // Build price feeds info for stale warning
        // For fiat loans, only include collateral price feed (fiat currencies don't have on-chain price feeds)
        const priceFeeds = borrowType === 'cash'
          ? [
              {
                isStale: collateralPriceHook.isStale,
                priceFeedAddress: collateralPriceHook.priceFeedAddress,
                price: collateralPrice,
                tokenAddress: selectedCollateral?.address as Address | undefined,
                refetch: collateralPriceHook.refetch,
              },
            ]
          : [
              {
                isStale: collateralPriceHook.isStale,
                priceFeedAddress: collateralPriceHook.priceFeedAddress,
                price: collateralPrice,
                tokenAddress: selectedCollateral?.address as Address | undefined,
                refetch: collateralPriceHook.refetch,
              },
              {
                isStale: borrowPriceHook.isStale,
                priceFeedAddress: borrowPriceHook.priceFeedAddress,
                price: borrowPrice,
                tokenAddress: borrowPriceAddress,
                refetch: borrowPriceHook.refetch,
              },
            ];

        return (
          <div className="space-y-6">
            {/* Cross-chain indicator */}
            {isCrossChain && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl mx-auto flex items-center gap-2 px-4 py-3 rounded-xl bg-accent-500/10 border border-accent-500/30 text-sm text-accent-400"
              >
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span>
                  Cross-chain request: Collateral on <strong>{selectedNetwork.name}</strong>, funds on <strong>{getChainById(targetChainId)?.name}</strong>
                </span>
              </motion.div>
            )}
            <QuotationPanel
              collateral={selectedCollateral}
              collateralAmount={collateralAmount}
              borrowAsset={selectedBorrowAsset}
              loanAmount={borrowAmount}
              interestRate={interestRate}
              duration={duration}
              collateralValueUSD={collateralValue}
              ltvPercent={maxLTVPercent}
              selectedLTV={selectedLTV}
              borrowType={borrowType}
              fiatAmountFormatted={borrowType === 'cash' ? fiatBorrowAmount.formatted : undefined}
              fiatAmount={borrowType === 'cash' ? fiatBorrowAmount.amount : undefined}
            />
            <PriceStaleWarning priceFeeds={priceFeeds} />
            <BorrowSubmitCTA
              collateral={selectedCollateral}
              collateralAmount={collateralAmount}
              borrowAsset={selectedBorrowAsset}
              loanAmount={borrowAmount}
              interestRate={interestRate}
              duration={duration}
              isValid={isFormValid}
              borrowType={borrowType}
              fiatAmountCents={borrowType === 'cash' ? BigInt(Math.floor(fiatBorrowAmount.amount * 100)) : undefined}
              fiatCurrency={borrowType === 'cash' ? selectedBorrowAsset?.symbol : undefined}
              targetChainId={isCrossChain ? targetChainId : undefined}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // Show connect wallet message if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-navy-900 pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-white/60">
            Please connect your wallet to start borrowing against your crypto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 pt-20 pb-8 px-4 sm:px-5 md:px-10 lg:px-20 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header with Step Counter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          {/* Step Counter Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-4">
            <span className="text-primary-400 font-semibold">Step {currentStep}</span>
            <span className="text-white/40">of {STEPS.length}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            Borrow against your{' '}
            <span className="text-primary-400">crypto</span>
          </h1>

          {/* Subtitle - current step description */}
          <p className="text-sm sm:text-base text-white/60 max-w-2xl mx-auto">
            {currentStepInfo?.description}
          </p>
        </motion.div>

        {/* Step Content */}
        <div className="min-h-[280px] sm:min-h-[320px] flex items-center justify-center py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between gap-3 max-w-xl mx-auto mt-4"
        >
          {/* Back Button */}
          <div className="w-20 sm:w-28 flex-shrink-0">
            {currentStep > 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Button
                  variant="ghost"
                  size="md"
                  onClick={goBack}
                  icon={<ArrowLeft className="w-4 h-4" />}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  Back
                </Button>
              </motion.div>
            )}
          </div>

          {/* Continue Button (not shown on review step) */}
          <div className="flex-1 min-w-0 max-w-xs">
            {currentStep < STEPS.length && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!canProceed}
                onClick={goNext}
                icon={<ArrowRight className="w-5 h-5" />}
                iconPosition="right"
              >
                Continue
              </Button>
            )}
          </div>

          {/* Spacer for alignment */}
          <div className="w-20 sm:w-28 flex-shrink-0" />
        </motion.div>

        {/* Microcopy */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-white/30 text-xs mt-4 px-2"
        >
          Lock your crypto as collateral and receive funds. Your crypto is returned after full repayment.
        </motion.p>
      </div>
    </div>
  );
}
