import { authStatus } from '@/lib/setupAuth';

export const runtime = 'nodejs';

// Current auth state, for the /setup UI and the landing badge.
export async function GET() {
  return Response.json(authStatus());
}
