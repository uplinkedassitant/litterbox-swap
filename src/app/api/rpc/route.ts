import { NextRequest, NextResponse } from 'next/server';

// Use Helius if configured, otherwise fallback to public RPC
const SOLANA_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }
    
    return NextResponse.json({ result: data.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RPC proxy error';
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
