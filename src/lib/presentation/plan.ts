import type { Plan, PlanLimits } from '../domain/models/plan';

export type { Plan, PlanInfo, PlanLimits } from '../domain/models/plan';

export interface PlanDetail {
  readonly label: string;
  readonly value: string;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
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

const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team'
};

export function resolvePlan(labels: readonly string[]): Plan {
  if (labels.includes('planteam')) return 'team';
  if (labels.includes('planpro')) return 'pro';
  return 'free';
}

export function planName(labels: readonly string[]): string {
  return PLAN_NAMES[resolvePlan(labels)];
}

export function planDetails(limits: PlanLimits): PlanDetail[] {
  return [
    { label: 'Owned workspaces', value: String(limits.ownedWorkspaces) },
    { label: 'Members per workspace', value: String(limits.membersPerWorkspace) },
    { label: 'Tasks per workspace', value: String(limits.tasksPerWorkspace) },
    {
      label: 'Active milestones per workspace',
      value: String(limits.activeMilestonesPerWorkspace)
    },
    {
      label: 'Tree imports',
      value: `${limits.treeImports} ${limits.treeImportWindow === 'month' ? 'per month' : 'total'}`
    },
    { label: 'Rows per import', value: String(limits.maxRowsPerImport) }
  ];
}
