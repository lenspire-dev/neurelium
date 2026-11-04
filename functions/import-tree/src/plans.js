export const PLAN_LIMITS = {
  free: {
    ownedWorkspaces: 1,
    membersPerWorkspace: 1,
    tasksPerWorkspace: 500,
    activeMilestonesPerWorkspace: 3,
    treeImports: 1,
    treeImportWindow: 'total',
    maxRowsPerImport: 600
  },
  pro: {
    ownedWorkspaces: 5,
    membersPerWorkspace: 3,
    tasksPerWorkspace: 5000,
    activeMilestonesPerWorkspace: 25,
    treeImports: 10,
    treeImportWindow: 'month',
    maxRowsPerImport: 3000
  },
  team: {
    ownedWorkspaces: 20,
    membersPerWorkspace: 30,
    tasksPerWorkspace: 20000,
    activeMilestonesPerWorkspace: 100,
    treeImports: 50,
    treeImportWindow: 'month',
    maxRowsPerImport: 10000
  }
};

export const PLAN_NAMES = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team'
};

const PLAN_PRIORITY = { free: 0, pro: 1, team: 2 };
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function resolveSubscriptionPlan(rows = [], now = new Date()) {
  let plan = 'free';
  let expiresAt = null;

  for (const row of rows) {
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(row.status)) continue;
    if (row.plan !== 'pro' && row.plan !== 'team') continue;
    if (typeof row.currentPeriodEnd !== 'string') continue;

    const end = new Date(row.currentPeriodEnd);
    if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) continue;

    if (PLAN_PRIORITY[row.plan] > PLAN_PRIORITY[plan]) {
      plan = row.plan;
      expiresAt = row.currentPeriodEnd;
    } else if (
      row.plan === plan &&
      expiresAt !== null &&
      end.getTime() > new Date(expiresAt).getTime()
    ) {
      expiresAt = row.currentPeriodEnd;
    }
  }

  return { plan, expiresAt };
}

export function resolvePlan(labels = []) {
  if (labels.includes('planteam')) return 'team';
  if (labels.includes('planpro')) return 'pro';
  return 'free';
}

export function planName(plan) {
  return PLAN_NAMES[plan] ?? PLAN_NAMES.free;
}

export function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
