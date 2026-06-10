import type { NextRequest } from 'next/server';
import { readPackFromDisk } from '@/lib/language-pack/serverLoader';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const pack = await readPackFromDisk(id);
    return Response.json(pack, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith('invalid pack id') ? 400 : 404;
    return Response.json({ error: msg }, { status });
  }
}
