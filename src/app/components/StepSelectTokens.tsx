'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWizard } from '@/lib/WizardContext';
import { getPortfolioPositions } from '@/lib/jupiter';
import { Token } from '@/types';
import { TokenCard } from './TokenCard';

export function StepSelectTokens() {
  const { publicKey } = useWallet();
  const { selectedTokens, setSelectedTokens, toggleToken, setStep } = useWizard();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchTokens = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setError('');
    try {
      const walletTokens = await getPortfolioPositions(publicKey.toBase58());
      setTokens(walletTokens);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const filtered = tokens.filter(t =>
    !search ||
    t.symbol.toLowerCase().includes(search.toLowerCase()) ||
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (mint: string) => selectedTokens.some(t => t.mint === mint);
  const canContinue = selectedTokens.length > 0;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Select Tokens to Swap</h2>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? 'Loading...' : `${tokens.length} tokens found`}
          </p>
        </div>
        <button
          onClick={() => setStep('target')}
          disabled={!canContinue}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
            canContinue
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue →
        </button>
      </div>

      <input
        type="text"
        placeholder="Search tokens..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
      />

      <div className="flex gap-3 mb-4">
        <button onClick={() => setSelectedTokens([...tokens])} className="text-sm text-blue-400 hover:text-blue-300">Select All</button>
        <button onClick={() => setSelectedTokens([])} className="text-sm text-gray-400 hover:text-gray-300">Clear</button>
        {selectedTokens.length > 0 && (
          <span className="text-sm text-green-400 ml-auto">{selectedTokens.length} selected</span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          Loading your tokens...
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-400 mb-2">Failed to load tokens</div>
          <div className="text-gray-500 text-sm">{error}</div>
          <button onClick={fetchTokens} className="mt-3 text-blue-400 hover:text-blue-300 text-sm">Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {tokens.length === 0 ? 'No tokens found in wallet' : 'No tokens match your search'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
          {filtered.map(token => (
            <TokenCard
              key={token.mint}
              token={token}
              selected={isSelected(token.mint)}
              onToggle={() => toggleToken(token)}
            />
          ))}
        </div>
      )}
    </div>
  );
}