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
    wallet,
  });
}

export async function POST(req: NextRequest) {
  const wallet = '2QDF1kVsvDWrnPcTw7hSr9BBZCxVpi2Tw8o3XqmMXYME';
  
  // Use Helius DAS API format - "options" not "displayOptions"
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getAssetsByOwner',
    params: [{
      ownerAddress: wallet,
      options: {
        showFungible: true,
        showZeroBalance: false,
      },
      limit: 100,
    }],
  };

  console.log('[test-assets] Calling Helius with:', JSON.stringify(requestBody));

  try {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const text = await res.text();
    console.log('[test-assets] Status:', res.status, '| Response:', text.slice(0, 500));
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        status: res.status,
        raw_response: text.slice(0, 500),
        parse_failed: true,
      });
    }
    
    if (data.error) {
      return NextResponse.json({
        rpc_error: data.error,
        note: 'Helius returned error'
      });
    }
    
    const items = data.result?.items || [];
    const fungible = items.filter((i: any) => 
      i.interface === 'FungibleToken' || i.interface === 'FungibleAsset'
    );
    
    return NextResponse.json({
      success: true,
      total_items: items.length,
      fungible_tokens: fungible.length,
      sample: fungible.slice(0, 2).map((i: any) => ({
        mint: i.id,
        symbol: i.content?.metadata?.symbol,
        interface: i.interface,
      })),
    });
  } catch (error) {
    return NextResponse.json({ 
      exception: error instanceof Error ? error.message : String(error),
    });
  }
}