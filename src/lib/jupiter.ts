import { Connection, PublicKey, Commitment } from '@solana/web3.js';
import { Token, SwapQuote } from '@/types';

const JUP_API = 'https://api.jup.ag';
const JUP_API_KEY = process.env.NEXT_PUBLIC_JUP_API_KEY || '';

// Try multiple RPC endpoints for reliability
const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

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
      symbol: t.symbol || t.symbol || 'Unknown',
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

// Get RPC connection with retry logic
let connectionCache: Connection | null = null;

function getConnection(): Connection {
  if (connectionCache) return connectionCache;
  
  // Try each RPC endpoint until one works
  for (const url of RPC_ENDPOINTS) {
    try {
      console.log('[Litterbox] Trying RPC:', url);
      const conn = new Connection(url, { commitment: 'confirmed' as Commitment });
      connectionCache = conn;
      return conn;
    } catch (e) {
      console.log('[Litterbox] Failed to create connection:', url, e);
    }
  }
  
  // Fallback to default
  const fallback = new Connection(RPC_ENDPOINTS[0], { commitment: 'confirmed' as Commitment });
  connectionCache = fallback;
  return fallback;
}

export async function getPortfolioPositions(walletAddress: string): Promise<Token[]> {
  console.log('[Litterbox] getPortfolioPositions called with:', walletAddress);
  
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }
  
  try {
    // Validate address format
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(walletAddress);
      console.log('[Litterbox] PublicKey created successfully');
    } catch (e) {
      console.error('[Litterbox] Invalid wallet address:', e);
      throw new Error('Invalid wallet address format: ' + walletAddress);
    }
    
    const connection = getConnection();
    console.log('[Litterbox] Fetching token accounts for:', walletAddress);

    // Get all token accounts owned by the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Gt413sVTt') }
    );

    console.log('[Litterbox] Raw token accounts response:', tokenAccounts.value?.length || 0, 'accounts');

    if (!tokenAccounts.value || tokenAccounts.value.length === 0) {
      console.log('[Litterbox] No token accounts found');
      return [];
    }

    // Get token list for metadata
    const tokenList = await getTokenList();

    const tokens: Token[] = [];
    for (const account of tokenAccounts.value) {
      const accountData = account.account.data;
      if ('parsed' in accountData && accountData.parsed) {
        const info = accountData.parsed.info;
        const mint = info.mint;
        const balance = parseFloat(info.tokenAmount?.uiAmountString || info.tokenAmount?.uiAmount || '0');

        // Skip zero balances
        if (balance <= 0) continue;

        // Look up token metadata
        const meta = tokenList.get(mint);
        
        tokens.push({
          mint,
          symbol: meta?.symbol || mint.slice(0, 6),
          name: meta?.name || meta?.symbol || 'Unknown Token',
          decimals: meta?.decimals || info.tokenAmount?.decimals || 0,
          logoURI: meta?.logoURI,
          balance,
        });
      }
    }

    console.log('[Litterbox] Found', tokens.length, 'tokens with balance');
    
    // Sort by balance (highest first)
    tokens.sort((a, b) => (b.balance || 0) - (a.balance || 0));

    return tokens;
  } catch (e) {
    console.error('[Litterbox] Failed to get portfolio positions:', e);
    const msg = e instanceof Error ? e.message : 'Failed to load token balances';
    throw new Error(msg);
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