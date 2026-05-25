'use client';

import { useMemo, ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, CoinbaseWalletAdapter, LedgerWalletAdapter } from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

// Use a working RPC - Helius if configured, otherwise use public fallbacks
const getRpcUrl = () => {
  const configured = process.env.NEXT_PUBLIC_RPC_URL || '';
  // If Helius URL has the api-key param and is working, use it
  if (configured.includes('api-key=')) {
    return configured;
  }
  // Otherwise use a public RPC that works in browser
  return 'https://rpc.ankr.com/solana';
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const rpcUrl = getRpcUrl();
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new LedgerWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

// Re-export as ClientWalletProvider for layout.tsx
export const ClientWalletProvider = WalletProvider;