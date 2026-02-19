'use client';

import { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  useSupplierDetails,
  useRegisterSupplier,
  SupplierType,
} from '@/hooks/useSupplier';
import { useGenerateLinkApi } from '@/hooks/useGenerateLink';
import { GenerateLinkResponse } from '@/services/mutation/generate-link';
import {
  useGetSupportedCurrencies,
  useSupplierBalances,
  getCurrencyName,
  formatCurrency,
} from '@/hooks/useFiatOracle';
import {
  UserPlus,
  Shield,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Building2,
  User,
  Loader2,
  ExternalLink,
  Wallet,
  ChevronRight,
  Banknote,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface GeneratedLinkInfo {
  url: string;
  expiresAt: string;
}

export function SupplierSection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { supplier, isRegistered, isVerified, isLoading: isLoadingSupplier } = useSupplierDetails(address);
  const { registerSupplier, isPending: isRegistering, isSimulating } = useRegisterSupplier();

  // Collapsed state - default to collapsed
  const [isExpanded, setIsExpanded] = useState(false);

  // Modal states
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  // Form state for registration
  const [supplierType, setSupplierType] = useState<SupplierType>(SupplierType.INDIVIDUAL);
  const [supplierName, setSupplierName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');

  // Generate link API hook
  const {
    mutate: generateLinkMutation,
    isPending: isGeneratingLink
  } = useGenerateLinkApi();

  // Track generated link
  const [generatedLink, setGeneratedLink] = useState<GeneratedLinkInfo | null>(null);

  // Fiat Oracle data - supported currencies and balances
  const { data: supportedCurrencies, isLoading: isLoadingCurrencies } = useGetSupportedCurrencies();
  const { data: supplierBalances, isLoading: isLoadingBalances } = useSupplierBalances(address);

  // Filter currencies with balances and sort by balance (highest first)
  const currenciesWithBalances = (supportedCurrencies as string[] || [])
    .map(currency => ({
      currency,
      balance: supplierBalances?.[currency] || BigInt(0),
    }))
    .sort((a, b) => Number(b.balance - a.balance));

  // Format expiration time in human-readable format
  const formatExpirationTime = (expiresAt: string | undefined) => {
    if (!expiresAt) return null;
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expirationDate.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }
    return `Expires in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  };

  // Handle registration
  const handleRegister = async () => {
    if (!supplierName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    const toastId = toast.loading('Simulating transaction...');
    try {
      toast.loading('Registering as supplier...', { id: toastId });
      const hash = await registerSupplier(
        supplierType,
        supplierName,
        businessRegNumber
      );
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast.success('Registered as supplier! Awaiting verification.', { id: toastId });
      setRegisterModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = (error as Error)?.message || 'Failed to register';
      toast.error(errorMessage, { id: toastId });
    }
  };

  // Handle generate link
  const handleGenerateLink = () => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    generateLinkMutation(
      { walletAddress: address },
      {
        onSuccess: (data) => {
          const response = data?.data as GenerateLinkResponse | undefined;
          if (response?.data?.url) {
            setGeneratedLink({
              url: response.data.url,
              expiresAt: response.data.expiresAt,
            });
            toast.success('Link generated successfully!');
          }
        },
        onError: (error) => {
          console.error('Failed to generate link:', error);
          toast.error('Failed to generate link. Please try again.');
        },
      }
    );
  };

  // Handle continue to external link
  const handleContinueToLink = () => {
    if (generatedLink?.url) {
      window.open(generatedLink.url, '_blank', 'noopener,noreferrer');
    }
  };

  const resetForm = () => {
    setSupplierName('');
    setBusinessRegNumber('');
    setSupplierType(SupplierType.INDIVIDUAL);
  };

  // Collapsed toggle bar
  const CollapsedHeader = () => (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isVerified ? 'bg-green-500/10' : isRegistered ? 'bg-yellow-500/10' : 'bg-primary-500/10'}`}>
          <Banknote className={`w-5 h-5 ${isVerified ? 'text-green-400' : isRegistered ? 'text-yellow-400' : 'text-primary-400'}`} />
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-white">Fiat Supplier</h3>
          <p className="text-xs text-gray-400">
            {isLoadingSupplier ? 'Loading...' : isVerified ? 'Verified - Manage funds' : isRegistered ? 'Pending verification' : 'Become a liquidity provider'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isVerified && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            Verified
          </span>
        )}
        {isRegistered && !isVerified && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            Pending
          </span>
        )}
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        </motion.div>
      </div>
    </button>
  );

  // Loading state inside expanded content
  if (isLoadingSupplier) {
    return (
      <div className="space-y-0">
        <CollapsedHeader />
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Card className="text-center py-8 rounded-t-none border-t-0">
                <Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Not registered - show registration CTA
  if (!isRegistered) {
    return (
      <div className="space-y-0">
        <CollapsedHeader />
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Card className="border-primary-500/20 rounded-t-none border-t-0">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary-500/10">
                    <UserPlus className="w-6 h-6 text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">Become a Fiat Liquidity Supplier</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Register as a supplier to provide fiat liquidity to borrowers.
                      Earn interest on your fiat capital while helping bridge crypto and traditional finance.
                    </p>
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Shield className="w-3.5 h-3.5 text-green-400" />
                        <span>Collateral Protected</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Earn Interest</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <CheckCircle className="w-3.5 h-3.5 text-primary-400" />
                        <span>KYC Verified</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => setRegisterModalOpen(true)}
                      icon={<UserPlus className="w-4 h-4" />}
                    >
                      Register as Supplier
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Registration Modal */}
        <Modal
          isOpen={registerModalOpen}
          onClose={() => setRegisterModalOpen(false)}
          title="Register as Supplier"
          size="lg"
        >
          <div className="space-y-4">
            {/* Supplier Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Supplier Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSupplierType(SupplierType.INDIVIDUAL)}
                  className={`p-3 rounded-lg border transition-colors flex items-center gap-2 ${
                    supplierType === SupplierType.INDIVIDUAL
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-gray-700 bg-white/5 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Individual</span>
                </button>
                <button
                  onClick={() => setSupplierType(SupplierType.BUSINESS)}
                  className={`p-3 rounded-lg border transition-colors flex items-center gap-2 ${
                    supplierType === SupplierType.BUSINESS
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-gray-700 bg-white/5 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Business</span>
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {supplierType === SupplierType.BUSINESS ? 'Business Name' : 'Full Name'}
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder={supplierType === SupplierType.BUSINESS ? 'Enter business name' : 'Enter your name'}
                className="input-field w-full"
              />
            </div>

            {/* Business Registration Number (optional for individuals) */}
            {supplierType === SupplierType.BUSINESS && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Registration Number
                </label>
                <input
                  type="text"
                  value={businessRegNumber}
                  onChange={(e) => setBusinessRegNumber(e.target.value)}
                  placeholder="Enter registration number"
                  className="input-field w-full"
                />
              </div>
            )}

            {/* Info */}
            <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
              <p className="text-xs text-gray-400">
                After registration, you will be redirected to complete KYC verification
                with our partner. Once verified, you can start providing fiat liquidity.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setRegisterModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRegister}
                loading={isRegistering}
                disabled={isRegistering || !supplierName.trim() || !address}
                className="flex-1"
              >
                {isSimulating ? 'Simulating...' : isRegistering ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // Registered - show supplier status
  return (
    <div className="space-y-0">
      <CollapsedHeader />
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className={`rounded-t-none border-t-0 ${isVerified ? 'border-green-500/20' : 'border-yellow-500/20'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isVerified ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                    {isVerified ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{supplier?.name || 'Supplier'}</h3>
                    <p className="text-xs text-gray-400">
                      {isVerified ? 'Verified Supplier' : 'Pending Verification'}
                      {' '}&middot;{' '}
                      {supplier?.supplierType === 1 ? 'Business' : 'Individual'}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isVerified
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {isVerified ? 'Verified' : 'Pending'}
                </span>
              </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400">Loans Provided</p>
            <p className="text-sm font-semibold">
              {supplier?.totalLoansProvided?.toString() || '0'}
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400">Total Volume</p>
            <p className="text-sm font-semibold">
              {supplier?.totalVolumeProvided ? formatEther(supplier.totalVolumeProvided) : '0'}
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400">Rating</p>
            <p className="text-sm font-semibold">
              {supplier?.numberOfRatings && Number(supplier.numberOfRatings) > 0
                ? `${(Number(supplier.averageRating) / 100).toFixed(1)}/5 (${supplier.numberOfRatings.toString()} reviews)`
                : 'No ratings yet'}
            </p>
          </div>
        </div>

        {/* Registration Date */}
        {supplier?.registeredAt && Number(supplier.registeredAt) > 0 && (
          <p className="text-xs text-gray-500 mb-4">
            Registered: {new Date(Number(supplier.registeredAt) * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        )}

        {/* Fiat Balances Section - Only show for verified suppliers */}
        {isVerified && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-300">Fiat Balances</h4>
              {(isLoadingCurrencies || isLoadingBalances) && (
                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
              )}
            </div>
            <div className="bg-white/5 rounded-lg border border-gray-700/50 max-h-40 overflow-y-auto">
              {currenciesWithBalances.length > 0 ? (
                <div className="divide-y divide-gray-700/50">
                  {currenciesWithBalances.map(({ currency, balance }) => (
                    <div
                      key={currency}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{currency}</span>
                        <span className="text-xs text-gray-500">{getCurrencyName(currency)}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${balance > BigInt(0) ? 'text-green-400' : 'text-gray-500'}`}>
                          {formatCurrency(balance, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-center text-xs text-gray-500">
                  {isLoadingCurrencies || isLoadingBalances ? (
                    'Loading balances...'
                  ) : (
                    'No currencies available'
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status message based on verification */}
        <div className={`p-3 rounded-lg mb-4 ${
          isVerified
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-yellow-500/10 border border-yellow-500/20'
        }`}>
          <p className={`text-sm ${isVerified ? 'text-green-400' : 'text-yellow-400'}`}>
            {generatedLink ? (
              isVerified
                ? 'Click Continue to fund or claim your fiat funds.'
                : 'Click Continue to complete your KYC verification.'
            ) : (
              isVerified
                ? 'Click below to fund or claim your fiat funds.'
                : 'Complete KYC verification to start providing fiat liquidity.'
            )}
          </p>
        </div>

        {/* Manage Funds Button */}
        {generatedLink ? (
          <div className="space-y-2">
            <Button
              onClick={handleContinueToLink}
              icon={<ExternalLink className="w-4 h-4" />}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Continue
            </Button>
            {generatedLink.expiresAt && (
              <p className="text-xs text-gray-400 text-center">
                {formatExpirationTime(generatedLink.expiresAt)}
              </p>
            )}
          </div>
        ) : (
          <Button
            onClick={handleGenerateLink}
            loading={isGeneratingLink}
            icon={<Wallet className="w-4 h-4" />}
            className="w-full"
          >
            {isVerified ? 'Fund / Claim' : 'Complete Verification'}
          </Button>
        )}

              {/* Additional info for unverified suppliers */}
              {!isVerified && !generatedLink && (
                <p className="text-xs text-gray-500 text-center mt-3">
                  KYC verification is required before you can fund or claim fiat.
                </p>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
