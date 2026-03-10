// ============================================================
// Access Control — Role-based permissions
// ============================================================

export type WorkspaceRoleType = 'owner' | 'manager' | 'collaborator' | 'mentee'

export type PermissionsMap = {
  dashboard: boolean
  academy: boolean
  operations: {
    workflow: boolean
    tasks: boolean
  }
  midia_analytics: {
    performance: boolean
    meta_ads: boolean
    google_ads: boolean
    yampi: boolean
    influencers: boolean
  }
  business_plan: {
    roas_cac_planner: boolean
    midia_plan: boolean
    sales_forecast: boolean
    forecast: boolean
  }
  marketplaces: boolean
  team: boolean
  integracoes: boolean
}

// ── Default permissions per role ──

const OWNER_PERMISSIONS: PermissionsMap = {
  dashboard: true,
  academy: true,
  operations: { workflow: true, tasks: true },
  midia_analytics: { performance: true, meta_ads: true, google_ads: true, yampi: true, influencers: true },
  business_plan: { roas_cac_planner: true, midia_plan: true, sales_forecast: true, forecast: true },
  marketplaces: true,
  team: true,
  integracoes: true,
}

const MANAGER_PERMISSIONS: PermissionsMap = {
  dashboard: true,
  academy: true,
  operations: { workflow: true, tasks: true },
  midia_analytics: { performance: true, meta_ads: true, google_ads: true, yampi: true, influencers: true },
  business_plan: { roas_cac_planner: true, midia_plan: true, sales_forecast: true, forecast: true },
  marketplaces: true,
  team: true,
  integracoes: true,
}

const COLLABORATOR_PERMISSIONS: PermissionsMap = {
  dashboard: true,
  academy: true,
  operations: { workflow: true, tasks: true },
  midia_analytics: { performance: true, meta_ads: true, google_ads: true, yampi: true, influencers: false },
  business_plan: { roas_cac_planner: false, midia_plan: false, sales_forecast: false, forecast: false },
  marketplaces: false,
  team: false,
  integracoes: false,
}

const MENTEE_PERMISSIONS: PermissionsMap = {
  dashboard: true,
  academy: true,
  operations: { workflow: true, tasks: true },
  midia_analytics: { performance: true, meta_ads: false, google_ads: false, yampi: false, influencers: false },
  business_plan: { roas_cac_planner: false, midia_plan: false, sales_forecast: false, forecast: false },
  marketplaces: false,
  team: false,
  integracoes: false,
}

export const DEFAULT_PERMISSIONS: Record<WorkspaceRoleType, PermissionsMap> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  collaborator: COLLABORATOR_PERMISSIONS,
  mentee: MENTEE_PERMISSIONS,
}

// ── Resolve permissions: merge defaults + custom overrides ──

export function resolvePermissions(
  role: string,
  customPerms?: Record<string, unknown> | null
): PermissionsMap {
  const base = DEFAULT_PERMISSIONS[role as WorkspaceRoleType] ?? MENTEE_PERMISSIONS
  if (!customPerms || Object.keys(customPerms).length === 0) return base

  return deepMerge(base, customPerms) as PermissionsMap
}

function deepMerge(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base }
  for (const key of Object.keys(overrides)) {
    if (key in base) {
      const baseVal = base[key]
      const overVal = overrides[key]
      if (typeof baseVal === 'object' && baseVal !== null && typeof overVal === 'object' && overVal !== null && !Array.isArray(baseVal)) {
        result[key] = deepMerge(baseVal as Record<string, unknown>, overVal as Record<string, unknown>)
      } else {
        result[key] = overVal
      }
    }
  }
  return result
}

// ── Check permission by dot-path ──

export function hasPermission(perms: PermissionsMap | null | undefined, path: string): boolean {
  if (!perms) return false
  const parts = path.split('.')
  let current: unknown = perms
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return false
    current = (current as Record<string, unknown>)[part]
  }
  return current === true
}

// ── Route → permission key mapping ──

export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/academy': 'academy',
  '/entregas': 'operations.workflow',
  '/workspace/tasks': 'operations.tasks',
  '/performance': 'midia_analytics.performance',
  '/metricas': 'midia_analytics.performance',
  '/ferramentas/calculadora-cenarios': 'business_plan.roas_cac_planner',
  '/ferramentas/planejamento-midia': 'business_plan.midia_plan',
  '/ferramentas/forecast': 'business_plan.forecast',
  '/marketplaces': 'marketplaces',
  '/team': 'team',
  '/integracoes': 'integracoes',
}

// ── Sidebar permission keys ──

export const SIDEBAR_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/academy': 'academy',
  '/entregas': 'operations.workflow',
  '/workspace/tasks': 'operations.tasks',
  '/performance': 'midia_analytics.performance',
  '/metricas?tab=meta': 'midia_analytics.meta_ads',
  '/metricas?tab=google': 'midia_analytics.google_ads',
  '/metricas?tab=yampi': 'midia_analytics.yampi',
  '/metricas?tab=influenciadores': 'midia_analytics.influencers',
  '/ferramentas/calculadora-cenarios': 'business_plan.roas_cac_planner',
  '/ferramentas/planejamento-midia': 'business_plan.midia_plan',
  '/ferramentas/planejamento-midia?tab=sales_forecast': 'business_plan.sales_forecast',
  '/ferramentas/forecast': 'business_plan.forecast',
  '/marketplaces': 'marketplaces',
  '/team': 'team',
  '/integracoes': 'integracoes',
}
