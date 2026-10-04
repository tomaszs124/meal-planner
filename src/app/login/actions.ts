'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const cookieStore = await cookies()

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Ignore - może być wywoływane z Server Action
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', options)
          } catch {
            // Ignore - może być wywoływane z Server Action
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  // Return to the page the user came from (e.g. the OAuth consent screen); internal paths only
  const redirectTo = String(formData.get('redirectTo') || '')
  const target = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/dashboard'
  redirect(target)
}
