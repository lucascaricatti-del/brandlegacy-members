import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Cliente Supabase com Service Role Key — bypassa RLS.
 * Usar APENAS em Server Actions/Server Components autenticados como admin BrandLegacy.
 * Nunca expor no client-side.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Configuração do Supabase Service Role ausente. ' +
      'Adicione SUPABASE_SERVICE_ROLE_KEY no .env.local'
    )
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
