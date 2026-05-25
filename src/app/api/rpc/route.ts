import { NextRequest, NextResponse } from 'next/server';

// Use public Solana RPC (Helius free tier has limitations)
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[RPC Proxy] Method:', body.method);
    console.log('[RPC Proxy] Params:', JSON.stringify(body.params)?.slice(0, 100));
    console.log('[RPC Proxy] Using RPC: Solana Public');

    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('[RPC Proxy] Response status:', res.status);
    const data = await res.json();
    
    if (data.error) {
      console.error('[RPC Proxy] RPC error:', JSON.stringify(data.error));
      console.error('[RPC Proxy] Full response:', JSON.stringify(data));
      console.error('[RPC Proxy] Request body:', JSON.stringify(body));
      return NextResponse.json({ error: data.error, details: data.error.message }, { status: 400 });
    }
    
    console.log('[RPC Proxy] Success!');
    return NextResponse.json({ result: data.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RPC proxy error';
    console.error('[RPC Proxy] Exception:', message);
    console.error('[RPC Proxy] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
