'use client';

import { useEffect, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { DotLottie } from '@lottiefiles/dotlottie-react';

interface LottieAnimationProps {
  /** Path to the .lottie file (can be local or URL) */
  src: string;
  /** Width of the animation container */
  width?: number | string;
  /** Height of the animation container */
  height?: number | string;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Whether to autoplay the animation */
  autoplay?: boolean;
  /** Playback speed (1 = normal) */
  speed?: number;
  /** Additional CSS classes */
  className?: string;
  /** Callback when animation is ready */
  onReady?: () => void;
  /** Callback when animation completes (only fires if loop is false) */
  onComplete?: () => void;
}

/**
 * Reusable Lottie animation component for .lottie files
 * Uses @lottiefiles/dotlottie-react for optimal .lottie file support
 */
export function LottieAnimation({
  src,
  width = '100%',
  height = 'auto',
  loop = true,
  autoplay = true,
  speed = 1,
  className = '',
  onReady,
  onComplete,
}: LottieAnimationProps) {
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up event listeners when dotLottie instance is available
  useEffect(() => {
    if (!dotLottie) return;

    const handleReady = () => {
      onReady?.();
    };

    const handleComplete = () => {
      onComplete?.();
    };

    dotLottie.addEventListener('ready', handleReady);
    dotLottie.addEventListener('complete', handleComplete);

    return () => {
      dotLottie.removeEventListener('ready', handleReady);
      dotLottie.removeEventListener('complete', handleComplete);
    };
  }, [dotLottie, onReady, onComplete]);

  // Handle speed changes
  useEffect(() => {
    if (dotLottie) {
      dotLottie.setSpeed(speed);
    }
  }, [dotLottie, speed]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <DotLottieReact
        src={src}
        loop={loop}
        autoplay={autoplay}
        dotLottieRefCallback={setDotLottie}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default LottieAnimation;
