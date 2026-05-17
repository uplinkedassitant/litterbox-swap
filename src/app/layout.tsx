import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider as WagmiWalletProvider } from '@/app/wallet-provider';
import { WizardProvider } from '@/lib/WizardContext';

export const metadata: Metadata = {
  title: 'Litterbox — Batch Swap',
  description: 'Swap multiple tokens to any PumpFun token in one flow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WagmiWalletProvider>
          <WizardProvider>
            {children}
          </WizardProvider>
        </WagmiWalletProvider>
      </body>
    </html>
  );
}