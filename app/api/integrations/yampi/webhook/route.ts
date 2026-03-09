import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { parseYampiOrder, aggregateOrdersToMetrics, PAID_STATUSES } from '@/lib/yampi/parser'

export async function POST(request: Request) {
  try {
    // ── HMAC signature validation ──
    const webhookSecret = process.env.YAMPI_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = request.headers.get('x-yampi-hmac-sha256')
        ?? request.headers.get('x-yampi-signature')
      const rawBody = await request.clone().text()

      if (!signature) {
        console.warn('[yampi/webhook] missing signature header')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
      const sigBuffer = Buffer.from(signature, 'hex')
      const expectedBuffer = Buffer.from(expected, 'hex')

      if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
        console.warn('[yampi/webhook] invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = await request.json()
    const resource = payload.resource
    if (!resource) return NextResponse.json({ received: true })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Busca workspace com integração yampi ativa
    const { data: integration } = await supabase
      .from('workspace_integrations')
      .select('workspace_id')
      .eq('provider', 'yampi')
      .eq('status', 'active')
      .single()

    if (!integration) return NextResponse.json({ received: true })

    const workspace_id = integration.workspace_id

    // Parse using shared parser (consistent normalization)
    const order = parseYampiOrder(resource, workspace_id)

    // Upsert pedido
    await supabase.from('yampi_orders').upsert(order, { onConflict: 'workspace_id,order_id' })

    // Recalcula métricas do dia using shared aggregator
    const { data: dayOrders } = await supabase
      .from('yampi_orders')
      .select('date, status, revenue, payment_method')
      .eq('workspace_id', workspace_id)
      .eq('date', order.date)

    if (dayOrders && dayOrders.length > 0) {
      const metrics = aggregateOrdersToMetrics(dayOrders, workspace_id)
      if (metrics.length > 0) {
        await supabase.from('yampi_metrics').upsert(metrics[0], { onConflict: 'workspace_id,date' })
      }
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[yampi/webhook] error:', e)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
