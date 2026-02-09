'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SuccessModalProps {
  isOpen: boolean;
  amount: string;
  tokenSymbol: string;
  rate: number;
  onGoToMarketplace: () => void;
}

export function SuccessModal({ isOpen, amount, tokenSymbol, rate, onGoToMarketplace }: SuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-navy-800 border border-white/10 rounded-2xl p-8 max-w-md mx-4 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"
            >
              <PartyPopper className="w-8 h-8 text-green-400" />
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">
              Offer Created Successfully!
            </h3>
            <p className="text-white/60 mb-6">
              Your lending offer of {amount} {tokenSymbol} at {rate}% APR is now live on the marketplace.
            </p>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onGoToMarketplace}
              icon={<ArrowRight className="w-5 h-5" />}
              iconPosition="right"
            >
              Go to Marketplace
            </Button>
            <p className="text-xs text-white/40 mt-3">
              Auto-redirecting in a few seconds...
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
