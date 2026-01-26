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
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function SupplierSection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { supplier, isRegistered, isVerified, isLoading: isLoadingSupplier } = useSupplierDetails(address);
  const { registerSupplier, isPending: isRegistering } = useRegisterSupplier();

  // Modal states
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [kycModalOpen, setKycModalOpen] = useState(false);

  // Form state for registration
  const [supplierType, setSupplierType] = useState<SupplierType>(SupplierType.INDIVIDUAL);
  const [supplierName, setSupplierName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');

  // KYC state
  const [kycAgreed, setKycAgreed] = useState(false);

  // Handle registration
  const handleRegister = async () => {
    if (!supplierName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const toastId = toast.loading('Registering as supplier...');
    try {
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
      toast.error('Failed to register. Please try again.', { id: toastId });
    }
  };

  // Handle KYC redirect
  const handleKycProceed = () => {
    toast.success('Redirecting to website for KYC verification...');
    setKycModalOpen(false);
    setKycAgreed(false);
  };

  const resetForm = () => {
    setSupplierName('');
    setBusinessRegNumber('');
    setSupplierType(SupplierType.INDIVIDUAL);
  };

  if (isLoadingSupplier) {
    return (
      <Card className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" />
      </Card>
    );
  }

  // Not registered - show registration CTA
  if (!isRegistered) {
    return (
      <>
        <Card className="border-primary-500/20">
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
                disabled={isRegistering || !supplierName.trim()}
                className="flex-1"
              >
                {isRegistering ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  // Registered - show supplier status
  return (
    <>
      <Card className={isVerified ? 'border-green-500/20' : 'border-yellow-500/20'}>
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

        {isVerified ? (
          <>
            {/* Stats for verified suppliers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
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
            </div>
            <p className="text-xs text-gray-500">
              You can now provide fiat liquidity in the marketplace.
            </p>
          </>
        ) : (
          <>
            {/* Supplier Details for unverified suppliers */}
            <div className="space-y-3 mb-4">
              {/* Registration Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-400">Registered</p>
                  <p className="text-sm font-semibold">
                    {supplier?.registeredAt
                      ? new Date(Number(supplier.registeredAt) * 1000).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-400">Reputation Score</p>
                  <p className="text-sm font-semibold">
                    {supplier?.reputationScore?.toString() || '50'}/100
                  </p>
                </div>
              </div>

              {/* Status Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-400">Status</p>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${supplier?.isActive ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                    {supplier?.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-400">KYC Status</p>
                  <p className="text-sm font-semibold text-yellow-400">
                    Pending
                  </p>
                </div>
              </div>

              {/* Business Registration (if business) */}
              {supplier?.supplierType === 1 && supplier?.businessRegistrationNumber && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-gray-400">Business Reg. Number</p>
                  <p className="text-sm font-semibold">{supplier.businessRegistrationNumber}</p>
                </div>
              )}

              {/* Staking Info */}
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-gray-400">Staked Amount</p>
                <p className="text-sm font-semibold">
                  {supplier?.stakedAmount ? formatEther(supplier.stakedAmount) : '0'} ETH
                </p>
              </div>
            </div>

            {/* CTA for unverified suppliers */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
              <p className="text-sm text-gray-400">
                Complete KYC verification to start providing fiat liquidity and earning interest.
              </p>
            </div>

            {/* Deposit and Withdraw buttons */}
            <div className="flex gap-3 mb-4">
              <Button
                onClick={() => setKycModalOpen(true)}
                icon={<ArrowDownToLine className="w-4 h-4" />}
                className="flex-1"
              >
                Deposit
              </Button>
              <Button
                variant="secondary"
                onClick={() => setKycModalOpen(true)}
                icon={<ArrowUpFromLine className="w-4 h-4" />}
                className="flex-1"
              >
                Withdraw
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              KYC verification is required before you can deposit or withdraw fiat liquidity.
            </p>
          </>
        )}
      </Card>

      {/* KYC Verification Modal */}
      <Modal
        isOpen={kycModalOpen}
        onClose={() => {
          setKycModalOpen(false);
          setKycAgreed(false);
        }}
        title="KYC Verification Required"
      >
        <div className="space-y-4">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-medium mb-1">Verification Needed</p>
                <p className="text-sm text-gray-400">
                  To deposit fiat or provide liquidity, you must complete KYC verification.
                  You will be redirected to a trusted third-party verification partner
                  to securely verify your identity.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">What you&apos;ll need:</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gray-500" />
                Government-issued photo ID
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gray-500" />
                Proof of address (utility bill or bank statement)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gray-500" />
                A selfie for identity verification
              </li>
            </ul>
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer p-3 bg-white/5 rounded-lg hover:bg-white/[0.07] transition-colors">
            <input
              type="checkbox"
              checked={kycAgreed}
              onChange={(e) => setKycAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-300">
              I understand that I will be redirected to a trusted third-party website to complete
              identity verification. I consent to sharing my personal information
              for KYC purposes and acknowledge this is required before I can provide fiat liquidity.
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setKycModalOpen(false);
                setKycAgreed(false);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleKycProceed}
              disabled={!kycAgreed}
              icon={<ExternalLink className="w-4 h-4" />}
              className="flex-1"
            >
              Proceed to KYC
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
