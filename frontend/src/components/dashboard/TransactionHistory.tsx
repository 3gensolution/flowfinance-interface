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

// Format address helper
function formatAddress(address: string, chars: number = 6): string {
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

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
            <Check className="w-3 h-3" />
            Done
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
            <AlertTriangle className="w-3 h-3" />
            Failed
          </span>
        );
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
      <h2 className="text-xl font-semibold mb-4">Transaction History</h2>

      {/* Filters — marketplace style */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="inline-flex rounded-xl p-1 bg-white/5 border border-white/10">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleFilterChange(option.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  filter === option.id
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="inline-flex rounded-xl p-1 bg-white/5 border border-white/10">
            {dateFilterOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleDateFilterChange(option.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  dateFilter === option.id
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <span className="text-xs text-gray-500 ml-auto">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
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
            {/* Scrollable table */}
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Transaction</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Counterparty</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Amount</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="wait">
                    {paginatedTransactions.map((tx, index) => (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        {/* Transaction */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${getTransactionColor(tx.type)}`}>
                              {getTransactionIcon(tx.type)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white text-sm whitespace-nowrap">{tx.description}</p>
                              {tx.isFiat && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/15 text-green-400">Fiat</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Counterparty */}
                        <td className="px-4 py-3.5">
                          {tx.counterpartyAddress ? (
                            <div>
                              <span className="text-gray-500 text-xs">{tx.counterpartyRole}</span>
                              <p className="text-gray-300 font-mono text-xs whitespace-nowrap">{formatAddress(tx.counterpartyAddress)}</p>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-sm">—</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-semibold text-sm whitespace-nowrap ${
                            tx.type === 'borrow' || tx.type === 'receive_repayment'
                              ? 'text-green-400'
                              : tx.type === 'liquidation'
                              ? 'text-red-400'
                              : 'text-primary-400'
                          }`}>
                            {tx.type === 'borrow' || tx.type === 'receive_repayment' ? '+' : '-'}
                            {tx.amount} {!tx.isFiat && tx.asset}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm text-gray-400 whitespace-nowrap">
                            {tx.date.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-right">
                          {getStatusBadge(tx.status)}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length)} of {filteredTransactions.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-400 px-2 whitespace-nowrap">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
