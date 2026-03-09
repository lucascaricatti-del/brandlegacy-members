# BrandLegacy Members — Security & Performance Audit Report

**Date:** 2026-03-08
**Auditor:** Claude Code (automated)
**Scope:** Full codebase — app/api/, app/(student)/, middleware, config, Supabase schema

---

## SCORES

| Category | Score | Summary |
|----------|-------|---------|
| **Security** | **3/10** | Critical: no auth on API routes, no webhook signature validation, 16+ tables without RLS, no security headers |
| **Performance** | **5/10** | 24,000 rows loaded on page load, no pagination, 53KB monolith component, missing dynamic imports |
| **Architecture** | **5/10** | Status normalization inconsistent across 4 files, duplicate parsing logic, race conditions between webhook/sync |

---

## TOP 5 PRIORITIES (fix before onboarding mentees)

1. **Add auth + workspace ownership check to ALL API routes** — Currently any unauthenticated user can read/write any workspace's data
2. **Add HMAC signature validation to Yampi and ML webhooks** — Anyone can POST fake orders
3. **Add security headers to next.config.ts** — No CSP, no X-Frame-Options, no HSTS
4. **Reduce page load data** — 24,000 rows serialized to client; use server-side aggregation
5. **Extract shared Yampi constants/parser** — Status normalization differs between webhook and sync, causing metric inconsistencies

---

## CRITICAL (fix before onboarding)

### SEC-C1: All API Routes Missing Authentication
**Files:** Every file in `app/api/integrations/*/`, `app/api/influencers/`, `app/api/marketplace/`
**Impact:** Any unauthenticated user can call any endpoint with any workspace_id
**Details:**
- `app/api/influencers/route.ts` — GET/POST/PUT/DELETE with zero auth
- `app/api/integrations/yampi/sync/route.ts:20` — accepts workspace_id from body, no user check
- `app/api/integrations/mercadolivre/sync/route.ts:33` — same
- `app/api/integrations/google-ads/sync/route.ts:37` — same
- `app/api/integrations/meta/sync/route.ts:38` — same
- `app/api/integrations/ga4/sync/route.ts:45` — same
- `app/api/marketplace/manual-costs/route.ts:46` — same
- `app/api/marketplace/orders/route.ts:10` — same
- `app/api/marketplace/inventory/route.ts` — same
- `app/api/influencers/performance/route.ts` — same
- `app/api/influencers/orders/route.ts` — same
- `app/api/influencers/preview/route.ts` — same
- `app/api/influencers/renewals/route.ts` — same
- `app/api/influencers/sequences/route.ts` — same
- `app/api/metricas/relatorio/route.ts:4` — same
**Fix:** Add auth middleware or per-route check: verify session, then verify user is member of requested workspace_id

### SEC-C2: Webhooks Have No Signature Validation
**Files:**
- `app/api/integrations/yampi/webhook/route.ts:7` — no HMAC check
- `app/api/integrations/mercadolivre/webhook/route.ts:10` — no HMAC check
**Impact:** Anyone can POST fake orders/claims, inject fraudulent revenue data
**Fix:** Validate `X-Yampi-Signature` (HMAC-SHA256) and ML's `X-ML-Signature` header before processing

### SEC-C3: OAuth State Parameter Not Validated (CSRF)
**Files:**
- `app/api/integrations/google-ads/callback/route.ts:11` — state = workspace_id, no CSRF token
- `app/api/integrations/mercadolivre/auth/route.ts:49` — state = `${workspaceId}:${Date.now()}` (predictable)
**Impact:** Attacker can redirect OAuth flow to victim's workspace, storing attacker's tokens
**Fix:** Generate cryptographically random state, store in DB with user_id, verify on callback

### SEC-C4: Missing Security Headers
**File:** `next.config.ts:1-8`
**Impact:** Vulnerable to clickjacking, MIME sniffing, XSS
**Missing:** CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy
**Fix:**
```ts
const nextConfig: NextConfig = {
  reactCompiler: true,
  headers: async () => [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    ],
  }],
}
```

### PERF-C1: 24,000 Rows Loaded on Page Load
**Files:**
- `app/(student)/metricas/page.tsx:96-140` — loads 10K yampi_orders + 5K meta + 5K google + 2K shopify + 365 yampi_metrics
- `app/(student)/performance/page.tsx:56-78` — same pattern
**Impact:** Slow page load, memory spike on mobile, unnecessary bandwidth
**Fix:** Load only current month + 30 days prior. Use server-side aggregation instead of raw orders. Add pagination.

### PERF-C2: InfluencersTab.tsx is a 53KB / 973-line Monolith
**File:** `app/(student)/metricas/InfluencersTab.tsx`
**Impact:** Loaded even when user is on Meta/Google/Yampi tabs. Not lazy-loaded. Contains 4 views + multi-step modal.
**Fix:** Split into separate files. Use `dynamic(() => import('./InfluencersTab'), { ssr: false })`.

### ARCH-C1: Race Condition Between Webhook and Sync
**Files:**
- `app/api/integrations/yampi/webhook/route.ts:77-106` — upserts order, recalculates day metrics
- `app/api/integrations/yampi/sync/route.ts:190-207` — DELETEs metrics for range, then INSERTs
**Impact:** If webhook fires during sync, webhook's calculation is overwritten. No transaction boundaries.
**Fix:** Use database transactions or optimistic locking. Or: sync should aggregate from DB (not API response) after upserting orders.

### ARCH-C2: Inconsistent Status Normalization
**Files:**
- `yampi/webhook/route.ts:46-50` — normalizes: refused→cancelled, unknown→pending
- `yampi/sync/route.ts:99` — stores raw statusAlias (refused stays refused)
- `cron/sync-metrics/route.ts:331` — stores raw statusAlias
**Impact:** Same order has different status depending on which path wrote it. Metrics calculations diverge.
**Fix:** Extract to `lib/yampi/parser.ts` with consistent normalization.

---

## HIGH (fix within 1 week)

### SEC-H1: 16+ Tables Without Row Level Security
**Files:** Multiple migration files
**Tables missing RLS:**
- `agent_logs`, `workspace_context`, `agent_configs` (migration_v8/v9)
- `sessions`, `session_tasks` (migration_v7)
- `financial_info`, `tasks` (migration_v11)
- `task_checklist_items`, `task_comments`, `media_plans`, `media_plan_metrics` (migration_v15)
- `leads` (migration_v13)
- `funnels`, `crm_leads`, `crm_notes` (migration_v14)
- `integrations`, `integration_metrics` (migration_v10) — RLS enabled but NO policies
**Fix:** Enable RLS with workspace-scoped policies on all tables.

### SEC-H2: Weak Cron Authentication
**Files:** `app/api/cron/sync-metrics/route.ts:14`, `app/api/agents/overdue/route.ts:42`
**Issue:** `CRON_SECRET=brandlegacy2026` — low entropy, human-readable
**Fix:** Use Vercel's `x-vercel-cron` header verification. Generate 32+ char random secret.

### SEC-H3: OAuth Tokens Stored Unencrypted
**Table:** `workspace_integrations` — `access_token`, `refresh_token` stored as plaintext
**Impact:** Database breach exposes all Meta/Google/ML/Shopify tokens
**Fix:** Implement field-level encryption (envelope encryption with KMS)

### SEC-H4: No Rate Limiting on Expensive Routes
**Files:** All sync routes, `backfill-fees`, `metricas/relatorio` (Claude API)
**Impact:** Attacker can trigger unlimited API calls, DoS, cost spike
**Fix:** Implement Upstash Ratelimit or Vercel Edge rate limiting

### SEC-H5: SQL/GAQL Injection via Date Interpolation
**File:** `app/api/cron/sync-metrics/route.ts:171`
```ts
const query = `...WHERE segments.date BETWEEN '${since}' AND '${until}'...`
```
**Fix:** Use parameterized queries or strict date validation regex before interpolation.

### PERF-H1: Missing maxDuration on Sync Routes
**Files:**
- `app/api/integrations/google-ads/callback/route.ts` — no maxDuration
- `app/api/integrations/mercadolivre/sync/route.ts` — no maxDuration
- `app/api/integrations/yampi/sync/route.ts` — no maxDuration
- `app/api/integrations/meta/sync/route.ts` — no maxDuration
**Impact:** Vercel kills at 30s default; sync can take 45s+
**Fix:** Add `export const maxDuration = 300` to all sync routes.

### PERF-H2: SELECT * Fetching Unused Columns
**Files:**
- `metricas/page.tsx:105-140` — `.select('*')` on all metric tables
- `performance/page.tsx:63-76` — `.select('*')` on all metric tables
**Fix:** `.select('date, revenue, orders, avg_ticket, ...')` — only needed columns.

### PERF-H3: Recharts Not Lazy-Loaded
**File:** `app/(student)/metricas/MetricsClient.tsx:7-9`
**Impact:** ~200KB loaded even on tabs that don't show charts
**Fix:** Dynamic import recharts components.

### ARCH-H1: Duplicate Yampi Parsing Logic (4 files)
**Files:** webhook, sync, aggregate, cron/sync-metrics
**Impact:** Maintenance burden; when logic changes, must update 4 files
**Fix:** Extract to `lib/yampi/parser.ts`:
```ts
export const PAID_STATUSES = ['paid', 'invoiced', 'shipped', 'delivered']
export const CANCELLED_STATUSES = ['cancelled', 'refused']
export function parseYampiOrder(resource: any, workspaceId: string): YampiOrderRow { ... }
export function aggregateDailyMetrics(orders: YampiOrderRow[]): YampiMetricRow[] { ... }
```

### ARCH-H2: Webhook Returns 200 on Errors
**Files:**
- `yampi/webhook/route.ts:109-112` — catch returns `{ received: true }` (200)
- `mercadolivre/webhook/route.ts:162-165` — catch returns `{ ok: true }` (200)
**Impact:** External system thinks delivery succeeded; won't retry. Data loss.
**Fix:** Return 500 on processing errors so Yampi/ML retry the webhook.

### ARCH-H3: Inconsistent Error Handling in Server Actions
**Pattern 1 (kanban.ts):** Returns `{ error: 'message' }` — caller checks `if (result.error)`
**Pattern 2 (workspace.ts, admin.ts, deliveries.ts, team.ts, contracts.ts, interno.ts):** Throws `new Error()` — caller needs try/catch
**Fix:** Standardize on return pattern (safer, more predictable).

---

## MEDIUM (fix within 1 month)

### SEC-M1: No Input Validation on Complex Objects
**File:** `app/api/influencers/sequences/route.ts:25-49` — accepts `sequences` array with no length limit or type validation
**Fix:** Use Zod schema validation. Limit array to max 50 items.

### SEC-M2: Meta Access Token in URL Query Parameter
**File:** `app/api/integrations/meta/sync/route.ts:84` — `&access_token=${integration.access_token}`
**Fix:** Use Authorization header instead.

### PERF-M1: Client-Side O(n²) Processing of Yampi Orders
**File:** `MetricsClient.tsx:320-346` — 3 separate loops over 10K orders (topProducts has nested item loop)
**Fix:** Create server-side aggregation views or API endpoints for top products, by-state, by-payment.

### PERF-M2: Missing Database Indexes
**Likely missing composites:**
- `yampi_orders(workspace_id, date, status)`
- `workspace_integrations(workspace_id, provider)`
- `workspace_members(user_id, is_active)`
- `ml_orders(workspace_id, date)`
**Fix:** Verify in Supabase dashboard; add composite indexes.

### PERF-M3: Sequential Fetches in ML Sync
**File:** `app/api/integrations/mercadolivre/sync/route.ts:141-183`
**Issue:** Payment and shipment batches fetched sequentially with 300ms delays
**Fix:** Parallelize payment + shipment fetches with `Promise.all()`.

### ARCH-M1: 6 API Routes Missing Try/Catch
**Files:**
- `app/api/marketplace/manual-costs/route.ts`
- `app/api/marketplace/inventory/route.ts`
- `app/api/marketplace/orders/route.ts`
- `app/api/integrations/mercadolivre/auth/route.ts`
- `app/api/integrations/mercadolivre/backfill-status/route.ts`
- `app/api/integrations/google-ads/accounts/route.ts`
**Fix:** Wrap handlers in try/catch, return proper error responses.

### ARCH-M2: Debug Console.log in Production
**File:** `app/(student)/metricas/page.tsx:149-159` — logs workspace ID, integration status, row counts
**Fix:** Remove or gate behind `NODE_ENV === 'development'`.

---

## LOW (nice to have)

### PERF-L1: Period Filter Logic Duplicated 3 Times
**Files:** `MetricsClient.tsx:165-183`, `PerformanceDashboardClient.tsx:187-205`, `MarketplacesClient.tsx:92-105`
**Fix:** Extract to `lib/date-utils.ts`.

### PERF-L2: Inline SVG Icons Not Optimized
**File:** `MetricsClient.tsx:57-99` — MetaIcon, GoogleIcon, ShopifyIcon as inline components
**Fix:** Use icon library or static imports.

### PERF-L3: GaugeCard Recalculates on Every Render
**File:** `PerformanceDashboardClient.tsx:517-562`
**Fix:** Wrap in `React.memo()`.

### ARCH-L1: No Error Boundaries on Client Components
**Files:** InfluencersTab, TaskFlowClient, MetricsClient
**Fix:** Add `error.tsx` files in route groups.

### ARCH-L2: Supabase Client Created at Module Level in Sync
**File:** `app/api/integrations/yampi/sync/route.ts:6-9`
**Issue:** Module-level `createClient()` — shared across requests in serverless cold starts
**Fix:** Create client inside handler function.

---

## FULL ISSUE COUNT

| Severity | Security | Performance | Architecture | Total |
|----------|----------|-------------|--------------|-------|
| CRITICAL | 4 | 2 | 2 | **8** |
| HIGH | 5 | 3 | 3 | **11** |
| MEDIUM | 2 | 3 | 2 | **7** |
| LOW | 0 | 3 | 2 | **5** |
| **Total** | **11** | **11** | **9** | **31** |

---

## REMEDIATION ROADMAP

### Phase 1 — Before Onboarding (this week)
1. Add auth middleware to all API routes (SEC-C1)
2. Add webhook HMAC validation (SEC-C2)
3. Add security headers to next.config.ts (SEC-C4)
4. Fix OAuth state CSRF (SEC-C3)
5. Extract shared Yampi parser + normalize status (ARCH-C2, ARCH-H1)

### Phase 2 — First Sprint (next week)
6. Enable RLS on remaining tables (SEC-H1)
7. Add rate limiting on sync/AI routes (SEC-H4)
8. Add maxDuration to sync routes (PERF-H1)
9. Reduce page load data — server-side aggregation (PERF-C1)
10. Lazy-load InfluencersTab + recharts (PERF-C2, PERF-H3)

### Phase 3 — Second Sprint
11. Encrypt OAuth tokens at rest (SEC-H3)
12. Strengthen cron secret (SEC-H2)
13. Add database indexes (PERF-M2)
14. Standardize error handling patterns (ARCH-H3)
15. Add try/catch to unprotected routes (ARCH-M1)

---

*Report generated by automated audit. Manual verification recommended for RLS policies and token rotation.*
