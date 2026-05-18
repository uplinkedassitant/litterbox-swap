import { Token, SwapQuote } from '@/types';

const JUP_API = 'https://api.jup.ag';
const JUP_API_KEY = process.env.NEXT_PUBLIC_JUP_API_KEY || '';

const headers: HeadersInit = JUP_API_KEY
  ? { 'x-api-key': JUP_API_KEY }
  : {};

export async function getPortfolioPositions(walletAddress: string): Promise<Token[]> {
  try {
    // Try the portfolio positions endpoint
    const res = await fetch(
      `${JUP_API}/portfolio/v1/positions/${walletAddress}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Portfolio API error: ${res.status}`);
    const data = await res.json();

    const tokens: Token[] = [];

    // New format: data.elements with type='multiple' for wallet balances
    const elements = data.elements || [];
    for (const element of elements) {
      if (element.type === 'multiple' && element.label === 'Wallet' && element.data?.tokens) {
        for (const t of element.data.tokens) {
          if (t.quantity > 0) {
            tokens.push({
              mint: t.mint,
              symbol: t.symbol || 'Unknown',
              name: t.name || t.symbol || 'Unknown Token',
              decimals: t.decimals || 0,
              logoURI: t.logoURI,
              balance: t.quantity,
            });
          }
        }
      }
    }

    // If no tokens found in the new format, try legacy format
    if (tokens.length === 0 && data.tokens && Array.isArray(data.tokens)) {
      for (const t of data.tokens) {
        if (t.quantity > 0 || t.amount > 0) {
          tokens.push({
            mint: t.mint || t.address,
            symbol: t.symbol || 'Unknown',
            name: t.name || t.symbol || 'Unknown Token',
            decimals: t.decimals || 0,
            logoURI: t.logoURI,
            balance: t.quantity || t.amount,
          });
        }
      }
    }

    // Fallback: if still empty, try wallet token balance endpoint
    if (tokens.length === 0) {
      const balRes = await fetch(
        `${JUP_API}/v6/wallet/${walletAddress}/tokens`,
        { headers }
      );
      if (balRes.ok) {
        const balData = await balRes.json();
        const tokenList = balData || [];
        for (const t of tokenList) {
          const amount = parseFloat(t.amount || t.uiAmount || '0');
          if (amount > 0) {
            tokens.push({
              mint: t.mint,
              symbol: t.symbol || t.mint?.slice(0, 6) || 'Unknown',
              name: t.name || t.symbol || 'Unknown Token',
              decimals: t.decimals || t.token_info?.decimals || 0,
              logoURI: t.logoURI || t.icon || t.token_info?.logoURI,
              balance: amount,
            });
          }
        }
      }
    }

    return tokens;
  } catch (e: unknown) {
    // Fallback: try the v6 wallet tokens endpoint
    try {
      const balRes = await fetch(
        `${JUP_API}/v6/wallet/${walletAddress}/tokens`,
        { headers }
      );
      if (!balRes.ok) throw new Error(`Fallback also failed: ${balRes.status}`);
      const balData = await balRes.json();
      const tokens: Token[] = [];
      const tokenList = balData || [];
      for (const t of tokenList) {
        const amount = parseFloat(t.amount || t.uiAmount || '0');
        if (amount > 0) {
          tokens.push({
            mint: t.mint,
            symbol: t.symbol || t.mint?.slice(0, 6) || 'Unknown',
            name: t.name || t.symbol || 'Unknown Token',
            decimals: t.decimals || t.token_info?.decimals || 0,
            logoURI: t.logoURI || t.icon || t.token_info?.logoURI,
            balance: amount,
          });
        }
      }
      return tokens;
    } catch {
      throw new Error(e instanceof Error ? e.message : 'Failed to load positions');
    }
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
    `${JUP_API}/price/v2?ids=${mints.join(',')}`,
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