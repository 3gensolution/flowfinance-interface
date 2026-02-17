'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const navLinks = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/borrow', label: 'Get a Loan' },
  { href: '/lend', label: 'Earn Interest' },
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
    <>
      <header className={cn('fixed top-0 left-0 right-0 z-40 transition-all duration-300', headerClasses)}>
        <nav className="max-w-[1920px] mx-auto px-4 sm:px-5 md:px-10 lg:px-20">
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
            <div className="hidden xl:flex items-center gap-1">
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
            <div className="flex items-center gap-3">
              <div className="hidden xl:block">
                <ConnectButton />
              </div>

              {/* Mobile/Tablet menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={cn('xl:hidden p-2 rounded-lg transition-colors', mobileButtonClasses)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Drawer overlay - outside header to avoid backdrop-filter containing block issue */}
      {mobileMenuOpen && (
        <div
          className="xl:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Slide-in drawer - outside header so fixed positioning uses viewport */}
      <div
        className={cn(
          'xl:hidden fixed top-0 right-0 h-screen w-full sm:w-3/4 md:w-1/2 bg-black border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Drawer header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <Image
              src="/awinfi.png"
              alt="AwinFi"
              width={100}
              height={32}
              className="h-8 w-auto"
            />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Drawer body - flows naturally on mobile, spreads on md+ */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col md:justify-between">
            {/* Nav links */}
            <div className="space-y-2">
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
            </div>

            {/* Connect Button - close to links on mobile, bottom on md+ */}
            <div className="mt-6 md:mt-0 pt-4 border-t border-white/10">
              <ConnectButton stacked />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
