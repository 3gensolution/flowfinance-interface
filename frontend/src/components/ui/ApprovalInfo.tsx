'use client';

import { motion } from 'framer-motion';
import { Info, Shield } from 'lucide-react';

interface ApprovalInfoProps {
  tokenSymbol: string;
  safetyNote?: string;
}

export function ApprovalInfo({
  tokenSymbol,
  safetyNote = 'Your funds remain safe in your account until your offer is accepted.',
}: ApprovalInfoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/30"
    >
      <div className="flex gap-3">
        <Info className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <h4 className="font-semibold text-primary-400">Authorization Required</h4>
          <p className="text-sm text-white/70">
            To proceed, please authorize access to your {tokenSymbol}. This is a one-time
            authorization for this amount.
          </p>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Shield className="w-3.5 h-3.5" />
            <span>{safetyNote}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
