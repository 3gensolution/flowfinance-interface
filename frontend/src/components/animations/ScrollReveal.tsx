'use client';

import { useEffect, useRef, ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLenis } from 'lenis/react';

// Register plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type AnimationDirection = 'up' | 'down' | 'left' | 'right';

interface ScrollRevealProps {
  children: ReactNode;
  direction?: AnimationDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
}

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.8,
  distance = 60,
  className = '',
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync Lenis with GSAP ScrollTrigger
  useLenis(() => {
    ScrollTrigger.update();
  });

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    // Determine initial position based on direction
    const initialProps: gsap.TweenVars = { opacity: 0 };
    const animateProps: gsap.TweenVars = { opacity: 1 };

    switch (direction) {
      case 'up':
        initialProps.y = distance;
        animateProps.y = 0;
        break;
      case 'down':
        initialProps.y = -distance;
        animateProps.y = 0;
        break;
      case 'left':
        initialProps.x = distance;
        animateProps.x = 0;
        break;
      case 'right':
        initialProps.x = -distance;
        animateProps.x = 0;
        break;
    }

    gsap.set(element, initialProps);

    const animation = gsap.to(element, {
      ...animateProps,
      duration,
      delay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        end: 'bottom 20%',
        toggleActions: once ? 'play none none none' : 'play none none reverse',
      },
    });

    return () => {
      animation.kill();
    };
  }, [direction, delay, duration, distance, once]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

interface StaggerRevealProps {
  children: ReactNode;
  staggerDelay?: number;
  duration?: number;
  className?: string;
  childClassName?: string;
}

export function StaggerReveal({
  children,
  staggerDelay = 0.1,
  duration = 0.8,
  className = '',
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const childElements = element.children;

    if (childElements.length === 0) return;

    gsap.set(childElements, { opacity: 0, y: 40 });

    const animation = gsap.to(childElements, {
      opacity: 1,
      y: 0,
      duration,
      ease: 'power3.out',
      stagger: staggerDelay,
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    });

    return () => {
      animation.kill();
    };
  }, [staggerDelay, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// Text reveal animation - characters animate in
interface TextRevealProps {
  children: string;
  className?: string;
  delay?: number;
}

export function TextReveal({ children, className = '', delay = 0 }: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const text = children;

    // Split text into characters
    element.innerHTML = text
      .split('')
      .map(char => `<span class="inline-block">${char === ' ' ? '&nbsp;' : char}</span>`)
      .join('');

    const chars = element.querySelectorAll('span');

    gsap.set(chars, { opacity: 0, y: 20 });

    const animation = gsap.to(chars, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.02,
      delay,
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    });

    return () => {
      animation.kill();
    };
  }, [children, delay]);

  return <span ref={ref} className={className}>{children}</span>;
}
