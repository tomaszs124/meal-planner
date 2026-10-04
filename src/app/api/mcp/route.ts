import { handleMcpRequest } from '@/lib/mcp/http'

/**
 * MCP endpoint for OAuth clients (ChatGPT, Claude):
 *   POST https://<host>/api/mcp   with  Authorization: Bearer <Supabase user access token>
 * Unauthenticated requests get 401 + WWW-Authenticate so the client starts the
 * OAuth flow against Supabase Auth (see /.well-known/oauth-protected-resource).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request): Promise<Response> {
  return handleMcpRequest(req, '')
}

export { handle as GET, handle as POST, handle as DELETE }
