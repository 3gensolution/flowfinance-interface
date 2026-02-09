'use client';

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUnits } from 'viem';
import { LoanStatus } from '@/types';
import { FiatLoanStatus } from '@/hooks/useFiatLoan';
import { getTokenByAddress } from '@/config/contracts';
import { formatCurrency as formatFiatCurrency } from '@/hooks/useFiatOracle';
import { EmptyState } from '@/components/ui/EmptyState';

// Format address helper (local version for string type)
function formatAddress(address: string, chars: number = 4): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
import {
  useLoansByBorrower,
  useLoansByLender,
  useFiatLoansByBorrower,
} from '@/stores/contractStore';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
} from 'lucide-react';

type FilterType = 'all' | 'crypto' | 'fiat';
type DateFilter = 'all' | '7days' | '30days' | '90days';

interface Transaction {
  id: string;
  type: 'borrow' | 'lend' | 'repay' | 'receive_repayment' | 'liquidation';
  amount: string;
  amountUSD?: number;
  asset: string;
  status: 'completed' | 'pending' | 'failed';
  date: Date;
  isFiat: boolean;
  description: string;
  counterpartyAddress?: string;
  counterpartyRole?: 'Lender' | 'Borrower' | 'Supplier';
}

const ITEMS_PER_PAGE = 5;

export function TransactionHistory() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { address } = useAccount();

  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);
  const fiatLoans = useFiatLoansByBorrower(address);

  // Build transaction list from loans
  const transactions = useMemo(() => {
    const txList: Transaction[] = [];

    // Crypto borrowed loans
    borrowedLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      const symbol = tokenInfo?.symbol || 'Unknown';
      const decimals = tokenInfo?.decimals || 18;
      const amount = Number(formatUnits(loan.principalAmount, decimals));

      // Initial borrow transaction
      txList.push({
        id: `borrow-${loan.loanId.toString()}`,
        type: 'borrow',
        amount: amount.toLocaleString(undefined, { maximumFractionDigits: 4 }),
        asset: symbol,
        status: 'completed',
        date: new Date(Number(loan.startTime) * 1000),
        isFiat: false,
        description: `Borrowed ${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`,
        counterpartyAddress: loan.lender,
        counterpartyRole: 'Lender',
      });

      // Repayment transaction (if repaid)
      if (loan.status === LoanStatus.REPAID) {
        const repaidAmount = Number(formatUnits(loan.amountRepaid, decimals));
        txList.push({
          id: `repay-${loan.loanId.toString()}`,
          type: 'repay',
          amount: repaidAmount.toLocaleString(undefined, { maximumFractionDigits: 4 }),
          asset: symbol,
          status: 'completed',
          date: new Date(Number(loan.dueDate) * 1000),
          isFiat: false,
          description: `Repaid ${repaidAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`,
          counterpartyAddress: loan.lender,
          counterpartyRole: 'Lender',
        });
      }

      // Liquidation transaction
      if (loan.status === LoanStatus.LIQUIDATED) {
        txList.push({
          id: `liquidation-${loan.loanId.toString()}`,
          type: 'liquidation',
          amount: amount.toLocaleString(undefined, { maximumFractionDigits: 4 }),
          asset: symbol,
          status: 'completed',
          date: new Date(Number(loan.dueDate) * 1000),
          isFiat: false,
          description: `Loan liquidated`,
          counterpartyAddress: loan.lender,
          counterpartyRole: 'Lender',
        });
      }
    });

    // Crypto lent loans
    lentLoans.forEach(loan => {
      const tokenInfo = getTokenByAddress(loan.borrowAsset);
      const symbol = tokenInfo?.symbol || 'Unknown';
      const decimals = tokenInfo?.decimals || 18;
      const amount = Number(formatUnits(loan.principalAmount, decimals));

      // Initial lend transaction
      txList.push({
        id: `lend-${loan.loanId.toString()}`,
        type: 'lend',
        amount: amount.toLocaleString(undefined, { maximumFractionDigits: 4 }),
        asset: symbol,
        status: 'completed',
        date: new Date(Number(loan.startTime) * 1000),
        isFiat: false,
        description: `Lent ${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`,
        counterpartyAddress: loan.borrower,
        counterpartyRole: 'Borrower',
      });

      // Receive repayment transaction (if repaid)
      if (loan.status === LoanStatus.REPAID) {
        const repaidAmount = Number(formatUnits(loan.amountRepaid, decimals));
        txList.push({
          id: `receive-${loan.loanId.toString()}`,
          type: 'receive_repayment',
          amount: repaidAmount.toLocaleString(undefined, { maximumFractionDigits: 4 }),
          asset: symbol,
          status: 'completed',
          date: new Date(Number(loan.dueDate) * 1000),
          isFiat: false,
          description: `Received repayment of ${repaidAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`,
          counterpartyAddress: loan.borrower,
          counterpartyRole: 'Borrower',
        });
      }
    });

    // Fiat loans
    fiatLoans.forEach(loan => {
      const formattedAmount = formatFiatCurrency(loan.fiatAmountCents, loan.currency);

      txList.push({
        id: `fiat-borrow-${loan.loanId.toString()}`,
        type: 'borrow',
        amount: formattedAmount,
        asset: loan.currency,
        status: loan.status === FiatLoanStatus.ACTIVE ? 'completed' :
                loan.status === FiatLoanStatus.PENDING_SUPPLIER ? 'pending' :
                loan.status === FiatLoanStatus.REPAID ? 'completed' : 'completed',
        date: new Date(Number(loan.createdAt) * 1000),
        isFiat: true,
        description: `Borrowed ${formattedAmount} (Fiat)`,
        counterpartyAddress: loan.supplier !== '0x0000000000000000000000000000000000000000' ? loan.supplier : undefined,
        counterpartyRole: 'Supplier',
      });

      if (loan.status === FiatLoanStatus.REPAID) {
        txList.push({
          id: `fiat-repay-${loan.loanId.toString()}`,
          type: 'repay',
          amount: formattedAmount,
          asset: loan.currency,
          status: 'completed',
          date: new Date(Number(loan.dueDate) * 1000),
          isFiat: true,
          description: `Repaid ${formattedAmount} (Fiat)`,
          counterpartyAddress: loan.supplier,
          counterpartyRole: 'Supplier',
        });
      }
    });

    // Sort by date descending
    return txList.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [borrowedLoans, lentLoans, fiatLoans]);

  // Filter by type
  const typeFilteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    if (filter === 'crypto') return transactions.filter(tx => !tx.isFiat);
    if (filter === 'fiat') return transactions.filter(tx => tx.isFiat);
    return transactions;
  }, [transactions, filter]);

  // Filter by date
  const filteredTransactions = useMemo(() => {
    if (dateFilter === 'all') return typeFilteredTransactions;

    const now = new Date();
    let cutoffDate: Date;

    switch (dateFilter) {
      case '7days':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return typeFilteredTransactions;
    }

    return typeFilteredTransactions.filter(tx => tx.date >= cutoffDate);
  }, [typeFilteredTransactions, dateFilter]);

  // Paginate
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'borrow':
        return <ArrowDownLeft className="w-4 h-4" />;
      case 'lend':
        return <ArrowUpRight className="w-4 h-4" />;
      case 'repay':
        return <RefreshCw className="w-4 h-4" />;
      case 'receive_repayment':
        return <ArrowDownLeft className="w-4 h-4" />;
      case 'liquidation':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTransactionColor = (type: Transaction['type']) => {
    switch (type) {
      case 'borrow':
        return 'bg-primary-500/10 text-primary-400';
      case 'lend':
        return 'bg-teal-500/10 text-teal-400';
      case 'repay':
        return 'bg-green-500/10 text-green-400';
      case 'receive_repayment':
        return 'bg-orange-500/10 text-orange-400';
      case 'liquidation':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-3 h-3 text-green-400" />;
      case 'pending':
        return <Clock className="w-3 h-3 text-amber-400" />;
      case 'failed':
        return <AlertTriangle className="w-3 h-3 text-red-400" />;
      default:
        return null;
    }
  };

  const filterOptions: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'fiat', label: 'Fiat' },
  ];

  const dateFilterOptions: { id: DateFilter; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: '90days', label: '90 Days' },
  ];

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (newDateFilter: DateFilter) => {
    setDateFilter(newDateFilter);
    setCurrentPage(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold">Transaction History</h2>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleFilterChange(option.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                    filter === option.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/15'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {dateFilterOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleDateFilterChange(option.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                    dateFilter === option.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/15'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <EmptyState
            title="No Transactions Yet"
            description="Your transaction history will appear here once you start lending or borrowing."
            lottieUrl="/empty.json"
            lottieWidth={180}
            lottieHeight={180}
            action={{
              label: 'Browse Marketplace',
              href: '/marketplace',
            }}
            size="md"
          />
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 text-xs font-medium text-gray-400 uppercase">
              <div className="col-span-4">Transaction</div>
              <div className="col-span-3">Counterparty</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Date</div>
              <div className="col-span-1 text-right">Status</div>
            </div>

            {/* Transaction List */}
            <div className="divide-y divide-white/5">
              <AnimatePresence mode="wait">
                {paginatedTransactions.map((tx, index) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="p-4 hover:bg-white/5 transition-colors"
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getTransactionColor(tx.type)}`}>
                            {getTransactionIcon(tx.type)}
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">{tx.description}</p>
                            {tx.isFiat && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">Fiat</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(tx.status)}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <div className="text-gray-400">
                          {tx.counterpartyAddress ? (
                            <span>{tx.counterpartyRole}: {formatAddress(tx.counterpartyAddress)}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </div>
                        <span className={`font-medium ${
                          tx.type === 'borrow' || tx.type === 'receive_repayment' ? 'text-green-400' : 'text-primary-400'
                        }`}>
                          {tx.type === 'borrow' || tx.type === 'receive_repayment' ? '+' : '-'}
                          {tx.amount} {!tx.isFiat && tx.asset}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {tx.date.toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </p>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getTransactionColor(tx.type)}`}>
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{tx.description}</p>
                          {tx.isFiat && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">Fiat</span>
                          )}
                        </div>
                      </div>

                      <div className="col-span-3">
                        {tx.counterpartyAddress ? (
                          <div className="text-sm">
                            <span className="text-gray-500 text-xs">{tx.counterpartyRole}</span>
                            <p className="text-gray-300 font-mono text-xs">{formatAddress(tx.counterpartyAddress)}</p>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </div>

                      <div className="col-span-2 text-right">
                        <span className={`font-medium ${
                          tx.type === 'borrow' || tx.type === 'receive_repayment'
                            ? 'text-green-400'
                            : tx.type === 'lend' || tx.type === 'repay'
                            ? 'text-primary-400'
                            : 'text-red-400'
                        }`}>
                          {tx.type === 'borrow' || tx.type === 'receive_repayment' ? '+' : '-'}
                          {tx.amount} {!tx.isFiat && tx.asset}
                        </span>
                      </div>

                      <div className="col-span-2 text-right text-sm text-gray-400">
                        {tx.date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>

                      <div className="col-span-1 flex items-center justify-end gap-1">
                        {getStatusIcon(tx.status)}
                        <span className="text-xs text-gray-500 capitalize">{tx.status}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of{' '}
                  {filteredTransactions.length} transactions
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
