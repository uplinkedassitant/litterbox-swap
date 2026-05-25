import { Token, SwapQuote } from '@/types';

const JUP_API = 'https://api.jup.ag';
const JUP_API_KEY = process.env.JUP_API_KEY || '';

let tokenListCache: { tokens: Token[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const jupHeaders: HeadersInit = JUP_API_KEY ? { 'x-api-key': JUP_API_KEY } : {};

// Use backend proxy to avoid CORS issues
const RPC_PROXY = '/api/rpc';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFL6LxiyMeyaTku5eAY';

async function rpcCall(method: string, params: unknown[] | object): Promise<unknown> {
  const res = await fetch(RPC_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`RPC proxy error ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

// Helius getAssetsByOwner returns ALL asset types including fungible tokens
async function fetchTokensViaHeliusAssets(walletAddress: string): Promise<Token[]> {
  console.log('[Litterbox] Trying getAssetsByOwner for Token2022 support...');
  
  // Use backend proxy with getAssetsByOwner method
  // Helius requires params as object, not array!
  // Need pagination to get all tokens (272+ total, max 100 per page)
  const allItems: any[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const result = await rpcCall('getAssetsByOwner', {
      ownerAddress: walletAddress,
      options: {
        showFungible: true,
        showZeroBalance: false,
      },
      limit: 100,
      page,
    }) as { items: any[] };
    
    const items = result?.items ?? [];
    allItems.push(...items);
    console.log('[Litterbox] getAssetsByOwner page', page, ':', items.length, 'items');
    
    // If we got fewer than 100, we're done
    hasMore = items.length === 100;
    page++;
    
    // Safety limit - don't fetch more than 5 pages
    if (page > 5) break;
  }
  
  console.log('[Litterbox] getAssetsByOwner total:', allItems.length, 'items');
  
  const tokens: Token[] = [];
  for (const item of allItems) {
    // Filter for fungible tokens only (interface: FungibleToken or FungibleAsset)
    const iface = item.interface;
    if (iface !== 'FungibleToken' && iface !== 'FungibleAsset') continue;
    
    const mint = item.id;
    const content = item.content?.metadata ?? {};
    const supply = item.supply ?? {};
    const tokenInfo = item.token_info ?? {};
    
    // Debug: log structure
    console.log('[Litterbox]   Token info - iface:', iface, 'mint:', mint.slice(0,8), 'token_info:', JSON.stringify(tokenInfo).slice(0,100));
    
    // Get decimals from mint info or supply
    const decimals = tokenInfo.decimals ?? supply?.decimals ?? 0;
    // Balance is in token_accounts[0].balance (nested array for DAS API)
    const tokenAccounts = tokenInfo.token_accounts ?? [];
    const balance = tokenAccounts[0]?.balance ?? tokenInfo.balance ?? supply?.amount ?? 0;
    
    if (balance <= 0) continue;
    
    tokens.push({
      mint,
      symbol: content.symbol || mint.slice(0, 6) + '…',
      name: content.name || content.symbol || 'Unknown Token',
      decimals,
      logoURI: item.content?.links?.image ?? item.content?.json_uri,
    });
  }
  
  console.log('[Litterbox] Fungible tokens from getAssetsByOwner:', tokens.length);
  return tokens;
}

async function rpcCallWithFallback(method: string, params: unknown[]): Promise<unknown> {
  const result = await rpcCall(method, params);
  console.log('[Litterbox] Using RPC: Backend proxy');
  return result;
}

async function getTokenList(): Promise<Map<string, Token>> {
  const now = Date.now();
  if (tokenListCache && now - tokenListCache.timestamp < CACHE_TTL) {
    return new Map(tokenListCache.tokens.map(t => [t.mint, t]));
  }

  const endpoints = [`${JUP_API}/tokens/v1/strict`, `${JUP_API}/tokens/v1/all`];

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

export async function getPortfolioPositions(walletAddress: string): Promise<Token[]> {
  console.log('[Litterbox] getPortfolioPositions:', walletAddress);
  if (!walletAddress) throw new Error('Wallet address required');
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  const fetchAccounts = async (programId: string) => {
    const result = await rpcCallWithFallback('getTokenAccountsByOwner', [
      walletAddress,
      { programId },
      { encoding: 'jsonParsed' },
    ]) as { value: any[] };
    return result?.value ?? [];
  };

  let allAccounts: any[] = [];
  let spl2022Accounts: any[] = [];
  let heliusTokens: Token[] = [];
  
  try {
    const [spl, spl2022] = await Promise.all([
      fetchAccounts(TOKEN_PROGRAM_ID),
      fetchAccounts(TOKEN_2022_PROGRAM_ID).catch(() => []),
    ]);
    allAccounts = [...spl, ...spl2022];
    spl2022Accounts = spl2022;
    console.log('[Litterbox] SPL accounts:', spl.length, '| Token2022 accounts:', spl2022.length);
  } catch (e) {
    console.log('[Litterbox] getTokenAccountsByOwner failed:', e instanceof Error ? e.message : String(e));
  }

  // Always try getAssetsByOwner to catch any tokens missed by getTokenAccountsByOwner
  // This handles Token2022 tokens that Helius might not return via getTokenAccountsByOwner
  console.log('[Litterbox] Trying getAssetsByOwner to find any missed tokens...');
  try {
    heliusTokens = await fetchTokensViaHeliusAssets(walletAddress);
    console.log('[Litterbox] Found via getAssetsByOwner:', heliusTokens.length);
    // Debug: print first few
    for (const t of heliusTokens.slice(0,3)) {
      console.log('[Litterbox]   Token:', t.symbol, t.mint.slice(0,12), 'bal:', t.balance);
    }
  } catch (e) {
    console.log('[Litterbox] getAssetsByOwner failed:', e instanceof Error ? e.message : String(e));
  }

  console.log('[Litterbox] Raw accounts:', allAccounts.length);

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

      if (uiAmount <= 0) continue;

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
      // skip malformed
    }
  }

  console.log('[Litterbox] Tokens with balance:', tokens.length);
  
  // Merge with heliusTokens (Token2022) - deduplicate by mint
  if (heliusTokens.length > 0) {
    const existingMints = new Set(tokens.map(t => t.mint));
    for (const ht of heliusTokens) {
      if (!existingMints.has(ht.mint)) {
        const meta = tokenList.get(ht.mint);
        tokens.push({
          ...ht,
          symbol: meta?.symbol ?? ht.symbol,
          name: meta?.name ?? ht.name,
          logoURI: meta?.logoURI ?? ht.logoURI,
        });
      }
    }
    console.log('[Litterbox] Merged Token2022 tokens, total:', tokens.length);
  }
  
  tokens.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  return tokens;
}

export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  try {
    const res = await fetch(`${JUP_API}/price/v2?ids=${mints.join(',')}`, { headers: jupHeaders });
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

export const getTokenPrice = getTokenPrices;

export async function searchTokens(query: string): Promise<Token[]> {
  if (!query || query.length < 2) return [];

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

export async function getJupiterTokenInfo(mint: string): Promise<Token | null> {
  const tokenList = await getTokenList();
  if (tokenList.has(mint)) return tokenList.get(mint)!;

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

export async function getSwapQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  wallet: string;
}): Promise<SwapQuote> {
  const { inputMint, outputMint, amount, slippageBps, wallet } = params;

  const ultraUrl = `${JUP_API}/ultra/v1/order`;
  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    taker: wallet,
  });

  let res = await fetch(`${ultraUrl}?${qs}`, { headers: jupHeaders });

  if (!res.ok) {
    console.log('[Litterbox] Ultra endpoint failed, trying swap endpoint...');
    console.log('[Litterbox] Ultra error:', res.status, await res.text());
    const swapQs = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });
    const quoteRes = await fetch(`${JUP_API}/swap/v1/quote?${swapQs}`, { headers: jupHeaders });
    if (!quoteRes.ok) {
      const errText = await quoteRes.text();
      console.error('[Litterbox] Quote error:', errText);
      // Check for common error patterns
      if (errText.includes('outputMint') || errText.includes('No route found') || errText.includes('not found')) {
        throw new Error('No swap route found - token may have no liquidity');
      }
      throw new Error(`Quote error ${quoteRes.status}: ${errText}`);
    }
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

export function setConnection(_: unknown) {
  // no-op
}