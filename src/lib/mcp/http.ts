import { createHash, timingSafeEqual } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { publicEnv } from '@/lib/env'
import { createMcpServer } from './server'
import { actingUserStorage, type ActingPrincipal } from './context'

/**
 * HTTP layer of the MCP endpoint, shared by `/api/mcp` (OAuth) and
 * `/api/mcp/[token]` (legacy shared-secret) routes.
 *
 * Two ways to authenticate, checked in this order:
 *  1. Static access token (path segment or `Authorization: Bearer`), mapped to a
 *     household member via MCP_ACCESS_TOKENS; the server then uses the service role.
 *  2. OAuth 2.1: a Supabase user access token (JWT) in `Authorization: Bearer`,
 *     obtained by the MCP client through Supabase Auth's OAuth server. Verified
 *     against the project's JWKS; the request then runs as that user under RLS.
 * Anything else gets 401 + `WWW-Authenticate` pointing at the protected-resource
 * metadata, which is how MCP clients discover the OAuth flow.
 */

const MIN_TOKEN_LENGTH = 16

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function safeEqual(a: string | null | undefined, b: string): boolean {
  if (!a) return false
  return timingSafeEqual(digest(a), digest(b))
}

/**
 * MCP_ACCESS_TOKENS="<token1>=tomasz@example.com;<token2>=kasia@example.com"
 * (values: e-mails or user UUIDs). Legacy MCP_ACCESS_TOKEN + MCP_ACTING_USER_* also works.
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
    out.push({ token: single, principal: {} })
  }

  return out
}

function bearerOf(req: Request): string | undefined {
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || undefined
}

function staticPrincipal(req: Request, pathToken: string): ActingPrincipal | null {
  const bearer = bearerOf(req)
  for (const entry of tokenTable()) {
    if (safeEqual(pathToken, entry.token) || safeEqual(bearer, entry.token)) return entry.principal
  }
  return null
}

// ---- OAuth 2.1 (Supabase Auth as authorization server) ----

export function authServerIssuer(): string {
  return `${publicEnv.supabaseUrl.replace(/\/$/, '')}/auth/v1`
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${authServerIssuer()}/.well-known/jwks.json`))
  return jwks
}

type SupabaseClaims = JWTPayload & { role?: string; email?: string }

/** Verifies a Supabase user access token; returns the principal or null when invalid. */
async function oauthPrincipal(req: Request): Promise<ActingPrincipal | null> {
  const token = bearerOf(req)
  // Supabase access tokens are JWTs (three dot-separated parts); static tokens are not
  if (!token || token.split('.').length !== 3) return null
  try {
    const { payload } = await jwtVerify<SupabaseClaims>(token, getJwks(), { issuer: authServerIssuer() })
    if (!payload.sub || payload.role !== 'authenticated') return null
    return { userId: payload.sub, email: payload.email, accessToken: token }
  } catch (err) {
    console.warn('MCP: rejected bearer token:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Public origin of this deployment (NEXT_PUBLIC_APP_URL wins over the request URL). */
export function publicOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return new URL(req.url).origin
}

/** RFC 9728 protected-resource metadata; MCP clients fetch it after a 401. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [authServerIssuer()],
    bearer_methods_supported: ['header'],
    resource_name: 'Meal Planner MCP',
  }
}

function unauthorized(req: Request): Response {
  const metadataUrl = `${publicOrigin(req)}/.well-known/oauth-protected-resource`
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"`,
    },
  })
}

/** Handles one MCP HTTP request (stateless Streamable HTTP, JSON responses). */
export async function handleMcpRequest(req: Request, pathToken: string): Promise<Response> {
  const principal = staticPrincipal(req, pathToken) ?? (await oauthPrincipal(req))
  if (!principal) return unauthorized(req)

  const server = createMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session tracking between requests
    enableJsonResponse: true, // plain JSON instead of SSE; works everywhere incl. serverless
  })

  await server.connect(transport)
  try {
    // Every tool call inside this request resolves the acting user (and DB client) from this principal
    return await actingUserStorage.run(principal, () => transport.handleRequest(req))
  } finally {
    void transport.close().catch(() => undefined)
  }
}
