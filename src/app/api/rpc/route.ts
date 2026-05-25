import { NextRequest, NextResponse } from 'next/server';

// Use Helius RPC (public RPC is blocked from Vercel)
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const SOLANA_RPC = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[RPC Proxy] Method:', body.method);
    console.log('[RPC Proxy] HELIUS_API_KEY set:', !!HELIUS_API_KEY);
    console.log('[RPC Proxy] Key prefix:', HELIUS_API_KEY?.slice(0, 8) || 'none');
    console.log('[RPC Proxy] Using RPC:', HELIUS_API_KEY ? 'Helius' : 'Solana Public');

    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log('[RPC Proxy] Response status:', res.status);
    const data = await res.json();
    console.log('[RPC Proxy] Response:', JSON.stringify(data)?.slice(0, 200));
    
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
