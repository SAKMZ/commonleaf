import { NextResponse } from 'next/server';

/**
 * Liveness probe for container orchestrators.
 *
 * It deliberately does not talk to GitHub: a rate limit or a brief network
 * problem should not make an otherwise healthy container get restarted. Use
 * the settings screen to check whether storage is reachable.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
