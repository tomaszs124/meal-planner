import { handleMcpRequest } from '@/lib/mcp/http'

/**
 * Legacy MCP endpoint with a shared secret in the path:
 *   POST https://<host>/api/mcp/<token>
 * Kept for clients that cannot do OAuth. The OAuth endpoint is /api/mcp.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteContext = { params: Promise<{ token: string }> }

async function handle(req: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params
  return handleMcpRequest(req, token)
}

export { handle as GET, handle as POST, handle as DELETE }
