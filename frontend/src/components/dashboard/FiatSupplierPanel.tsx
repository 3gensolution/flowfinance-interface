'use client';

import { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
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
  getCurrencySymbol,
} from '@/hooks/useFiatOracle';
import {
  UserPlus,
  Shield,
  DollarSign,
  CheckCircle,
  Clock,
  Building2,
  User,
  Loader2,
  ExternalLink,
  ArrowRight,
  Banknote,
  Info,
  ChevronRight,
} from 'lucide-react';

interface GeneratedLinkInfo {
  url: string;
  expiresAt: string;
  type: 'verification' | 'deposit' | 'withdraw';
}

type ActionState = 'idle' | 'link_ready';

export function FiatSupplierPanel() {
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

  // Track generated link and action state
  const [generatedLink, setGeneratedLink] = useState<GeneratedLinkInfo | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [currentAction, setCurrentAction] = useState<'verification' | 'deposit' | 'withdraw' | null>(null);

  // Fiat Oracle data
  const { data: supportedCurrencies, isLoading: isLoadingCurrencies } = useGetSupportedCurrencies();
  const { data: supplierBalances, isLoading: isLoadingBalances } = useSupplierBalances(address);

  // Filter currencies with balances
  const currenciesWithBalances = (supportedCurrencies as string[] || [])
    .map(currency => ({
      currency,
      balance: supplierBalances?.[currency] || BigInt(0),
    }))
    .sort((a, b) => Number(b.balance - a.balance));

  // Format expiration time
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

  // Handle generate link (Step 1 of two-step flow)
  const handleGenerateLink = (type: 'verification' | 'deposit' | 'withdraw') => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setCurrentAction(type);

    generateLinkMutation(
      { walletAddress: address },
      {
        onSuccess: (data) => {
          const response = data?.data as GenerateLinkResponse | undefined;
          if (response?.data?.url) {
            setGeneratedLink({
              url: response.data.url,
              expiresAt: response.data.expiresAt,
              type,
            });
            setActionState('link_ready');
            toast.success('Your link is ready!');
          }
        },
        onError: (error) => {
          console.error('Failed to generate link:', error);
          toast.error('Failed to generate link. Please try again.');
          setCurrentAction(null);
        },
      }
    );
  };

  // Handle continue to external link (Step 2 of two-step flow)
  const handleContinueToLink = () => {
    if (generatedLink?.url) {
      window.open(generatedLink.url, '_blank', 'noopener,noreferrer');
      setTimeout(() => {
        setActionState('idle');
        setGeneratedLink(null);
        setCurrentAction(null);
      }, 1000);
    }
  };

  const resetForm = () => {
    setSupplierName('');
    setBusinessRegNumber('');
    setSupplierType(SupplierType.INDIVIDUAL);
  };

  const resetActionState = () => {
    setActionState('idle');
    setGeneratedLink(null);
    setCurrentAction(null);
  };

  // Get status info for collapsed header
  const getStatusInfo = () => {
    if (isLoadingSupplier) return { text: 'Loading...', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
    if (isVerified) return { text: 'Verified', color: 'text-green-400', bgColor: 'bg-green-500/10', badge: 'bg-green-500/20 text-green-400' };
    if (isRegistered) return { text: 'Pending Verification', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-400' };
    return { text: 'Not Registered', color: 'text-primary-400', bgColor: 'bg-primary-500/10' };
  };

  const statusInfo = getStatusInfo();

  // Collapsed Header Component
  const CollapsedHeader = () => (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
          <Banknote className={`w-5 h-5 ${statusInfo.color}`} />
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-white">Fiat Supplier</h3>
          <p className="text-xs text-gray-400">
            {isLoadingSupplier ? 'Loading...' :
             isVerified ? 'Manage your fiat funds' :
             isRegistered ? 'Complete verification to start' :
             'Become a liquidity provider'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {statusInfo.badge && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.badge}`}>
            {isVerified ? 'Verified' : isRegistered ? 'Pending' : ''}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-8"
    >
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
            <div className="glass-card p-6 rounded-t-none border-t-0 mt-[-1px]">
              {/* Loading State */}
              {isLoadingSupplier && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                </div>
              )}

              {/* Not Registered State */}
              {!isLoadingSupplier && !isRegistered && (
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary-500/10">
                    <UserPlus className="w-6 h-6 text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Become a Fiat Supplier</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Supply cash, earn interest, and support borrowers.
                    </p>
                    <div className="flex flex-wrap gap-4 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Shield className="w-3.5 h-3.5 text-green-400" />
                        <span>Collateral Protected</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Earn Interest</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => setRegisterModalOpen(true)}
                      icon={<UserPlus className="w-4 h-4" />}
                      size="sm"
                    >
                      Register as Supplier
                    </Button>
                  </div>
                </div>
              )}

              {/* Pending Verification State */}
              {!isLoadingSupplier && isRegistered && !isVerified && (
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-yellow-500/10">
                    <Clock className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">Pending Verification</h3>
                    </div>

                    {supplier?.registeredAt && Number(supplier.registeredAt) > 0 && (
                      <p className="text-xs text-gray-500 mb-3">
                        Registered: {new Date(Number(supplier.registeredAt) * 1000).toLocaleDateString()}
                      </p>
                    )}

                    <div className="p-3 bg-white/5 rounded-lg mb-4">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-400">
                          Complete identity verification with our trusted partner.
                        </p>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {actionState === 'idle' ? (
                        <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Button
                            onClick={() => handleGenerateLink('verification')}
                            loading={isGeneratingLink && currentAction === 'verification'}
                            icon={<ExternalLink className="w-4 h-4" />}
                            size="sm"
                          >
                            Generate Verification Link
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div key="continue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                          <p className="text-sm text-green-400">Your verification link is ready.</p>
                          <div className="flex gap-2">
                            <Button onClick={handleContinueToLink} icon={<ArrowRight className="w-4 h-4" />} size="sm" className="bg-green-600 hover:bg-green-700">
                              Continue
                            </Button>
                            <Button variant="ghost" onClick={resetActionState} size="sm">Cancel</Button>
                          </div>
                          {generatedLink?.expiresAt && (
                            <p className="text-xs text-gray-500">{formatExpirationTime(generatedLink.expiresAt)}</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Verified State */}
              {!isLoadingSupplier && isVerified && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-green-500/10">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{supplier?.name || 'Supplier'}</h3>
                      <p className="text-xs text-gray-400">
                        {supplier?.supplierType === 1 ? 'Business' : 'Individual'}
                      </p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-400">Loans</p>
                      <p className="text-sm font-semibold">{supplier?.totalLoansProvided?.toString() || '0'}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-400">Volume</p>
                      <p className="text-sm font-semibold">{supplier?.totalVolumeProvided ? formatEther(supplier.totalVolumeProvided) : '0'}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-400">Rating</p>
                      <p className="text-sm font-semibold">
                        {supplier?.numberOfRatings && Number(supplier.numberOfRatings) > 0 ? `${(Number(supplier.averageRating) / 100).toFixed(1)}/5` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Fiat Balances */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-gray-400">Balances</h4>
                      {(isLoadingCurrencies || isLoadingBalances) && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                    </div>
                    <div className="bg-white/5 rounded-lg border border-gray-700/50 max-h-32 overflow-y-auto">
                      {currenciesWithBalances.length > 0 ? (
                        <div className="divide-y divide-gray-700/50">
                          {currenciesWithBalances.map(({ currency, balance }) => (
                            <div key={currency} className="flex items-center justify-between px-3 py-2">
                              <span className="text-sm text-white">{currency}</span>
                              <span className={`text-sm font-medium ${balance > BigInt(0) ? 'text-green-400' : 'text-gray-500'}`}>
                                {getCurrencySymbol(currency)}{(Number(balance) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-center text-xs text-gray-500">No currencies</div>
                      )}
                    </div>
                  </div>

                  {/* Deposit/Withdraw Actions */}
                  <AnimatePresence mode="wait">
                    {actionState === 'idle' ? (
                      <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
                        <Button onClick={() => handleGenerateLink('deposit')} loading={isGeneratingLink && currentAction === 'deposit'} size="sm" className="flex-1">
                          Deposit
                        </Button>
                        <Button variant="secondary" onClick={() => handleGenerateLink('withdraw')} loading={isGeneratingLink && currentAction === 'withdraw'} size="sm" className="flex-1">
                          Withdraw
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div key="continue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                        <p className="text-sm text-green-400">Your link is ready.</p>
                        <div className="flex gap-2">
                          <Button onClick={handleContinueToLink} icon={<ArrowRight className="w-4 h-4" />} size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
                            Continue to {currentAction === 'deposit' ? 'Deposit' : 'Withdraw'}
                          </Button>
                          <Button variant="ghost" onClick={resetActionState} size="sm">Cancel</Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Trust Message */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <Shield className="w-3 h-3" />
                    <span>Fiat transactions handled by our licensed partner.</span>
                  </div>
                </div>
              )}
            </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Supplier Type</label>
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

          {supplierType === SupplierType.BUSINESS && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Business Registration Number</label>
              <input
                type="text"
                value={businessRegNumber}
                onChange={(e) => setBusinessRegNumber(e.target.value)}
                placeholder="Enter registration number"
                className="input-field w-full"
              />
            </div>
          )}

          <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
            <p className="text-xs text-gray-400">
              After registration, you&apos;ll complete identity verification with our trusted partner.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setRegisterModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleRegister} loading={isRegistering} disabled={isRegistering || !supplierName.trim() || !address} className="flex-1">
              {isSimulating ? 'Simulating...' : isRegistering ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
