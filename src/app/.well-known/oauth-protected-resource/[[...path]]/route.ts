import { protectedResourceMetadata, publicOrigin } from '@/lib/mcp/http'

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint.
 * Served at /.well-known/oauth-protected-resource and at the path-suffixed
 * variant /.well-known/oauth-protected-resource/api/mcp that newer MCP clients try first.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  return Response.json(protectedResourceMetadata(publicOrigin(req)), {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
    },
  })
}
