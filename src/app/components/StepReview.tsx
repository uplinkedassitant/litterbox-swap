'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWizard } from '@/lib/WizardContext';
import { getSwapQuote } from '@/lib/jupiter';
import { Token, SwapResult } from '@/types';
import { formatTokenAmount } from '@/lib/utils';
import { VersionedTransaction } from '@solana/web3.js';

type SwapStatus = 'idle' | 'in_progress' | 'done';

interface PerTokenStatus {
  token: Token;
  status: SwapStatus;
  txid?: string;
  outputAmount?: number;
  error?: string;
}

const SLIPPAGE_OPTIONS = [
  { label: '0.5%', bps: 50 },
  { label: '1%', bps: 100 },
  { label: '3%', bps: 300 },
];

export function StepReview() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { selectedTokens, targetToken, slippageBps, setSlippageBps, setSwapResults, resetWizard, setStep } = useWizard();

  const [tokenStatuses, setTokenStatuses] = useState<PerTokenStatus[]>([]);
  const [executing, setExecuting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (targetToken && selectedTokens.length > 0 && tokenStatuses.length === 0) {
      setTokenStatuses(selectedTokens.map(t => ({ token: t, status: 'idle' as SwapStatus })));
    }
  }, [targetToken, selectedTokens, tokenStatuses.length]);

  const executeSwaps = useCallback(async () => {
    if (!publicKey || !signTransaction || !targetToken) return;
    setExecuting(true);
    setDone(false);
    const results: SwapResult[] = [];
    const statuses: PerTokenStatus[] = selectedTokens.map(t => ({ token: t, status: 'idle' as SwapStatus }));
    setTokenStatuses([...statuses]);

    for (let i = 0; i < selectedTokens.length; i++) {
      const token = selectedTokens[i];
      setCurrentIndex(i);
      statuses[i].status = 'in_progress';
      setTokenStatuses([...statuses]);

      try {
        const amountRaw = Math.floor((token.balance || 0) * Math.pow(10, token.decimals));
        if (amountRaw <= 0) throw new Error('No balance');

        const quote = await getSwapQuote({
          inputMint: token.mint,
          outputMint: targetToken.mint,
          amount: amountRaw,
          slippageBps,
          wallet: publicKey.toBase58(),
        });

        if (!quote.swapTransaction) throw new Error('No transaction in quote');

        const txBuf = Buffer.from(quote.swapTransaction, 'base64');
        const tx = VersionedTransaction.deserialize(txBuf);
        const signed = await signTransaction(tx);

        const apiKeyHeader: HeadersInit = {};
        const apiKey = process.env.NEXT_PUBLIC_JUP_API_KEY;
        if (apiKey) apiKeyHeader['x-api-key'] = apiKey;

        const res = await fetch('https://api.jup.ag/swap/v2/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...apiKeyHeader },
          body: JSON.stringify({ orderId: quote.orderId }),
        });

        if (!res.ok) throw new Error(`Execute failed: ${res.status}`);
        const data = await res.json();
        const txid = data.txid || data.signature || 'unknown';
        const outputAmt = quote.estimatedOutput / Math.pow(10, targetToken.decimals);
        const doneStatus: PerTokenStatus = { token, status: 'done', txid, outputAmount: outputAmt };
        statuses[i] = doneStatus;
        results.push({ token, success: true, txid, outputAmount: outputAmt });
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : 'Swap failed';
        const failStatus: PerTokenStatus = { token, status: 'done', error: errMsg };
        statuses[i] = failStatus;
        results.push({ token, success: false, error: errMsg });
      }

      setTokenStatuses([...statuses]);
    }

    setSwapResults(results);
    setDone(true);
    setExecuting(false);
    setCurrentIndex(-1);
  }, [publicKey, signTransaction, selectedTokens, targetToken, slippageBps, setSwapResults]);

  const successes = tokenStatuses.filter(s => s.status === 'done' && !s.error).length;
  const failures = tokenStatuses.filter(s => s.error).length;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Review & Execute</h2>
          <p className="text-gray-400 text-sm mt-1">
            {selectedTokens.length} token{selectedTokens.length !== 1 ? 's' : ''} → {targetToken?.symbol}
          </p>
        </div>
        {!done && (
          <button onClick={() => setStep('select')} className="text-gray-400 hover:text-white text-sm transition-colors">← Back</button>
        )}
      </div>

      {!executing && !done && (
        <div className="mb-6">
          <div className="text-gray-400 text-sm mb-2">Slippage Tolerance</div>
          <div className="flex gap-2">
            {SLIPPAGE_OPTIONS.map(opt => (
              <button
                key={opt.bps}
                onClick={() => setSlippageBps(opt.bps)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  slippageBps === opt.bps ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 mb-6">
        {tokenStatuses.map(({ token, status, txid, outputAmount, error }) => (
          <div key={token.mint} className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                  {token.logoURI ? (
                    <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{token.symbol.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{token.symbol}</div>
                  <div className="text-gray-500 text-xs">{formatTokenAmount(token.balance || 0, token.decimals)}</div>
                </div>
              </div>
              <div className="text-right">
                {status === 'idle' && <span className="text-gray-500 text-sm">Pending</span>}
                {status === 'in_progress' && <span className="text-blue-400 text-sm animate-pulse">Swapping...</span>}
                {status === 'done' && !error && (
                  <div>
                    <div className="text-green-400 text-sm font-medium">
                      +{formatTokenAmount(outputAmount || 0, targetToken?.decimals || 0)} {targetToken?.symbol}
                    </div>
                    {txid && <div className="text-gray-500 text-xs">{txid.slice(0, 6)}...{txid.slice(-4)}</div>}
                  </div>
                )}
                {status === 'done' && error && <span className="text-red-400 text-sm">❌ {error.slice(0, 50)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!executing && !done && (
        <button
          onClick={executeSwaps}
          disabled={!connected}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            connected
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {connected ? `Swap ${selectedTokens.length} Tokens → ${targetToken?.symbol}` : 'Connect Wallet to Swap'}
        </button>
      )}

      {executing && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3 animate-bounce">⚡</div>
          <div className="text-white font-semibold">Swapping {currentIndex + 1} of {selectedTokens.length}...</div>
          <div className="text-gray-400 text-sm mt-1">Approve each transaction in your wallet</div>
        </div>
      )}

      {done && (
        <div className="text-center py-6">
          <div className="text-5xl mb-3">🎉</div>
          <div className="text-white font-bold text-xl mb-2">Swaps Complete!</div>
          <div className="text-gray-400 mb-6">
            <span className="text-green-400">{successes} succeeded</span>
            {failures > 0 && <span className="text-red-400"> · {failures} failed</span>}
          </div>
          <button onClick={resetWizard} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors">
            Swap More Tokens
          </button>
        </div>
      )}
    </div>
  );
}