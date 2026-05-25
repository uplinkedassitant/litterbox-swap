import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const SOLANA_RPC = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet') || '2QDF1kVsvDWrnPcTw7hSr9BBZCxVpi2Tw8o3XqmMXYME';
  
  return NextResponse.json({
    HELIUS_API_KEY_set: !!HELIUS_API_KEY,
    HELIUS_API_KEY_prefix: HELIUS_API_KEY?.slice(0, 8) || 'none',
    SOLANA_RPC: SOLANA_RPC.replace(HELIUS_API_KEY, 'XXXX'),
    wallet,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wallet = body.params?.[0]?.ownerAddress || '2QDF1kVsvDWrnPcTw7hSr9BBZCxVpi2Tw8o3XqmMXYME';
    
    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getAssetsByOwner',
      params: [{
        ownerAddress: wallet,
        displayOptions: {
          showFungible: true,
          showZeroBalance: false,
        },
        limit: 100,
      }],
    };

    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const text = await res.text();
    
    // Debug: return what we got
    return NextResponse.json({
      rpc_response_status: res.status,
      rpc_response_first_300: text.slice(0, 300),
      rpc_response_is_json: false,
      trying_to_parse: true,
    });
  } catch (error) {
    return NextResponse.json({ exception: String(error) });
  }
}