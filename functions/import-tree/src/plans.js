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

export function resolvePlan(labels = []) {
  if (labels.includes('plan_team')) return 'team';
  if (labels.includes('plan_pro')) return 'pro';
  return 'free';
}

export function planName(plan) {
  return PLAN_NAMES[plan] ?? PLAN_NAMES.free;
}

export function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
