import { NextRequest, NextResponse } from 'next/server';

// Server-side env var (not exposed to browser)
// Vercel: Settings → Environment Variables → Add "HELIUS_RPC_URL"
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL;
const SOLANA_RPC = HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[RPC Proxy] Method:', body.method);
    console.log('[RPC Proxy] Using RPC:', HELIUS_RPC_URL ? 'Helius' : 'Solana Public (fallback)');

    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    
    if (data.error) {
      console.error('[RPC Proxy] RPC error:', data.error);
      return NextResponse.json({ error: data.error }, { status: 400 });
    }
    
    return NextResponse.json({ result: data.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RPC proxy error';
    console.error('[RPC Proxy] Exception:', message);
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
