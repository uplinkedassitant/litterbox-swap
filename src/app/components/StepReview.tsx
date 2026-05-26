'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWizard } from '@/lib/WizardContext';
import { getSwapQuote } from '@/lib/jupiter';
import { Token, SwapResult } from '@/types';
import { formatTokenAmount } from '@/lib/utils';
import { VersionedTransaction, Connection } from '@solana/web3.js';

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

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://rpc.ankr.com/solana';

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

  const sendTransaction = useCallback(async (swapTransaction: string): Promise<string> => {
    if (!signTransaction || !publicKey) throw new Error('Wallet not connected');
    const connection = new Connection(RPC_URL, 'confirmed');

    const txBuf = Buffer.from(swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    const signed = await signTransaction(tx);

    const rawTx = signed.serialize();
    const txid = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Wait for confirmation
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight }, 'confirmed');
    return txid;
  }, [signTransaction, publicKey]);

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
      statuses[i] = { ...statuses[i], status: 'in_progress' };
      setTokenStatuses([...statuses]);

      try {
        const decimals = token.decimals ?? 0;
        const amountRaw = Math.floor((token.balance ?? 0) * Math.pow(10, decimals));
        if (amountRaw <= 0) throw new Error('Zero balance — skip');

        const quote = await getSwapQuote({
          inputMint: token.mint,
          outputMint: targetToken.mint,
          amount: amountRaw,
          slippageBps,
          wallet: publicKey.toBase58(),
        });

        if (!quote.swapTransaction) throw new Error('No transaction returned from quote');

        const txid = await sendTransaction(quote.swapTransaction);
        const outputAmt = quote.estimatedOutput / Math.pow(10, targetToken.decimals ?? 0);

        statuses[i] = { token, status: 'done', txid, outputAmount: outputAmt };
        results.push({ token, success: true, txid, outputAmount: outputAmt });
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : 'Swap failed';
        statuses[i] = { token, status: 'done', error: errMsg };
        results.push({ token, success: false, error: errMsg });
      }

      setTokenStatuses([...statuses]);

      // Small delay between swaps
      if (i < selectedTokens.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setSwapResults(results);
    setDone(true);
    setExecuting(false);
    setCurrentIndex(-1);
  }, [publicKey, signTransaction, selectedTokens, targetToken, slippageBps, setSwapResults, sendTransaction]);

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
        {!done && !executing && (
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
          <div key={token.mint} className={`bg-gray-800 rounded-xl p-4 border transition-colors ${
            status === 'in_progress' ? 'border-blue-500/50' :
            status === 'done' && !error ? 'border-green-500/30' :
            status === 'done' && error ? 'border-red-500/30' :
            'border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {token.logoURI ? (
                    <img src={token.logoURI} alt={token.symbol} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{token.symbol?.slice(0, 2).toUpperCase() || ""}</span>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{token.symbol}</div>
                  <div className="text-gray-500 text-xs">{formatTokenAmount(token.balance ?? 0, token.decimals)}</div>
                </div>
              </div>
              <div className="text-right">
                {status === 'idle' && <span className="text-gray-500 text-sm">Pending</span>}
                {status === 'in_progress' && (
                  <span className="text-blue-400 text-sm flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Swapping…
                  </span>
                )}
                {status === 'done' && !error && (
                  <div>
                    <div className="text-green-400 text-sm font-medium">
                      +{formatTokenAmount(outputAmount ?? 0, targetToken?.decimals ?? 0)} {targetToken?.symbol}
                    </div>
                    {txid && (
                      <a
                        href={`https://solscan.io/tx/${txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-xs hover:underline"
                      >
                        {txid?.slice(0, 6)}…{txid?.slice(-4)} ↗
                      </a>
                    )}
                  </div>
                )}
                {status === 'done' && error && (
                  <span className="text-red-400 text-xs max-w-32 text-right block">❌ {String(error)?.slice(0, 60)}</span>
                )}
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
          {connected ? `Swap ${selectedTokens.length} Token${selectedTokens.length !== 1 ? 's' : ''} → ${targetToken?.symbol}` : 'Connect Wallet to Swap'}
        </button>
      )}

      {executing && (
        <div className="text-center py-6">
          <div className="inline-block w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <div className="text-white font-semibold">
            Swapping {currentIndex + 1} of {selectedTokens.length}…
          </div>
          <div className="text-gray-400 text-sm mt-1">Approve each transaction in your wallet</div>
        </div>
      )}

      {done && (
        <div className="text-center py-6">
          <div className="text-5xl mb-3">🎉</div>
          <div className="text-white font-bold text-xl mb-2">Swaps Complete!</div>
          <div className="text-gray-400 mb-6">
            <span className="text-green-400">{successes} succeeded</span>
            {failures > 0 && <span className="text-red-400 ml-2">· {failures} failed</span>}
          </div>
          <button onClick={resetWizard} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors">
            Swap More Tokens
          </button>
        </div>
      )}
    </div>
  );
}