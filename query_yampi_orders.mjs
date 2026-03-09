import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.substring(0, eqIndex);
  let value = trimmed.substring(eqIndex + 1);
  // Remove surrounding quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

console.log('Supabase URL:', url);
console.log('Service Role Key:', serviceRoleKey ? serviceRoleKey.substring(0, 20) + '...' : 'MISSING');
console.log('');

const supabase = createClient(url, serviceRoleKey);

const WORKSPACE_ID = '313aa5ab-7d05-4ffd-8f77-306e0a81e488';

async function main() {
  // ===== QUERY 1: Get column names and types =====
  console.log('='.repeat(80));
  console.log('QUERY 1: Column names and types from yampi_orders');
  console.log('='.repeat(80));

  const { data: sampleRow, error: err1 } = await supabase
    .from('yampi_orders')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .limit(1)
    .maybeSingle();

  if (err1) {
    console.log('ERROR:', JSON.stringify(err1, null, 2));
  } else if (!sampleRow) {
    console.log('No rows found for this workspace.');
  } else {
    console.log('\nColumns found:', Object.keys(sampleRow).length);
    console.log('');
    for (const [key, value] of Object.entries(sampleRow)) {
      const type = value === null ? 'null' : typeof value;
      const preview = value === null ? 'null' : (typeof value === 'object' ? JSON.stringify(value).substring(0, 80) : String(value).substring(0, 80));
      console.log(`  ${key.padEnd(30)} type: ${type.padEnd(10)} value: ${preview}`);
    }
  }

  // ===== QUERY 2: 5 sample orders with ALL fields =====
  console.log('\n' + '='.repeat(80));
  console.log('QUERY 2: 5 sample orders - ALL fields');
  console.log('='.repeat(80));

  const { data: samples, error: err2 } = await supabase
    .from('yampi_orders')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .limit(5);

  if (err2) {
    console.log('ERROR:', JSON.stringify(err2, null, 2));
  } else if (!samples || samples.length === 0) {
    console.log('No rows found.');
  } else {
    console.log(`\nFound ${samples.length} rows:\n`);
    for (let i = 0; i < samples.length; i++) {
      console.log(`--- Row ${i + 1} ---`);
      console.log(JSON.stringify(samples[i], null, 2));
      console.log('');
    }
  }

  // ===== QUERY 3: 3 most recent orders =====
  console.log('='.repeat(80));
  console.log('QUERY 3: 3 most recent orders');
  console.log('='.repeat(80));

  let { data: recent, error: err3 } = await supabase
    .from('yampi_orders')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .order('date', { ascending: false })
    .limit(3);

  if (err3) {
    console.log('ERROR:', JSON.stringify(err3, null, 2));
  } else if (!recent || recent.length === 0) {
    console.log('No rows found.');
  } else {
    console.log(`\nFound ${recent.length} rows:\n`);
    for (let i = 0; i < recent.length; i++) {
      console.log(`--- Row ${i + 1} (most recent) ---`);
      console.log(JSON.stringify(recent[i], null, 2));
      console.log('');
    }
  }
}

main().catch(console.error);
