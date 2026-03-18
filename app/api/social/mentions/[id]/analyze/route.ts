import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWorkspaceAccess } from '@/lib/api-auth'
import Anthropic from '@anthropic-ai/sdk'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { workspace_id } = body

  // Get the mention
  const { data: mention, error: fetchError } = await (adminSupabase as any)
    .from('social_mentions')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !mention) {
    return NextResponse.json({ error: 'Mention not found' }, { status: 404 })
  }

  const wsId = workspace_id || mention.workspace_id
  const auth = await verifyWorkspaceAccess(wsId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `Analise este UGC (User Generated Content) para uma marca de e-commerce brasileira:

Caption: ${mention.caption || '(sem legenda)'}
Tipo de mídia: ${mention.media_type || 'desconhecido'}
Engajamento: ${mention.like_count || 0} likes, ${mention.comments_count || 0} comentários
Tipo de menção: ${mention.mention_type || 'tag'}
${mention.hashtag ? `Hashtag: #${mention.hashtag}` : ''}

Responda APENAS em JSON válido, sem markdown ou texto adicional:
{
  "hook_score": 0-10,
  "hook_analysis": "análise breve do gancho/hook do conteúdo",
  "cta_present": true/false,
  "cta_analysis": "análise do call-to-action",
  "sentiment": "positive|neutral|negative",
  "reuse_potential": 0-10,
  "recommendation": "use|skip|edit",
  "notes": "observações adicionais para a marca"
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let analysis: any
    try {
      analysis = JSON.parse(responseText)
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        return NextResponse.json({ error: 'Failed to parse AI analysis' }, { status: 500 })
      }
    }

    // Save analysis to the mention
    const { data: updated, error: updateError } = await (adminSupabase as any)
      .from('social_mentions')
      .update({
        claude_analysis: analysis,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ analysis, mention: updated })
  } catch (err: any) {
    console.error('[analyze] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
