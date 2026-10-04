#!/usr/bin/env node
/**
 * Smoke test for the MCP endpoint: initialize → tools/list → optional tools/call.
 *
 *   node scripts/mcp-smoke.mjs                      # uses http://localhost:3000 and MCP_ACCESS_TOKEN from env/.env.local
 *   node scripts/mcp-smoke.mjs --url https://host   # remote deployment
 *   node scripts/mcp-smoke.mjs --call get_household # also call one tool (no args)
 */
import { readFileSync, existsSync } from 'node:fs'

function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
loadEnvLocal()

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const base = arg('--url', 'http://localhost:3000').replace(/\/$/, '')
const token = arg('--token', process.env.MCP_ACCESS_TOKEN)
const callTool = arg('--call', null)

if (!token) {
  console.error('Brak MCP_ACCESS_TOKEN (ustaw w .env.local albo podaj --token).')
  process.exit(1)
}

const endpoint = `${base}/api/mcp/${token}`
let nextId = 1

async function rpc(method, params = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  })
  const bodyText = await res.text()
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${bodyText.slice(0, 300)}`)
  // JSON mode returns a single JSON-RPC response; SSE mode would return "data:" lines.
  const jsonText = bodyText.startsWith('event:') || bodyText.startsWith('data:')
    ? bodyText.split('\n').find((l) => l.startsWith('data:'))?.slice(5).trim()
    : bodyText
  const json = JSON.parse(jsonText)
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`)
  return json.result
}

async function notify(method, params = {}) {
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params }),
  })
}

const init = await rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'mcp-smoke', version: '0.0.1' },
})
console.log(`server: ${init.serverInfo?.name} ${init.serverInfo?.version} (protocol ${init.protocolVersion})`)
await notify('notifications/initialized')

const tools = await rpc('tools/list')
console.log(`tools (${tools.tools.length}):`)
for (const t of tools.tools) {
  const flags = t.annotations?.readOnlyHint ? 'read' : t.annotations?.destructiveHint ? 'DESTRUCTIVE' : 'write'
  console.log(`  - ${t.name.padEnd(34)} [${flags}] ${t.description?.split('\n')[0].slice(0, 90) ?? ''}`)
}

if (callTool) {
  const result = await rpc('tools/call', { name: callTool, arguments: {} })
  console.log(`\n${callTool} →`)
  for (const c of result.content ?? []) console.log(c.type === 'text' ? c.text : JSON.stringify(c))
  if (result.isError) process.exitCode = 2
}
