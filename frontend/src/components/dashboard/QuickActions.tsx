'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import {
  TrendingUp,
  Clock,
  FileText,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-12"
    >
      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/borrow">
          <Card hover className="text-center">
            <FileText className="w-8 h-8 text-primary-400 mx-auto mb-2" />
            <h3 className="font-semibold">Create Loan Request</h3>
            <p className="text-sm text-gray-400">Borrow crypto</p>
          </Card>
        </Link>
        <Link href="/lend">
          <Card hover className="text-center">
            <TrendingUp className="w-8 h-8 text-accent-400 mx-auto mb-2" />
            <h3 className="font-semibold">Create Lender Offer</h3>
            <p className="text-sm text-gray-400">Earn interest</p>
          </Card>
        </Link>
        <Link href="/marketplace">
          <Card hover className="text-center">
            <Activity className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <h3 className="font-semibold">Browse Marketplace</h3>
            <p className="text-sm text-gray-400">Find opportunities</p>
          </Card>
        </Link>
        <Card hover className="text-center opacity-50 cursor-not-allowed">
          <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <h3 className="font-semibold">Transaction History</h3>
          <p className="text-sm text-gray-400">Coming soon</p>
        </Card>
      </div>
    </motion.div>
  );
}
