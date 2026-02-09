'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const navLinks = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/borrow', label: 'Borrow' },
  { href: '/lend', label: 'Lend' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/faucet', label: 'Faucet' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLandingPage = pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isSupplyPage = pathname === '/supply';

  // Determine header styling based on page and scroll state
  const headerClasses = isLandingPage
    ? scrolled
      ? 'bg-black/95 backdrop-blur-xl border-b border-white/10 shadow-lg'
      : 'bg-transparent backdrop-blur-sm border-b border-white/5'
    : isSupplyPage
    ? 'bg-black/95 backdrop-blur-xl border-b border-white/10'
    : 'bg-black/90 backdrop-blur-xl border-b border-white/10';

  const linkClasses = isLandingPage
    ? {
        active: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        inactive: 'text-white hover:text-orange-400 hover:bg-white/10',
      }
    : {
        active: 'bg-accent-500/10 text-accent-500 border border-accent-500/20',
        inactive: 'text-gray-400 hover:text-white hover:bg-white/5',
      };

  const mobileButtonClasses = isLandingPage
    ? 'text-white hover:bg-white/10'
    : 'text-white hover:bg-white/10';

  return (
    <header className={cn('fixed top-0 left-0 right-0 z-40 transition-all duration-300', headerClasses)}>
      <nav className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/awinfi.png"
              alt="AwinFi"
              width={120}
              height={40}
              className="h-10 w-[140px]"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  pathname === link.href ? linkClasses.active : linkClasses.inactive
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Wallet & Mobile Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <ConnectButton />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn('md:hidden p-2 rounded-lg transition-colors', mobileButtonClasses)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <motion.div
          initial={false}
          animate={mobileMenuOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
          className="md:hidden overflow-hidden"
        >
          <div className="py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  pathname === link.href ? linkClasses.active : linkClasses.inactive
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 px-4 sm:hidden">
              <ConnectButton />
            </div>
          </div>
        </motion.div>
      </nav>
    </header>
  );
}
