import { NextResponse } from 'next/server';

export async function GET() {
  const heliusKey = process.env.HELIUS_API_KEY;
  const heliusRpc = process.env.HELIUS_RPC_URL;
  
  return NextResponse.json({
    HELIUS_API_KEY_exists: !!heliusKey,
    HELIUS_API_KEY_length: heliusKey?.length || 0,
    HELIUS_API_KEY_first_chars: heliusKey ? heliusKey.slice(0, 8) : 'N/A',
    HELIUS_RPC_URL_exists: !!heliusRpc,
    timestamp: new Date().toISOString(),
  });
}
