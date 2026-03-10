import { NextResponse } from 'next/server'

// Deprecated: Realizado is now manual input, stored directly in media_plan_metrics/sales_forecast
// with is_realizado=true. This route is kept as a stub for backwards compatibility.
export async function POST() {
  return NextResponse.json({})
}
