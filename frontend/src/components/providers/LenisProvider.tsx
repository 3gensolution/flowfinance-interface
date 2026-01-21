'use client';

import { ReactLenis } from 'lenis/react';
import { ReactNode } from 'react';

interface LenisProviderProps {
  children: ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1, // Smoothness factor (0-1, lower = smoother but slower)
        duration: 1.2, // Animation duration
        smoothWheel: true, // Smooth wheel scrolling
        wheelMultiplier: 1, // Wheel scroll speed multiplier
        touchMultiplier: 2, // Touch scroll speed multiplier
        infinite: false, // Infinite scrolling
      }}
    >
      {children}
    </ReactLenis>
  );
}
