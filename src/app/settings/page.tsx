'use client'

import UserSettingsForm from '@/components/Settings/UserSettingsForm'
import { PageShell } from '@/components/Layout/PageShell'

export default function SettingsPage() {
  return (
    <PageShell back>
      <UserSettingsForm />
    </PageShell>
  )
}
