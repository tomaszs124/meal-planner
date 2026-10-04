'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, type Household } from '@/lib/supabase/client'
import type { HouseholdMember } from './types'
import { getMemberDisplayName } from './shoppingListUtils'

/**
 * Loads household members (household_users + profiles + user_settings) and keeps
 * the selection of members used for generating the shopping list.
 * The current user is auto-selected once members are loaded.
 */
export function useHouseholdMembers(household: Household | null, user: User | null) {
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  // Fetch household members
  useEffect(() => {
    const householdId = household?.id
    const userId = user?.id
    if (!householdId) return

    async function fetchMembers() {
      const { data: householdUsersData } = await supabase
        .from('household_users')
        .select('user_id')
        .eq('household_id', householdId)

      if (householdUsersData) {
        const userIds = householdUsersData.map((hu) => hu.user_id)

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)

        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('*')
          .in('user_id', userIds)

        const profileById = new Map((profilesData || []).map((profile) => [profile.id, profile]))
        const settingsByUserId = new Map((settingsData || []).map((settings) => [settings.user_id, settings]))

        const membersWithProfiles = householdUsersData.map((hu) => ({
          user_id: hu.user_id,
          profile: profileById.get(hu.user_id),
          settings: settingsByUserId.get(hu.user_id),
        }))

        setHouseholdMembers(membersWithProfiles)
        // Auto-select current user
        if (userId) {
          setSelectedMembers([userId])
        }
      }
    }

    fetchMembers()
  }, [household, user?.id])

  // Toggle member selection
  function toggleMember(userId: string) {
    setSelectedMembers((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  function getMemberDisplayNameByUserId(userId: string | null | undefined): string {
    if (!userId) return 'Użytkownik'
    const member = householdMembers.find((householdMember) => householdMember.user_id === userId)
    if (!member) return 'Użytkownik'
    return getMemberDisplayName(member)
  }

  return {
    householdMembers,
    selectedMembers,
    toggleMember,
    getMemberDisplayNameByUserId,
  }
}
