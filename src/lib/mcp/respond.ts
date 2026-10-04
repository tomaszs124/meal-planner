import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** Serialises a tool result as pretty JSON text (the format every MCP client understands). */
export function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export function text(value: string): CallToolResult {
  return { content: [{ type: 'text', text: value }] }
}

export function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: `Error: ${message}` }] }
}

/** Runs a tool body and converts thrown errors into MCP error results instead of 500s. */
export async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return fail(message)
  }
}

export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
export const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
