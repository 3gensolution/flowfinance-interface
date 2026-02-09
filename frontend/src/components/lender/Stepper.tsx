'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="mb-10">
      {/* Step Indicators */}
      <div className="flex items-center justify-between relative">
        {/* Progress Line Background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/10" />

        {/* Progress Line Fill */}
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-orange-500 to-orange-400"
          initial={{ width: '0%' }}
          animate={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`
          }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <div
              key={step.id}
              className="relative flex flex-col items-center z-10"
            >
              {/* Step Circle */}
              <motion.div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  font-semibold text-sm transition-all duration-300 border-2
                  ${isCompleted
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : isCurrent
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-white/5 border-white/20 text-white/40'
                  }
                `}
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </motion.div>

              {/* Step Label */}
              <div className="absolute top-14 text-center w-24">
                <p
                  className={`
                    text-xs font-medium transition-colors duration-300
                    ${isCurrent ? 'text-orange-400' : isCompleted ? 'text-white' : 'text-white/40'}
                  `}
                >
                  {step.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Step Description */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-16 text-center"
      >
        <p className="text-white/60 text-sm">
          {steps.find(s => s.id === currentStep)?.description}
        </p>
      </motion.div>
    </div>
  );
}
