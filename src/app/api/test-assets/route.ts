import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const SOLANA_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

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

    const data = await res.json();
    
    if (data.error) {
      return NextResponse.json({ error: data.error });
    }

    const items = data.result?.items || [];
    const fungible = items.filter((i: any) => 
      i.interface === 'FungibleToken' || i.interface === 'FungibleAsset'
    );

    return NextResponse.json({
      total_items: items.length,
      fungible_tokens: fungible.length,
      sample_fungible: fungible.slice(0, 3).map((i: any) => ({
        interface: i.interface,
        id: i.id,
        symbol: i.content?.metadata?.symbol,
        name: i.content?.metadata?.name,
        balance: i.token_info?.balance,
        decimals: i.token_info?.decimals,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}