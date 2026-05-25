import { NextRequest, NextResponse } from 'next/server';

// Server-side env var: only the API key needed
// Vercel: Settings → Environment Variables → Add "HELIUS_API_KEY"
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const SOLANA_RPC = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[RPC Proxy] Method:', body.method);
    console.log('[RPC Proxy] Params:', JSON.stringify(body.params)?.slice(0, 100));
    console.log('[RPC Proxy] Using RPC:', HELIUS_API_KEY ? 'Helius (mainnet)' : 'Solana Public (fallback)');

    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('[RPC Proxy] Response status:', res.status);
    const data = await res.json();
    
    if (data.error) {
      console.error('[RPC Proxy] RPC error:', JSON.stringify(data.error));
      return NextResponse.json({ error: data.error }, { status: 400 });
    }
    
    console.log('[RPC Proxy] Success!');
    return NextResponse.json({ result: data.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RPC proxy error';
    console.error('[RPC Proxy] Exception:', message);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
