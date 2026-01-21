'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Wallet, FileText, HandCoins, CheckCircle2, ArrowDown } from 'lucide-react';
import { ScrollReveal } from '@/components/animations/ScrollReveal';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const borrowSteps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Connect your Web3 wallet to get started. We support MetaMask, WalletConnect, and more.',
    step: 1,
  },
  {
    icon: FileText,
    title: 'Create Request',
    description: 'Specify your collateral asset, borrow amount, preferred interest rate, and loan duration.',
    step: 2,
  },
  {
    icon: HandCoins,
    title: 'Get Funded',
    description: 'A lender reviews and funds your request. Your collateral is locked in the smart contract.',
    step: 3,
  },
  {
    icon: CheckCircle2,
    title: 'Repay & Unlock',
    description: 'Repay the loan with interest before the due date to get your collateral back.',
    step: 4,
  },
];

const lendSteps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Connect your Web3 wallet to access the lending marketplace.',
    step: 1,
  },
  {
    icon: FileText,
    title: 'Browse or Create',
    description: 'Find loan requests that match your criteria or create your own lending offer.',
    step: 2,
  },
  {
    icon: HandCoins,
    title: 'Fund Loans',
    description: 'Provide liquidity by funding loan requests. Collateral secures your investment.',
    step: 3,
  },
  {
    icon: CheckCircle2,
    title: 'Earn Interest',
    description: 'Receive your principal plus interest when the borrower repays the loan.',
    step: 4,
  },
];

interface StepSectionProps {
  title: string;
  titleColor: string;
  steps: typeof borrowSteps;
  bgColor: string;
  iconBgColor: string;
  iconColor: string;
}

// Desktop version with GSAP scroll effects
function StepSectionDesktop({ title, titleColor, steps, bgColor, iconBgColor, iconColor }: StepSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !titleRef.current || !stepsContainerRef.current) return;

    const section = sectionRef.current;
    const titleEl = titleRef.current;
    const stepsContainer = stepsContainerRef.current;
    const stepElements = stepsContainer.querySelectorAll('.step-card');

    // Pin the title on the left while steps scroll on the right
    const pinTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top 20%',
      end: () => `+=${stepsContainer.offsetHeight - window.innerHeight * 0.5}`,
      pin: titleEl,
      pinSpacing: false,
    });

    // Animate each step card as it comes into view
    stepElements.forEach((step) => {
      gsap.fromTo(
        step,
        {
          opacity: 0,
          x: 100,
          scale: 0.9,
        },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.5,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: step,
            start: 'top 80%',
            end: 'top 50%',
            scrub: 1,
          },
        }
      );

      // Add a highlight effect when step is in center of viewport
      ScrollTrigger.create({
        trigger: step,
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => {
          gsap.to(step, {
            scale: 1.02,
            duration: 0.3,
            ease: 'power2.out',
          });
        },
        onLeave: () => {
          gsap.to(step, {
            scale: 1,
            duration: 0.3,
            ease: 'power2.out',
          });
        },
        onEnterBack: () => {
          gsap.to(step, {
            scale: 1.02,
            duration: 0.3,
            ease: 'power2.out',
          });
        },
        onLeaveBack: () => {
          gsap.to(step, {
            scale: 1,
            duration: 0.3,
            ease: 'power2.out',
          });
        },
      });
    });

    return () => {
      pinTrigger.kill();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger && section.contains(trigger.trigger as Node)) {
          trigger.kill();
        }
      });
    };
  }, []);

  return (
    <div ref={sectionRef} className="relative min-h-screen py-20">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Left side - Pinned title */}
          <div ref={titleRef} className="lg:sticky lg:top-1/3">
            <div className={`${bgColor} rounded-3xl p-8 lg:p-12`}>
              <h3 className={`text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 ${titleColor}`}>
                {title}
              </h3>
              <p className="text-gray-400 text-lg">
                Follow these simple steps to get started
              </p>
              <div className="mt-8 flex items-center gap-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full ${iconBgColor}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Scrolling steps */}
          <div ref={stepsContainerRef} className="space-y-8">
            {steps.map((step) => (
              <div key={step.title} className="step-card">
                <Card className="p-6 lg:p-8 transition-all duration-300">
                  <div className="flex items-start gap-4 lg:gap-6">
                    <div className={`flex-shrink-0 w-14 h-14 lg:w-16 lg:h-16 ${iconBgColor} rounded-2xl flex items-center justify-center`}>
                      <step.icon className={`w-7 h-7 lg:w-8 lg:h-8 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${iconBgColor} ${iconColor}`}>
                          Step {step.step}
                        </span>
                      </div>
                      <h4 className="text-xl lg:text-2xl font-bold mb-2">{step.title}</h4>
                      <p className="text-gray-400 text-base lg:text-lg leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile version with simple layout (no scroll effects)
function StepSectionMobile({ title, titleColor, steps, bgColor, iconBgColor, iconColor }: StepSectionProps) {
  return (
    <div className="py-12">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6">
        {/* Title */}
        <div className={`${bgColor} rounded-2xl p-6 mb-8`}>
          <h3 className={`text-2xl sm:text-3xl font-bold mb-2 ${titleColor}`}>
            {title}
          </h3>
          <p className="text-gray-400 text-base">
            Follow these simple steps to get started
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.title}>
              <Card className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 ${iconBgColor} rounded-xl flex items-center justify-center`}>
                    <step.icon className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${iconBgColor} ${iconColor}`}>
                        Step {step.step}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold mb-1">{step.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </Card>
              {index < steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="w-5 h-5 text-gray-600" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Responsive wrapper component
function StepSection(props: StepSectionProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Render mobile version on server and initial client render
  if (!isDesktop) {
    return <StepSectionMobile {...props} />;
  }

  return <StepSectionDesktop {...props} />;
}

export function HowItWorks() {
  return (
    <section className="relative bg-background">
      {/* Section Header */}
      <div className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" className="text-center max-w-[1920px] mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-base lg:text-lg">
            Simple, transparent, and permissionless lending in just a few steps
          </p>
        </ScrollReveal>
      </div>

      {/* For Borrowers */}
      <StepSection
        title="For Borrowers"
        titleColor="text-primary-400"
        steps={borrowSteps}
        bgColor="bg-primary-500/10"
        iconBgColor="bg-primary-500/20"
        iconColor="text-primary-400"
      />

      {/* For Lenders */}
      <StepSection
        title="For Lenders"
        titleColor="text-accent-400"
        steps={lendSteps}
        bgColor="bg-accent-500/10"
        iconBgColor="bg-accent-500/20"
        iconColor="text-accent-400"
      />
    </section>
  );
}
