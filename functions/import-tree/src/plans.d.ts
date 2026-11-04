export type Plan = 'free' | 'pro' | 'team';

export interface PlanLimits {
  readonly ownedWorkspaces: number;
  readonly membersPerWorkspace: number;
  readonly tasksPerWorkspace: number;
  readonly activeMilestonesPerWorkspace: number;
  readonly treeImports: number;
  readonly treeImportWindow: 'total' | 'month';
  readonly maxRowsPerImport: number;
}

export interface SubscriptionRow {
  readonly plan: string;
  readonly status: string;
  readonly currentPeriodEnd: string;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits>;
export const PLAN_NAMES: Record<Plan, string>;

export function resolveSubscriptionPlan(
  rows?: SubscriptionRow[],
  now?: Date
): { plan: Plan; expiresAt: string | null };
export function resolvePlan(labels?: string[]): Plan;
export function planName(plan: Plan): string;
export function monthStartIso(now?: Date): string;
