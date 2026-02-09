'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Receipt, PiggyBank, Ambulance, Building2 } from 'lucide-react';

const useCases = [
  {
    icon: Receipt,
    title: 'Pay bills',
    description: 'Access cash from your crypto to cover monthly expenses without selling your assets.',
    color: 'orange',
  },
  {
    icon: PiggyBank,
    title: 'Grow savings',
    description: 'Earn competitive interest on your deposits. Watch your crypto work harder for you.',
    color: 'teal',
  },
  {
    icon: Ambulance,
    title: 'Emergency cash',
    description: 'Get instant access to funds when you need them most, without liquidating holdings.',
    color: 'blue',
  },
  {
    icon: Building2,
    title: 'Business funding',
    description: 'Leverage your crypto portfolio to fund business opportunities and investments.',
    color: 'orange',
  },
];

const colorClasses = {
  orange: {
    bg: 'bg-orange-500/20',
    icon: 'text-orange-400',
    border: 'hover:border-orange-500/30',
  },
  teal: {
    bg: 'bg-teal-500/20',
    icon: 'text-teal-400',
    border: 'hover:border-teal-500/30',
  },
  blue: {
    bg: 'bg-blue-500/20',
    icon: 'text-blue-400',
    border: 'hover:border-blue-500/30',
  },
};

function UseCaseCard({
  useCase,
  index,
}: {
  useCase: (typeof useCases)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const colors = colorClasses[useCase.color as keyof typeof colorClasses];

  return (
    <motion.div
      ref={ref}
      className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:bg-white/10 ${colors.border} group`}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.33, 1, 0.68, 1] }}
    >
      {/* Icon */}
      <div className={`w-14 h-14 ${colors.bg} rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110`}>
        <useCase.icon className={`w-7 h-7 ${colors.icon}`} />
      </div>

      {/* Content */}
      <h3 className="text-xl font-bold text-white mb-3">{useCase.title}</h3>
      <p className="text-gray-400 leading-relaxed">{useCase.description}</p>
    </motion.div>
  );
}

export function UseCases() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="py-24 bg-[#080F2B] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Built for <span className="text-orange-400">Real Life</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Your crypto should work for you, not just sit in a wallet
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {useCases.map((useCase, index) => (
            <UseCaseCard key={useCase.title} useCase={useCase} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
