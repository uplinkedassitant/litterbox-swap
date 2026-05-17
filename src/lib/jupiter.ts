import { Token, SwapQuote } from '@/types';

const JUP_API = 'https://api.jup.ag';
const JUP_API_KEY = process.env.NEXT_PUBLIC_JUP_API_KEY || '';

const headers: HeadersInit = JUP_API_KEY
  ? { 'x-api-key': JUP_API_KEY }
  : {};

export async function getPortfolioPositions(walletAddress: string): Promise<Token[]> {
  try {
    const res = await fetch(
      `${JUP_API}/portfolio/v1/positions?wallet=${walletAddress}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Portfolio API error: ${res.status}`);
    const data = await res.json();

    const tokens: Token[] = (data?.tokens || [])
      .filter((t: { quantity: number }) => t.quantity > 0)
      .map((t: { mint: string; symbol: string; name: string; decimals: number; logoURI?: string; quantity: number }) => ({
        mint: t.mint,
        symbol: t.symbol || 'Unknown',
        name: t.name || t.symbol || 'Unknown Token',
        decimals: t.decimals || 0,
        logoURI: t.logoURI,
        balance: t.quantity,
      }));

    return tokens;
  } catch {
    return [];
  }
}

export async function searchTokens(query: string): Promise<Token[]> {
  if (!query || query.length < 2) return [];
  const res = await fetch(
    `${JUP_API}/tokens/v2/search?query=${encodeURIComponent(query)}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Token search error: ${res.status}`);
  const data = await res.json();
  return (data.tokens || []).slice(0, 20);
}

export async function getTokenPrice(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const res = await fetch(
    `${JUP_API}/price/v3?ids=${mints.join(',')}`,
    { headers }
  );
  if (!res.ok) return {};
  const data = await res.json();
  const prices: Record<string, number> = {};
  for (const [mint, info] of Object.entries(data.data || {})) {
    prices[mint] = (info as { price?: number }).price || 0;
  }
  return prices;
}

export async function getSwapQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  wallet: string;
}): Promise<SwapQuote> {
  const { inputMint, outputMint, amount, slippageBps, wallet } = params;
  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    wallet,
    priorityFeeUsd: '0.001',
  });

  const res = await fetch(`${JUP_API}/swap/v2/order?${qs}`, { headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Swap quote error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return {
    inputMint,
    outputMint,
    inputAmount: amount,
    estimatedOutput: parseFloat(data.outAmount || '0'),
    priceImpactPct: parseFloat(data.priceImpactPct || '0'),
    orderId: data.orderId,
    swapTransaction: data.swapTransaction,
  };
}

export async function getJupiterTokenInfo(mint: string): Promise<Token | null> {
  try {
    const res = await fetch(
      `${JUP_API}/tokens/v2/search?query=${mint}`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.tokens?.find((t: Token) => t.mint === mint) || null;
  } catch {
    return null;
  }
}