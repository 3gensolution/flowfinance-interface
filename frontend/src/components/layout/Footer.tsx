'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Twitter, Github, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#080F2B]">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image
                src="/awinfi.png"
                alt="AwinFi"
                width={100}
                height={32}
                className="h-8 w-auto"
              />
            </div>
            <p className="text-gray-400 text-sm">
              Decentralized lending protocol on Base. Borrow against your crypto or earn yield by providing liquidity.
            </p>
          </div>

          {/* Products */}
          <div>
            <h3 className="font-semibold text-white mb-4">Products</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/borrow" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Borrow
                </Link>
              </li>
              <li>
                <Link href="/lend" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Lend
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Marketplace
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold text-white mb-4">Community</h3>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} AwinFi. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
