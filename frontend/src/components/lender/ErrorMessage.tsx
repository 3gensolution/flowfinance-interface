'use client';

import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  title?: string;
  onDismiss: () => void;
}

export function ErrorMessage({ message, title = 'Error', onDismiss }: ErrorMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-400 mb-1">{title}</h4>
          <p className="text-sm text-white/70">{message}</p>
          <button
            onClick={onDismiss}
            className="text-xs text-red-300 hover:text-red-200 mt-2 underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
}
