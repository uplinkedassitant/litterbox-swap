import { NextRequest, NextResponse } from 'next/server';

const JUPITER_API = 'https://api.jup.ag';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const limit = searchParams.get('limit') || '20';

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${JUPITER_API}/tokens/v1/search?query=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Jupiter API error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[JupiterSearch] Error:', error);
    return NextResponse.json({ error: 'Failed to search tokens' }, { status: 500 });
  }
}