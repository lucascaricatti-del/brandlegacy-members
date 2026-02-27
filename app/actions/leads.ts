'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function captureLead(fields: {
  name: string
  email: string
  phone: string | null
  module_id: string
  utm_source: string | null
  utm_campaign: string | null
}) {
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('leads')
    .upsert(
      {
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        module_id: fields.module_id,
        utm_source: fields.utm_source,
        utm_campaign: fields.utm_campaign,
      },
      { onConflict: 'email,module_id' }
    )

  if (error) return { error: error.message }
  return { success: true }
}
