'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type AnimationType = 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scale' | 'stagger';

interface AnimationOptions {
  type?: AnimationType;
  duration?: number;
  delay?: number;
  ease?: string;
  staggerAmount?: number;
  triggerStart?: string;
  triggerEnd?: string;
  scrub?: boolean | number;
  markers?: boolean;
}

const defaultOptions: AnimationOptions = {
  type: 'fadeUp',
  duration: 1,
  delay: 0,
  ease: 'power3.out',
  staggerAmount: 0.1,
  triggerStart: 'top 85%',
  triggerEnd: 'bottom 20%',
  scrub: false,
  markers: false,
};

export function useGsapFadeIn<T extends HTMLElement>(options: AnimationOptions = {}) {
  const ref = useRef<T>(null);
  const opts = { ...defaultOptions, ...options };

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    // Set initial state based on animation type
    const initialState: gsap.TweenVars = { opacity: 0 };
    const animateState: gsap.TweenVars = { opacity: 1, duration: opts.duration, ease: opts.ease, delay: opts.delay };

    switch (opts.type) {
      case 'fadeUp':
        initialState.y = 60;
        animateState.y = 0;
        break;
      case 'fadeDown':
        initialState.y = -60;
        animateState.y = 0;
        break;
      case 'fadeLeft':
        initialState.x = 60;
        animateState.x = 0;
        break;
      case 'fadeRight':
        initialState.x = -60;
        animateState.x = 0;
        break;
      case 'scale':
        initialState.scale = 0.8;
        animateState.scale = 1;
        break;
    }

    gsap.set(element, initialState);

    const animation = gsap.to(element, {
      ...animateState,
      scrollTrigger: {
        trigger: element,
        start: opts.triggerStart,
        end: opts.triggerEnd,
        scrub: opts.scrub,
        markers: opts.markers,
        toggleActions: 'play none none reverse',
      },
    });

    return () => {
      animation.kill();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === element) {
          trigger.kill();
        }
      });
    };
  }, [opts.type, opts.duration, opts.delay, opts.ease, opts.triggerStart, opts.triggerEnd, opts.scrub, opts.markers]);

  return ref;
}

export function useGsapStagger<T extends HTMLElement>(
  childSelector: string = '> *',
  options: AnimationOptions = {}
) {
  const ref = useRef<T>(null);
  const opts = { ...defaultOptions, ...options };

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;
    const children = element.querySelectorAll(childSelector);

    if (children.length === 0) return;

    // Set initial state
    gsap.set(children, { opacity: 0, y: 40 });

    const animation = gsap.to(children, {
      opacity: 1,
      y: 0,
      duration: opts.duration,
      ease: opts.ease,
      stagger: opts.staggerAmount,
      scrollTrigger: {
        trigger: element,
        start: opts.triggerStart,
        end: opts.triggerEnd,
        toggleActions: 'play none none reverse',
      },
    });

    return () => {
      animation.kill();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === element) {
          trigger.kill();
        }
      });
    };
  }, [childSelector, opts.duration, opts.ease, opts.staggerAmount, opts.triggerStart, opts.triggerEnd]);

  return ref;
}

// Custom hook for page transitions
export function usePageTransition() {
  useEffect(() => {
    // Animate page content on mount
    gsap.fromTo(
      'main',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    );
  }, []);
}

// Utility to refresh ScrollTrigger (useful after dynamic content loads)
export function refreshScrollTrigger() {
  ScrollTrigger.refresh();
}
