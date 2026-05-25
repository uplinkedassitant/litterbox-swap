import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const SOLANA_RPC = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet') || '2QDF1kVsvDWrnPcTw7hSr9BBZCxVpi2Tw8o3XqmMXYME';
  
  try {
    const body = {
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
      body: JSON.stringify(body),
    });

    const text = await res.text();
    
    // Try to parse response
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return NextResponse.json({ 
        parse_error: 'Failed to parse response as JSON',
        response_text: text.slice(0, 500),
        status: res.status 
      });
    }
    
    if (data.error) {
      return NextResponse.json({ 
        error: data.error,
        note: 'RPC returned error',
        result_keys: data.result ? Object.keys(data.result) : 'no result'
      });
    }

    // Handle different response formats
    const items = data.result?.items || [];
    
    return NextResponse.json({
      has_result: !!data.result,
      result_keys: data.result ? Object.keys(data.result) : null,
      total_items: items.length,
      first_item_interface: items[0]?.interface || 'none',
      fungible_tokens: items.filter((i: any) => 
        i.interface === 'FungibleToken' || i.interface === 'FungibleAsset'
      ).length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}