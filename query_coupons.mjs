import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const WORKSPACE_ID = '313aa5ab-7d05-4ffd-8f77-306e0a81e488';
const VALID_STATUSES = ['paid', 'invoiced', 'shipped', 'delivered'];

async function fetchAllOrders() {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('yampi_orders')
      .select('coupon_code, revenue, status')
      .eq('workspace_id', WORKSPACE_ID)
      .not('coupon_code', 'is', null)
      .in('status', VALID_STATUSES)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Supabase error:', error);
      process.exit(1);
    }

    allRows = allRows.concat(data);
    console.log(`Fetched rows ${from}–${from + data.length - 1} (${data.length} rows)`);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

async function main() {
  const rows = await fetchAllOrders();
  console.log(`\nTotal rows fetched: ${rows.length}\n`);

  // Group by coupon_code
  const grouped = {};
  for (const row of rows) {
    const code = row.coupon_code;
    if (!grouped[code]) {
      grouped[code] = { orders: 0, revenue: 0 };
    }
    grouped[code].orders += 1;
    grouped[code].revenue += Number(row.revenue) || 0;
  }

  // Sort by revenue DESC
  const sorted = Object.entries(grouped)
    .map(([coupon_code, stats]) => ({
      coupon_code,
      orders: stats.orders,
      revenue: Math.round(stats.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  // Print formatted table
  const maxCode = Math.max(11, ...sorted.map(r => r.coupon_code.length));
  const maxOrders = Math.max(6, ...sorted.map(r => String(r.orders).length));
  const maxRev = Math.max(7, ...sorted.map(r => r.revenue.toFixed(2).length));

  const header = `${'coupon_code'.padEnd(maxCode)} | ${'orders'.padStart(maxOrders)} | ${'revenue'.padStart(maxRev)}`;
  const separator = '-'.repeat(header.length);

  console.log(header);
  console.log(separator);

  for (const row of sorted) {
    console.log(
      `${row.coupon_code.padEnd(maxCode)} | ${String(row.orders).padStart(maxOrders)} | ${row.revenue.toFixed(2).padStart(maxRev)}`
    );
  }
}

main();
