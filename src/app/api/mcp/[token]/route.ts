import { createHash, timingSafeEqual } from 'node:crypto'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from '@/lib/mcp/server'

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

function isAuthorized(req: Request, pathToken: string): boolean {
  const expected = process.env.MCP_ACCESS_TOKEN
  if (!expected || expected.length < 16) return false

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  return safeEqual(pathToken, expected) || safeEqual(bearer, expected)
}

type RouteContext = { params: Promise<{ token: string }> }

async function handle(req: Request, context: RouteContext): Promise<Response> {
  const { token } = await context.params

  if (!isAuthorized(req, token)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const server = createMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session tracking between requests
    enableJsonResponse: true, // plain JSON instead of SSE; works everywhere incl. serverless
  })

  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } finally {
    // Release resources once the response is produced; cheap because each request builds its own server.
    void transport.close().catch(() => undefined)
  }
}

export { handle as GET, handle as POST, handle as DELETE }
