'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// ============ Crypto CTA ============
export function CryptoMarketplaceCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-12 text-center"
    >
      <Card className="inline-block">
        <p className="text-gray-400 mb-4">
          Don&apos;t see what you&apos;re looking for?
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/borrow">
            <Button variant="secondary">Create Loan Request</Button>
          </Link>
          <Link href="/lend">
            <Button>Create Lender Offer</Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}

// ============ Fiat CTA ============
interface FiatMarketplaceCTAProps {
  activeTab: 'requests' | 'offers';
  isVerifiedSupplier: boolean;
}

export function FiatMarketplaceCTA({ activeTab, isVerifiedSupplier }: FiatMarketplaceCTAProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-12 text-center"
    >
      <Card className="inline-block border-green-500/20">
        {activeTab === 'requests' ? (
          <>
            <p className="text-gray-400 mb-4">
              Need fiat liquidity backed by your crypto?
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/borrow">
                <Button className="bg-green-600 hover:bg-green-700">Create Fiat Loan Request</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-400 mb-4">
              {isVerifiedSupplier
                ? 'Create offers to lend fiat to borrowers'
                : 'Only verified fiat suppliers can create lender offers'}
            </p>
            <div className="flex gap-4 justify-center">
              {isVerifiedSupplier ? (
                <Link href="/lend">
                  <Button className="bg-green-600 hover:bg-green-700">Create Fiat Lender Offer</Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button className="bg-green-600 hover:bg-green-700">Become a Fiat Supplier</Button>
                </Link>
              )}
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
}
