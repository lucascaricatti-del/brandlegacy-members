import { NextRequest, NextResponse } from 'next/server'
import { verifyWorkspaceAccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Cast to any — media_plans has plan_type/data/metadata columns in DB but not in TS types
const adminSupabase = createAdminClient() as any

// GET: load calculator data from media_plans metadata
export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data } = await adminSupabase
    .from('media_plans')
    .select('id, metadata')
    .eq('workspace_id', workspace_id!)
    .eq('plan_type', 'calculator')
    .single()

  return NextResponse.json({ data: data?.metadata?.calculadora_estrategica ?? null })
}

// PATCH: save calculator data to media_plans metadata
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, data: calcData } = body

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Try to update existing
  const { data: existing } = await adminSupabase
    .from('media_plans')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('plan_type', 'calculator')
    .single()

  if (existing) {
    await adminSupabase
      .from('media_plans')
      .update({ metadata: { calculadora_estrategica: calcData }, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    // Create new plan record for calculator
    const year = new Date().getFullYear()
    await adminSupabase
      .from('media_plans')
      .insert({
        workspace_id,
        year,
        plan_type: 'calculator',
        data: {},
        metadata: { calculadora_estrategica: calcData },
      })
  }

  return NextResponse.json({ success: true })
}

// DELETE: clear calculator data
export async function DELETE(req: NextRequest) {
  const { workspace_id } = await req.json()

  const auth = await verifyWorkspaceAccess(workspace_id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await adminSupabase
    .from('media_plans')
    .update({ metadata: { calculadora_estrategica: null }, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspace_id)
    .eq('plan_type', 'calculator')

  return NextResponse.json({ success: true })
}
