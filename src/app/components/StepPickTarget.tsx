'use client';

import { useState, useCallback } from 'react';
import { useWizard } from '@/lib/WizardContext';
import { searchTokens, getJupiterTokenInfo } from '@/lib/jupiter';
import { Token } from '@/types';

export function StepPickTarget() {
  const { targetToken, setTargetToken, setStep } = useWizard();
  const [query, setQuery] = useState('');
  const [mintInput, setMintInput] = useState('');
  const [results, setResults] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      setResults(await searchTokens(q));
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUseMint = async () => {
    const mint = mintInput.trim();
    if (!mint) return;
    setLoading(true);
    setError('');
    try {
      const token = await getJupiterTokenInfo(mint);
      setTargetToken(token ?? { mint, symbol: 'Unknown', name: 'Unknown Token', decimals: 0 });
      setResults([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load token');
    } finally {
      setLoading(false);
    }
  };

  const selectToken = (token: Token) => {
    setTargetToken(token);
    setResults([]);
    setQuery('');
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Pick Target Token</h2>
          <p className="text-gray-400 text-sm mt-1">Search or paste a token mint address</p>
        </div>
        <button
          onClick={() => setStep('review')}
          disabled={!targetToken}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
            targetToken
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue →
        </button>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search for a token..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        {loading && <div className="absolute right-4 top-3.5 text-gray-400 text-sm animate-pulse">Searching...</div>}
      </div>

      {results.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-4 max-h-64 overflow-y-auto">
          {results.map(token => (
            <div
              key={token.mint}
              onClick={() => selectToken(token)}
              className="flex items-center gap-3 p-3 hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-700 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {token.logoURI ? (
                  <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-gray-400">{token.symbol?.slice(0, 2).toUpperCase() || ""}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm">{token.symbol}</div>
                <div className="text-gray-500 text-xs truncate">{token.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Or paste token mint address..."
          value={mintInput}
          onChange={e => setMintInput(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
        />
        <button
          onClick={handleUseMint}
          disabled={!mintInput.trim() || loading}
          className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Use
        </button>
      </div>

      {targetToken && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="text-blue-400 text-xs font-semibold mb-2 uppercase tracking-wide">Target Token</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
              {targetToken.logoURI ? (
                <img src={targetToken.logoURI} alt={targetToken.symbol} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-gray-400">{targetToken.symbol?.slice(0, 2).toUpperCase() || ""}</span>
              )}
            </div>
            <div>
              <div className="font-bold text-white">{targetToken.symbol}</div>
              <div className="text-gray-400 text-sm">{targetToken.name}</div>
            </div>
          </div>
          <div className="mt-2 text-gray-500 text-xs font-mono truncate">{targetToken.mint}</div>
        </div>
      )}

      {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
    </div>
  );
}