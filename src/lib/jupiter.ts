import { Token, SwapQuote } from '@/types';

const JUP_API = 'https://api.jup.ag';
const JUP_API_KEY = process.env.NEXT_PUBLIC_JUP_API_KEY || '';

// Token info cache
let tokenListCache: { tokens: Token[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const jupHeaders: HeadersInit = JUP_API_KEY
  ? { 'x-api-key': JUP_API_KEY }
  : {};

// RPC endpoints to try in order (public ones that allow CORS)
const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_RPC_URL,
  'https://solana-mainnet.g.alchemy.com/v2/demo',
  'https://rpc.ankr.com/solana',
  'https://api.mainnet-beta.solana.com',
].filter(Boolean) as string[];

// Token Program IDs (classic + Token-2022)
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Gt413sVTt';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFL6LxiyMeyaTku5eAY';

// ─── RPC helpers (raw JSON-RPC, no @solana/web3.js dependency at runtime) ────

async function rpcCall(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

async function rpcCallWithFallback(method: string, params: unknown[]): Promise<unknown> {
  let lastErr: Error | null = null;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const result = await rpcCall(endpoint, method, params);
      return result;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn(`[Litterbox] RPC ${endpoint} failed:`, lastErr.message);
    }
  }
  throw lastErr || new Error('All RPC endpoints failed');
}

// ─── Token list ───────────────────────────────────────────────────────────────

async function getTokenList(): Promise<Map<string, Token>> {
  const now = Date.now();
  if (tokenListCache && now - tokenListCache.timestamp < CACHE_TTL) {
    return new Map(tokenListCache.tokens.map(t => [t.mint, t]));
  }

  // Jupiter "strict" token list — well-known, stable endpoint
  const endpoints = [
    `${JUP_API}/tokens/v1/strict`,
    `${JUP_API}/tokens/v1/all`,
    'https://token.jup.ag/strict',
    'https://token.jup.ag/all',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: jupHeaders });
      if (!res.ok) continue;
      const data = await res.json();
      const raw: unknown[] = Array.isArray(data) ? data : (data.tokens ?? []);
      const tokens: Token[] = raw.map((t: any) => ({
        mint: t.address || t.mint,
        symbol: t.symbol || 'Unknown',
        name: t.name || t.symbol || 'Unknown Token',
        decimals: t.decimals ?? 0,
        logoURI: t.logoURI || t.icon || undefined,
      }));
      tokenListCache = { tokens, timestamp: now };
      console.log(`[Litterbox] Loaded ${tokens.length} tokens from ${url}`);
      return new Map(tokens.map(t => [t.mint, t]));
    } catch (e) {
      console.warn('[Litterbox] Token list endpoint failed:', url, e);
    }
  }

  console.warn('[Litterbox] All token list endpoints failed, using empty map');
  return new Map();
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export async function getPortfolioPositions(walletAddress: string): Promise<Token[]> {
  console.log('[Litterbox] getPortfolioPositions:', walletAddress);
  if (!walletAddress) throw new Error('Wallet address required');

  // Validate address (base58, 32–44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  // Fetch token accounts for both classic SPL and Token-2022
  const fetchAccounts = async (programId: string) => {
    const result = await rpcCallWithFallback('getParsedTokenAccountsByOwner', [
      walletAddress,
      { programId },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]) as { value: any[] };
    return result?.value ?? [];
  };

  let allAccounts: any[] = [];
  try {
    const [spl, spl2022] = await Promise.all([
      fetchAccounts(TOKEN_PROGRAM_ID),
      fetchAccounts(TOKEN_2022_PROGRAM_ID).catch(() => []), // Token-2022 optional
    ]);
    allAccounts = [...spl, ...spl2022];
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch token accounts';
    throw new Error(`RPC error: ${msg}. Check your RPC endpoint (NEXT_PUBLIC_RPC_URL).`);
  }

  console.log('[Litterbox] Raw accounts:', allAccounts.length);

  // Get token metadata
  const tokenList = await getTokenList();

  const tokens: Token[] = [];
  for (const account of allAccounts) {
    try {
      const data = account?.account?.data;
      if (!data || !('parsed' in data) || !data.parsed) continue;
      const info = data.parsed.info;
      const mint: string = info.mint;
      const uiAmount: number = info.tokenAmount?.uiAmount ?? 0;
      const decimals: number = info.tokenAmount?.decimals ?? 0;

      if (uiAmount <= 0) continue; // skip zero balances

      const meta = tokenList.get(mint);
      tokens.push({
        mint,
        symbol: meta?.symbol || mint.slice(0, 6) + '…',
        name: meta?.name || meta?.symbol || 'Unknown Token',
        decimals: meta?.decimals ?? decimals,
        logoURI: meta?.logoURI,
        balance: uiAmount,
      });
    } catch {
      // skip malformed account
    }
  }

  console.log('[Litterbox] Tokens with balance:', tokens.length);
  tokens.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  return tokens;
}

// ─── Token prices ─────────────────────────────────────────────────────────────

export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  try {
    // Jupiter Price V2
    const res = await fetch(
      `${JUP_API}/price/v2?ids=${mints.join(',')}`,
      { headers: jupHeaders }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const [mint, info] of Object.entries(data.data ?? {})) {
      prices[mint] = (info as any).price ?? 0;
    }
    return prices;
  } catch {
    return {};
  }
}

// Keep old name for compatibility
export const getTokenPrice = getTokenPrices;

// ─── Token search ─────────────────────────────────────────────────────────────

export async function searchTokens(query: string): Promise<Token[]> {
  if (!query || query.length < 2) return [];

  // Try Jupiter token search endpoints
  const searchEndpoints = [
    `${JUP_API}/tokens/v1/search?query=${encodeURIComponent(query)}&limit=20`,
    `${JUP_API}/tokens/v2/search?query=${encodeURIComponent(query)}`,
  ];

  for (const url of searchEndpoints) {
    try {
      const res = await fetch(url, { headers: jupHeaders });
      if (!res.ok) continue;
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (data.tokens ?? []);
      if (raw.length > 0) {
        return raw.slice(0, 20).map((t: any) => ({
          mint: t.address || t.mint,
          symbol: t.symbol || 'Unknown',
          name: t.name || t.symbol || 'Unknown Token',
          decimals: t.decimals ?? 0,
          logoURI: t.logoURI || t.icon || undefined,
        }));
      }
    } catch {
      continue;
    }
  }

  // Fallback: search cached token list
  const tokenList = await getTokenList();
  const q = query.toLowerCase();
  const results: Token[] = [];
  for (const [, token] of tokenList) {
    if (
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.mint.toLowerCase() === q
    ) {
      results.push(token);
      if (results.length >= 20) break;
    }
  }
  return results;
}

// ─── Token info ───────────────────────────────────────────────────────────────

export async function getJupiterTokenInfo(mint: string): Promise<Token | null> {
  const tokenList = await getTokenList();
  if (tokenList.has(mint)) return tokenList.get(mint)!;

  // Try direct lookup
  const lookupEndpoints = [
    `${JUP_API}/tokens/v1/${mint}`,
    `${JUP_API}/tokens/v1/search?query=${mint}&limit=5`,
  ];
  for (const url of lookupEndpoints) {
    try {
      const res = await fetch(url, { headers: jupHeaders });
      if (!res.ok) continue;
      const data = await res.json();
      const t = Array.isArray(data) ? data.find((x: any) => (x.address || x.mint) === mint) : data;
      if (t) {
        return {
          mint: t.address || t.mint || mint,
          symbol: t.symbol || 'Unknown',
          name: t.name || t.symbol || 'Unknown Token',
          decimals: t.decimals ?? 0,
          logoURI: t.logoURI || t.icon || undefined,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Swap quote ───────────────────────────────────────────────────────────────

export async function getSwapQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  wallet: string;
}): Promise<SwapQuote> {
  const { inputMint, outputMint, amount, slippageBps, wallet } = params;

  // Jupiter Ultra API (recommended in 2025)
  const ultraUrl = `${JUP_API}/ultra/v1/order`;
  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    taker: wallet,
  });

  let res = await fetch(`${ultraUrl}?${qs}`, { headers: jupHeaders });

  // Fallback to swap/v1
  if (!res.ok) {
    const swapQs = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });
    const quoteRes = await fetch(`${JUP_API}/swap/v1/quote?${swapQs}`, { headers: jupHeaders });
    if (!quoteRes.ok) throw new Error(`Quote error ${quoteRes.status}: ${await quoteRes.text()}`);
    const quote = await quoteRes.json();

    const swapRes = await fetch(`${JUP_API}/swap/v1/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...jupHeaders },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: wallet,
        wrapAndUnwrapSol: true,
      }),
    });
    if (!swapRes.ok) throw new Error(`Swap build error ${swapRes.status}`);
    const swapData = await swapRes.json();

    return {
      inputMint,
      outputMint,
      inputAmount: amount,
      estimatedOutput: parseFloat(quote.outAmount || '0'),
      priceImpactPct: parseFloat(quote.priceImpactPct || '0'),
      swapTransaction: swapData.swapTransaction,
    };
  }

  const data = await res.json();
  return {
    inputMint,
    outputMint,
    inputAmount: amount,
    estimatedOutput: parseFloat(data.outAmount || '0'),
    priceImpactPct: parseFloat(data.priceImpactPct || '0'),
    orderId: data.orderId,
    swapTransaction: data.transaction || data.swapTransaction,
  };
}

// Legacy compat
export function setConnection(_: unknown) {
  // no-op
}