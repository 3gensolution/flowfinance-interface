'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';

const features = [
  {
    title: 'Real-time tracking',
    description: 'Monitor your portfolio value, earnings, and loans all in one dashboard.',
    icon: TrendingUp,
  },
  {
    title: 'Set your own rates',
    description: 'Lend to others at interest rates you choose. Full control over your earnings.',
    icon: DollarSign,
  },
  {
    title: 'Instant transactions',
    description: 'Deposit, lend, and withdraw with just a few clicks. No waiting periods.',
    icon: ArrowUpRight,
  },
];

function AnimatedBalance() {
  const [balance, setBalance] = useState(0);
  const targetBalance = 7500;
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    const duration = 2000;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeOut = 1 - Math.pow(1 - progress, 3);
      setBalance(Math.floor(easeOut * targetBalance));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView]);

  return (
    <div ref={ref} className="text-4xl font-bold text-white">
      ${balance.toLocaleString()}
    </div>
  );
}

function TransactionRow({
  type,
  amount,
  asset,
  delay,
}: {
  type: 'deposit' | 'earn' | 'withdraw';
  amount: string;
  asset: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const icons = {
    deposit: ArrowDownRight,
    earn: TrendingUp,
    withdraw: ArrowUpRight,
  };

  const colors = {
    deposit: 'text-blue-400 bg-blue-500/20',
    earn: 'text-teal-400 bg-teal-500/20',
    withdraw: 'text-orange-400 bg-orange-500/20',
  };

  const Icon = icons[type];

  return (
    <motion.div
      ref={ref}
      className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl"
      initial={{ opacity: 0, x: 20 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
      transition={{ duration: 0.5, delay, ease: [0.33, 1, 0.68, 1] }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[type]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-white capitalize">{type}</p>
          <p className="text-xs text-gray-400">{asset}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${type === 'withdraw' ? 'text-orange-400' : 'text-teal-400'}`}>
          {type === 'withdraw' ? '-' : '+'}{amount}
        </p>
      </div>
    </motion.div>
  );
}

export function ProductPreview() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section ref={sectionRef} className="py-24 bg-[#0A1628] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
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
            See Your <span className="text-blue-400">Growth</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            A dashboard designed for clarity, not complexity
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side - Dashboard mockup */}
          <motion.div className="relative" style={{ y, opacity }}>
            <div className="relative">
              {/* Soft shadow */}
              <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/10 to-orange-500/10 rounded-3xl blur-2xl opacity-50" />

              {/* Dashboard card */}
              <div className="relative bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total Balance</p>
                    <AnimatedBalance />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-teal-500/20 rounded-full">
                    <TrendingUp className="w-4 h-4 text-teal-400" />
                    <span className="text-sm font-medium text-teal-400">+12.5%</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Deposited</p>
                    <p className="text-lg font-semibold text-white">$5,000</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Earnings</p>
                    <p className="text-lg font-semibold text-teal-400">$2,500</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Lent Out</p>
                    <p className="text-lg font-semibold text-orange-400">$1,200</p>
                  </div>
                </div>

                {/* Recent transactions */}
                <div>
                  <p className="text-sm font-medium text-white mb-3">Recent Activity</p>
                  <div className="space-y-2">
                    <TransactionRow type="deposit" amount="1,000 USDC" asset="Crypto Deposit" delay={0.3} />
                    <TransactionRow type="earn" amount="124.50" asset="Interest Earned" delay={0.4} />
                    <TransactionRow type="withdraw" amount="500" asset="To Bank" delay={0.5} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right side - Features */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="flex gap-4"
                initial={{ opacity: 0, x: 20 }}
                animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                transition={{
                  duration: 0.5,
                  delay: 0.2 + index * 0.1,
                  ease: [0.33, 1, 0.68, 1],
                }}
              >
                <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
