'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWizard } from '@/lib/WizardContext';
import { getPortfolioPositions, getTokenPrices } from '@/lib/jupiter';
import { Token } from '@/types';
import { TokenCard } from './TokenCard';

export function StepSelectTokens() {
  const { publicKey } = useWallet();
  const { selectedTokens, setSelectedTokens, toggleToken, setStep } = useWizard();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
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

      // Fetch prices for discovered tokens
      if (walletTokens.length > 0) {
        const mints = walletTokens.map(t => t.mint);
        getTokenPrices(mints).then(setPrices).catch(() => {});
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load tokens';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const filtered = tokens.filter(t =>
    !search ||
    t.symbol.toLowerCase().includes(search.toLowerCase()) ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.mint.toLowerCase().includes(search.toLowerCase())
  );

  const isSelected = (mint: string) => selectedTokens.some(t => t.mint === mint);
  const canContinue = selectedTokens.length > 0;

  const totalSelectedUSD = selectedTokens.reduce((sum, t) => {
    const price = prices[t.mint] ?? 0;
    return sum + (t.balance ?? 0) * price;
  }, 0);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Select Tokens to Swap</h2>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? 'Loading wallet...' : `${tokens.length} token${tokens.length !== 1 ? 's' : ''} found`}
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
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3"
      />

      <div className="flex gap-3 mb-4 items-center">
        <button onClick={() => setSelectedTokens([...tokens])} className="text-sm text-blue-400 hover:text-blue-300">Select All</button>
        <button onClick={() => setSelectedTokens([])} className="text-sm text-gray-400 hover:text-gray-300">Clear</button>
        {selectedTokens.length > 0 && (
          <span className="text-sm text-green-400 ml-auto">
            {selectedTokens.length} selected
            {totalSelectedUSD > 0 && (
              <span className="text-gray-400 ml-1">
                (≈${totalSelectedUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })})
              </span>
            )}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <div>Loading your tokens…</div>
          <div className="text-xs text-gray-600 mt-1">Querying Solana RPC</div>
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-red-500/20">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-red-400 font-medium mb-1">Failed to load tokens</div>
          <div className="text-gray-500 text-sm max-w-xs mx-auto">{error}</div>
          {error.includes('RPC') && (
            <div className="text-gray-600 text-xs mt-2 max-w-xs mx-auto">
              Tip: Set <code className="text-blue-400">NEXT_PUBLIC_RPC_URL</code> to a dedicated RPC endpoint (Helius, QuickNode, etc.)
            </div>
          )}
          <button
            onClick={fetchTokens}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {tokens.length === 0
            ? 'No SPL tokens found in this wallet'
            : 'No tokens match your search'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
          {filtered.map(token => (
            <TokenCard
              key={token.mint}
              token={token}
              selected={isSelected(token.mint)}
              onToggle={() => toggleToken(token)}
              usdPrice={prices[token.mint]}
            />
          ))}
        </div>
      )}
    </div>
  );
}