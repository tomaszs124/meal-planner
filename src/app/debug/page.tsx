'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase, Household, HouseholdUser } from '@/lib/supabase/client'

type RawQueryResult = { data: unknown; error: { message: string; code?: string } | null }

/**
 * Developer-only page that dumps auth / household rows for the signed-in user.
 * Never served in production: it would expose raw account data.
 */
export default function DebugPage() {
  const [user, setUser] = useState<User | null>(null)
  const [householdUsers, setHouseholdUsers] = useState<HouseholdUser[]>([])
  const [households, setHouseholds] = useState<Household[]>([])
  const [rawQuery, setRawQuery] = useState<RawQueryResult | null>(null)

  useEffect(() => {
    async function fetchDebugData() {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      if (!currentUser) return

      // Get all household_users for this user
      const { data: huData } = await supabase
        .from('household_users')
        .select('*')
        .eq('user_id', currentUser.id)

      setHouseholdUsers((huData || []) as HouseholdUser[])

      // Get all households
      const { data: hData } = await supabase
        .from('households')
        .select('*')

      setHouseholds((hData || []) as Household[])

      // Try the original query
      const { data: rawData, error: rawError } = await supabase
        .from('household_users')
        .select(`
          households:household_id (
            id,
            name,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', currentUser.id)
        .single()

      setRawQuery({ data: rawData, error: rawError })
    }

    fetchDebugData()
  }, [])

  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Debug Information</h1>

        {/* Current User */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Current User</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        {/* Household Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Household Users (for user_id: {user?.id})
          </h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(householdUsers, null, 2)}
          </pre>
        </div>

        {/* All Households */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">All Households</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(households, null, 2)}
          </pre>
        </div>

        {/* Raw Query Result */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Raw Query Result</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(rawQuery, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
