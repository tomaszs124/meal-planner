import { createHash, timingSafeEqual } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from '@/lib/mcp/server'
import { actingUserStorage, type ActingPrincipal } from '@/lib/mcp/context'

/**
 * MCP endpoint (Streamable HTTP, stateless).
 *
 *   POST https://<host>/api/mcp/<MCP_ACCESS_TOKEN>
 *
 * ChatGPT custom connectors cannot send custom headers, so the shared secret
 * travels in the path. Clients that can send headers may instead use
 * `Authorization: Bearer <MCP_ACCESS_TOKEN>` with any path segment.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function safeEqual(a: string | null | undefined, b: string): boolean {
  if (!a) return false
  return timingSafeEqual(digest(a), digest(b))
}

const MIN_TOKEN_LENGTH = 16

/**
 * Access tokens, one per household member, so everyone can connect their own
 * ChatGPT/Claude and the connector acts as them:
 *
 *   MCP_ACCESS_TOKENS="<token1>=tomasz@example.com;<token2>=kasia@example.com"
 *
 * Values are e-mails of Supabase users (or user UUIDs). The legacy single-user
 * setup (MCP_ACCESS_TOKEN + MCP_ACTING_USER_EMAIL/ID) keeps working.
 */
function tokenTable(): { token: string; principal: ActingPrincipal }[] {
  const out: { token: string; principal: ActingPrincipal }[] = []

  const multi = process.env.MCP_ACCESS_TOKENS?.trim()
  if (multi) {
    for (const pair of multi.split(/[;,\n]/)) {
      const [rawToken, rawWho] = pair.split('=').map((s) => s?.trim())
      if (!rawToken || !rawWho || rawToken.length < MIN_TOKEN_LENGTH) continue
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawWho)
      out.push({ token: rawToken, principal: isUuid ? { userId: rawWho } : { email: rawWho } })
    }
  }

  const single = process.env.MCP_ACCESS_TOKEN?.trim()
  if (single && single.length >= MIN_TOKEN_LENGTH) {
    // Principal comes from MCP_ACTING_USER_ID / MCP_ACTING_USER_EMAIL (resolved in context.ts)
    out.push({ token: single, principal: {} })
  }

  return out
}

/** Returns the principal for a valid token (path segment or Bearer header), else null. */
function authorize(req: Request, pathToken: string): ActingPrincipal | null {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  for (const entry of tokenTable()) {
    if (safeEqual(pathToken, entry.token) || safeEqual(bearer, entry.token)) return entry.principal
  }
  return null
}

type RouteContext = { params: Promise<{ token: string }> }

async function handle(req: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params

  const principal = authorize(req, token)
  if (!principal) {
    return new Response('Unauthorized', { status: 401 })
  }

  const server = createMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session tracking between requests
    enableJsonResponse: true, // plain JSON instead of SSE; works everywhere incl. serverless
  })

  await server.connect(transport)
  try {
    // Every tool call inside this request resolves the acting user from this principal
    return await actingUserStorage.run(principal, () => transport.handleRequest(req))
  } finally {
    // Release resources once the response is produced; cheap because each request builds its own server.
    void transport.close().catch(() => undefined)
  }
}

export { handle as GET, handle as POST, handle as DELETE }
