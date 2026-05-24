'use client';

import { useMemo, ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter, CoinbaseWalletAdapter, LedgerWalletAdapter } from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

// Use Ankr as it's one of the most reliable free RPCs
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.ankr.com/solana';

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [
    // Phantom with custom RPC to avoid blocked default
    new PhantomWalletAdapter({ rpcUrl }),
    new SolflareWalletAdapter(),
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