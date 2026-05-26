import { NextRequest, NextResponse } from 'next/server';

const JUPITER_API = 'https://api.jup.ag';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mint = searchParams.get('mint');

  if (!mint) {
    return NextResponse.json({ error: 'Mint required' }, { status: 400 });
  }

  try {
    // Try to get token info from Jupiter
    const res = await fetch(`${JUPITER_API}/tokens/v1/${mint}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    // If not found, try search as fallback
    const searchRes = await fetch(`${JUPITER_API}/tokens/v1/search?query=${encodeURIComponent(mint)}&limit=1`);
    if (searchRes.ok) {
      const data = await searchRes.json();
      const tokens = Array.isArray(data) ? data : (data.tokens ?? []);
      if (tokens.length > 0) {
        return NextResponse.json(tokens[0]);
      }
    }

    throw new Error('Token not found');
  } catch (error) {
    console.error('[JupiterToken] Error:', error);
    return NextResponse.json({ error: 'Failed to get token info' }, { status: 500 });
  }
}