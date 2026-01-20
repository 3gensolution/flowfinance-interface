import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Web3Provider } from '@/components/wallet/Web3Provider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FlowFinance - Decentralized Crypto Lending',
  description: 'Borrow against your crypto assets or earn yield by providing liquidity. Decentralized lending on Base.',
  keywords: ['DeFi', 'lending', 'crypto', 'Base', 'blockchain', 'loans'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Web3Provider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow pt-16">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 5000,
              style: {
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(12px)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Web3Provider>
      </body>
    </html>
  );
}
