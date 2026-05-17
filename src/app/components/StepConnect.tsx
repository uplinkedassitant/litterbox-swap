'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWizard } from '@/lib/WizardContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { truncateAddress } from '@/lib/utils';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';

export function StepConnect() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setStep, setSelectedTokens } = useWizard();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    connection.getBalance(publicKey).then(bal => setSolBalance(bal / LAMPORTS_PER_SOL));
  }, [publicKey, connection]);

  useEffect(() => {
    if (publicKey) {
      setSelectedTokens([]);
      setStep('select');
    }
  }, [publicKey, setStep, setSelectedTokens]);

  return (
    <div className="text-center py-12">
      <h2 className="text-3xl font-bold text-white mb-2">Connect Your Wallet</h2>
      <p className="text-gray-400 mb-8">
        {connected ? 'Wallet connected!' : 'Connect a Solana wallet to see your token balances'}
      </p>

      {/* This is the wallet adapter's built-in connect button */}
      <div className="flex justify-center mb-6">
        <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-500 !text-white !font-semibold !px-6 !py-3 !rounded-xl !text-base" />
      </div>

      {connected && (
        <div className="mt-4 bg-gray-800 rounded-xl p-4 max-w-sm mx-auto">
          <div className="text-gray-400 text-sm mb-1">Connected</div>
          <div className="text-white font-mono text-lg">{truncateAddress(publicKey?.toBase58() ?? '')}</div>
          {solBalance !== null && (
            <div className="text-blue-400 font-medium mt-1">{solBalance.toFixed(4)} SOL</div>
          )}
          <button
            onClick={disconnect}
            className="mt-3 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}