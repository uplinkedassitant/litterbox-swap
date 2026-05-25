import type { Metadata } from 'next';
import './globals.css';
import { WizardProvider } from '@/lib/WizardContext';
import { ClientWalletProvider } from '@/app/wallet-provider';

export const metadata: Metadata = {
  title: 'Litterbox — Batch Swap',
  description: 'Swap multiple tokens to any PumpFun token in one flow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ClientWalletProvider>
          <WizardProvider>
            {children}
          </WizardProvider>
        </ClientWalletProvider>
      </body>
    </html>
  );
}