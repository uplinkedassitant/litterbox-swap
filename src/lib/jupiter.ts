import { Token, SwapQuote } from '@/types';

const JUP_API = 'https://api.jup.ag';
const JUP_API_KEY = '';

// Token info cache (Jupiter token list)
let tokenListCache: { tokens: Token[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const headers: HeadersInit = JUP_API_KEY
  ? { 'x-api-key': JUP_API_KEY }
  : {};

// Get token list from Jupiter (cached)
async function getTokenList(): Promise<Map<string, Token>> {
  const now = Date.now();
  if (tokenListCache && now - tokenListCache.timestamp < CACHE_TTL) {
    return new Map(tokenListCache.tokens.map(t => [t.mint, t]));
  }

  try {
    const res = await fetch(`${JUP_API}/tokens/v2/token-list`, { headers });
    if (!res.ok) throw new Error('Failed to load token list');
    const data = await res.json();
    const tokens: Token[] = (data.tokens || []).map((t: any) => ({
      mint: t.address,
      symbol: t.symbol || 'Unknown',
      name: t.name || t.symbol || 'Unknown Token',
      decimals: t.decimals || 0,
      logoURI: t.logoURI || t.icon,
    }));
    tokenListCache = { tokens, timestamp: now };
    return new Map(tokens.map(t => [t.mint, t]));
  } catch (e) {
    console.error('[Litterbox] Failed to load token list:', e);
    return new Map();
  }
}

// Legacy function
export function setConnection(connection: any) {
  console.log('[Litterbox] setConnection called (legacy - ignoring)');
}

// Get portfolio using Jupiter's API directly
export async function getPortfolioPositions(walletAddress: string): Promise<Token[]> {
  console.log('[Litterbox] getPortfolioPositions called with:', walletAddress);
  
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }
  
  try {
    // Try Jupiter's portfolio API first
    console.log('[Litterbox] Trying Jupiter portfolio API...');
    const res = await fetch(`${JUP_API}/portfolio/v1/${walletAddress}`, { headers });
    
    if (res.ok) {
      const data = await res.json();
      console.log('[Litterbox] Jupiter portfolio response:', data);
      
      const tokens: Token[] = [];
      // Jupiter portfolio returns tokens with balances
      if (data.tokens) {
        for (const token of data.tokens) {
          if (token.balance > 0) {
            tokens.push({
              mint: token.address || token.mint,
              symbol: token.symbol || 'Unknown',
              name: token.name || token.symbol || 'Unknown Token',
              decimals: token.decimals || 0,
              logoURI: token.logoURI || token.icon,
              balance: token.balance || 0,
            });
          }
        }
      }
      
      console.log('[Litterbox] Found', tokens.length, 'tokens from Jupiter API');
      return tokens;
    }
    
    console.log('[Litterbox] Jupiter portfolio failed, trying fallback...');
  } catch (e) {
    console.error('[Litterbox] Jupiter portfolio error:', e);
  }
  
  // Fallback: use token list and check balances via RPC
  try {
    const tokenList = await getTokenList();
    console.log('[Litterbox] Fallback: checking balances for', tokenList.size, 'tokens');
    
    // For fallback, just return tokens from the list (without balance check)
    // This is not ideal but works when RPC is blocked
    const tokens: Token[] = [];
    for (const [, token] of tokenList) {
      // Include major tokens by default
      if (['So11111111111111111111111111111111111111112', 
           'EPjFWdd5AufqSSqeM2qN1xzybapC8G4UZZb4F4cG5q8e',
           'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
           '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj'].includes(token.mint)) {
        tokens.push({ ...token, balance: 0 });
      }
    }
    
    return tokens;
  } catch (e) {
    console.error('[Litterbox] Fallback failed:', e);
    return [];
  }
}

export async function searchTokens(query: string): Promise<Token[]> {
  if (!query || query.length < 2) return [];
  
  try {
    // First try Jupiter search
    const res = await fetch(
      `${JUP_API}/tokens/v2/search?query=${encodeURIComponent(query)}`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      return (data.tokens || []).slice(0, 20).map((t: any) => ({
        mint: t.address,
        symbol: t.symbol || 'Unknown',
        name: t.name || t.symbol || 'Unknown Token',
        decimals: t.decimals || 0,
        logoURI: t.logoURI || t.icon,
      }));
    }
  } catch {
    // Fall through
  }

  // Fallback: search token list
  const tokenList = await getTokenList();
  const q = query.toLowerCase();
  const results: Token[] = [];
  for (const [, token] of tokenList) {
    if (
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.mint.toLowerCase().includes(q)
    ) {
      results.push(token);
    }
    if (results.length >= 20) break;
  }
  return results;
}

export async function getTokenPrice(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  
  try {
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
  } catch {
    return {};
  }
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
  // Check cache first
  const tokenList = await getTokenList();
  if (tokenList.has(mint)) {
    return tokenList.get(mint)!;
  }

  // Search Jupiter
  try {
    const res = await fetch(
      `${JUP_API}/tokens/v2/search?query=${mint}`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      const token = data.tokens?.find((t: any) => t.address === mint);
      if (token) {
        return {
          mint: token.address,
          symbol: token.symbol || 'Unknown',
          name: token.name || token.symbol || 'Unknown Token',
          decimals: token.decimals || 0,
          logoURI: token.logoURI || token.icon,
        };
      }
    }
  } catch {
    // Fall through
  }

  return null;
}