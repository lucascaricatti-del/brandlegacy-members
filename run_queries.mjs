import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key] = value;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const WORKSPACE_ID = '313aa5ab-7d05-4ffd-8f77-306e0a81e488';

// Calculate yesterday's date
const now = new Date();
const today = new Date(now);
today.setHours(0, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().slice(0, 10);

console.log(`\n=== Date context ===`);
console.log(`Now (UTC): ${now.toISOString()}`);
console.log(`Yesterday: ${yesterdayStr}`);
console.log(`Filtering: date = '${yesterdayStr}', workspace_id = '${WORKSPACE_ID}'`);

// Fetch all yesterday's orders for this workspace
// Column mapping: date (not created_at), revenue (not value_total), no updated_at column
const { data: orders, error, count } = await supabase
  .from('yampi_orders')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('date', yesterdayStr);

if (error) {
  console.error('Error fetching orders:', error);
  process.exit(1);
}

console.log(`Total rows fetched for yesterday (${yesterdayStr}): ${orders.length}\n`);

// Helper: round to 2 decimals
const round2 = (n) => Math.round(n * 100) / 100;

// QUERY 1 - Status breakdown for yesterday
// Original SQL: SELECT status, COUNT(*) as orders, ROUND(SUM(value_total)::numeric,2) as revenue
//               FROM yampi_orders WHERE workspace_id = '...' AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
//               GROUP BY status ORDER BY revenue DESC
console.log('========================================');
console.log('QUERY 1: Status breakdown for yesterday');
console.log('========================================');
const q1 = {};
for (const o of orders) {
  if (!q1[o.status]) q1[o.status] = { orders: 0, revenue: 0 };
  q1[o.status].orders++;
  q1[o.status].revenue += Number(o.revenue) || 0;
}
const q1rows = Object.entries(q1)
  .map(([status, d]) => ({ status, orders: d.orders, revenue: round2(d.revenue) }))
  .sort((a, b) => b.revenue - a.revenue);
console.table(q1rows);

// QUERY 2 - Orders updated in last 3 hours from yesterday
// Note: yampi_orders has no updated_at column. Using synced_at as the closest proxy.
console.log('\n========================================');
console.log('QUERY 2: Orders synced in last 3 hours from yesterday');
console.log('(Note: no updated_at column exists; using synced_at as proxy)');
console.log('========================================');
const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
console.log(`Filtering synced_at >= ${threeHoursAgo}`);
const q2rows = orders
  .filter(o => o.synced_at && o.synced_at >= threeHoursAgo)
  .sort((a, b) => (b.synced_at || '').localeCompare(a.synced_at || ''))
  .slice(0, 30)
  .map(o => ({
    id: o.id,
    order_id: o.order_id,
    status: o.status,
    revenue: o.revenue,
    date: o.date,
    synced_at: o.synced_at
  }));
console.log(`Found: ${q2rows.length} rows`);
if (q2rows.length > 0) console.table(q2rows);
else console.log('(no rows matched)');

// QUERY 3 - All non-cancelled/non-refunded statuses yesterday
console.log('\n========================================');
console.log('QUERY 3: Non-cancelled/non-refunded statuses yesterday');
console.log('========================================');
const excludeStatuses = ['cancelled', 'refunded'];
const q3 = {};
for (const o of orders) {
  if (excludeStatuses.includes(o.status)) continue;
  if (!q3[o.status]) q3[o.status] = { orders: 0, revenue: 0 };
  q3[o.status].orders++;
  q3[o.status].revenue += Number(o.revenue) || 0;
}
const q3rows = Object.entries(q3)
  .map(([status, d]) => ({ status, orders: d.orders, revenue: round2(d.revenue) }))
  .sort((a, b) => b.revenue - a.revenue);
console.table(q3rows);

// QUERY 4 - Pending orders specifically
console.log('\n========================================');
console.log('QUERY 4: Pending orders specifically');
console.log('========================================');
const pendingOrders = orders.filter(o => o.status === 'pending');
const q4 = {
  orders: pendingOrders.length,
  revenue: round2(pendingOrders.reduce((sum, o) => sum + (Number(o.revenue) || 0), 0))
};
console.table([q4]);

// Bonus: show all distinct statuses in the data
console.log('\n=== All distinct statuses in full dataset ===');
const allStatuses = [...new Set(orders.map(o => o.status))];
console.log(allStatuses);

console.log('\n=== Done ===');
