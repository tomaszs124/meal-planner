import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { publicEnv, requireServerEnv } from './env'

const saved: Record<string, string | undefined> = {}
const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_APP_URL', 'TEST_SECRET']

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('publicEnv', () => {
  it('returns configured values', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1'
    expect(publicEnv.supabaseUrl).toBe('https://x.supabase.co')
    expect(publicEnv.supabasePublishableKey).toBe('sb_publishable_1')
  })

  it('throws a readable error naming the missing variable', () => {
    expect(() => publicEnv.supabaseUrl).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '   '
    expect(() => publicEnv.supabasePublishableKey).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  })

  it('falls back to localhost for the app URL', () => {
    expect(publicEnv.appUrl).toBe('http://localhost:3000')
    process.env.NEXT_PUBLIC_APP_URL = 'https://planner.example'
    expect(publicEnv.appUrl).toBe('https://planner.example')
  })
})

describe('requireServerEnv', () => {
  it('returns the value when set and throws when missing', () => {
    process.env.TEST_SECRET = 'abc'
    expect(requireServerEnv('TEST_SECRET')).toBe('abc')
    delete process.env.TEST_SECRET
    expect(() => requireServerEnv('TEST_SECRET')).toThrow(/TEST_SECRET/)
  })
})
