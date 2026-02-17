'use client';

import { ArrowRight, Loader2, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type ButtonType = 'approve' | 'submit';

interface TransactionButtonProps {
  type: ButtonType;
  tokenSymbol?: string;
  isLoading: boolean;
  isDisabled: boolean;
  isSecondary?: boolean;
  stepNumber?: number;
  onClick: () => void;
  loadingText?: string;
  defaultText?: string;
}

export function TransactionButton({
  type,
  tokenSymbol,
  isLoading,
  isDisabled,
  isSecondary = false,
  stepNumber,
  onClick,
  loadingText,
  defaultText,
}: TransactionButtonProps) {
  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-5 h-5 animate-spin" />;
    }
    return type === 'approve' ? <Unlock className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />;
  };

  const getText = () => {
    if (isLoading) {
      return loadingText || (type === 'approve' ? 'Authorizing...' : 'Processing...');
    }
    if (type === 'approve') {
      return stepNumber ? `Step ${stepNumber}: Authorize ${tokenSymbol}` : `Authorize ${tokenSymbol}`;
    }
    const text = defaultText || 'Confirm';
    return stepNumber ? `Step ${stepNumber}: ${text}` : text;
  };

  return (
    <Button
      variant={isSecondary ? 'secondary' : 'primary'}
      size="xl"
      fullWidth
      disabled={isDisabled}
      loading={isLoading}
      onClick={onClick}
      icon={getIcon()}
      iconPosition="right"
    >
      {getText()}
    </Button>
  );
}
