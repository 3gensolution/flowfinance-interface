'use client';

import { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  useSupplierDetails,
  useMinimumSupplierStake,
  useRegisterSupplier,
  useAddStake,
  useWithdrawStake,
  SupplierType,
} from '@/hooks/useSupplier';
import {
  UserPlus,
  Shield,
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  AlertCircle,
  Building2,
  User,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function SupplierSection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { supplier, isRegistered, isVerified, isLoading: isLoadingSupplier } = useSupplierDetails(address);
  const { data: minStake } = useMinimumSupplierStake();
  const { registerSupplier, isPending: isRegistering } = useRegisterSupplier();
  const { addStake, isPending: isDepositing } = useAddStake();
  const { withdrawStake, isPending: isWithdrawing } = useWithdrawStake();

  // Modal states
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // Form state for registration
  const [supplierType, setSupplierType] = useState<SupplierType>(SupplierType.INDIVIDUAL);
  const [supplierName, setSupplierName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');

  // KYC state
  const [kycAgreed, setKycAgreed] = useState(false);
  const [kycAction, setKycAction] = useState<'deposit' | 'withdraw'>('deposit');

  // Deposit/Withdraw amounts
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const minimumStake = minStake ? (minStake as bigint) : parseEther('0.01');

  // Handle registration
  const handleRegister = async () => {
    if (!supplierName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const stake = stakeAmount ? parseEther(stakeAmount) : minimumStake;
    if (stake < minimumStake) {
      toast.error(`Minimum stake is ${formatEther(minimumStake)} ETH`);
      return;
    }

    const toastId = toast.loading('Registering as supplier...');
    try {
      const hash = await registerSupplier(
        supplierType,
        supplierName,
        businessRegNumber,
        '', // kycDocumentHash - will be set during KYC verification
        stake
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

  // Handle deposit (add stake) - requires KYC first
  const handleDepositClick = () => {
    if (!isVerified) {
      setKycAction('deposit');
      setKycModalOpen(true);
      return;
    }
    setDepositModalOpen(true);
  };

  // Handle withdraw - requires KYC first
  const handleWithdrawClick = () => {
    if (!isVerified) {
      setKycAction('withdraw');
      setKycModalOpen(true);
      return;
    }
    setWithdrawModalOpen(true);
  };

  // Handle KYC agreement
  const handleKycProceed = () => {
    toast.success('Redirecting to website for KYC verification...');
    setKycModalOpen(false);
    setKycAgreed(false);
  };

  // Handle deposit submission
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const toastId = toast.loading('Processing deposit...');
    try {
      const amount = parseEther(depositAmount);
      const hash = await addStake(amount);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast.success('Deposit successful!', { id: toastId });
      setDepositModalOpen(false);
      setDepositAmount('');
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Deposit failed. Please try again.', { id: toastId });
    }
  };

  // Handle withdraw submission
  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const toastId = toast.loading('Processing withdrawal...');
    try {
      const amount = parseEther(withdrawAmount);
      const hash = await withdrawStake(amount);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast.success('Withdrawal successful!', { id: toastId });
      setWithdrawModalOpen(false);
      setWithdrawAmount('');
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error('Withdrawal failed. Please try again.', { id: toastId });
    }
  };

  const resetForm = () => {
    setSupplierName('');
    setBusinessRegNumber('');
    setStakeAmount('');
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

            {/* Stake Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stake Amount (ETH)
              </label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder={`Min: ${formatEther(minimumStake)} ETH`}
                className="input-field w-full"
                step="0.001"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum stake: {formatEther(minimumStake)} ETH. This is locked as collateral for your supplier activities.
              </p>
            </div>

            {/* Info */}
            <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
              <p className="text-xs text-gray-400">
                After registration, your account will need to be verified before you can
                provide fiat liquidity. You will need to complete KYC verification.
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

  // Registered - show supplier status with deposit/withdraw
  return (
    <>
      <Card className="border-green-500/20">
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
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400">Staked</p>
            <p className="text-sm font-semibold">
              {supplier?.stakedAmount ? formatEther(supplier.stakedAmount) : '0'} ETH
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400">Loans Provided</p>
            <p className="text-sm font-semibold">
              {supplier?.totalLoansProvided?.toString() || '0'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleDepositClick}
            icon={<ArrowDownToLine className="w-4 h-4" />}
            className="flex-1"
          >
            Deposit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleWithdrawClick}
            icon={<ArrowUpFromLine className="w-4 h-4" />}
            className="flex-1"
          >
            Withdraw
          </Button>
        </div>
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
                  To {kycAction === 'deposit' ? 'deposit fiat liquidity' : 'withdraw funds'},
                  you must first complete KYC verification. You will be redirected to our
                  verification partner&apos;s website to complete this process.
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
              I understand that I will be redirected to an external website to complete
              identity verification, and I consent to sharing my personal information
              for KYC purposes.
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

      {/* Deposit Modal */}
      <Modal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        title="Deposit Stake"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Add more ETH to your supplier stake. This increases your capacity
            to provide fiat loans.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (ETH)
            </label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.0"
              className="input-field w-full"
              step="0.001"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setDepositModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeposit}
              loading={isDepositing}
              disabled={isDepositing || !depositAmount}
              className="flex-1"
            >
              {isDepositing ? 'Depositing...' : 'Deposit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        title="Withdraw Stake"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Withdraw ETH from your supplier stake. Note: you must maintain the
            minimum stake amount.
          </p>
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400">Current Stake</p>
            <p className="text-sm font-semibold">
              {supplier?.stakedAmount ? formatEther(supplier.stakedAmount) : '0'} ETH
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (ETH)
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.0"
              className="input-field w-full"
              step="0.001"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setWithdrawModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              loading={isWithdrawing}
              disabled={isWithdrawing || !withdrawAmount}
              className="flex-1"
            >
              {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
