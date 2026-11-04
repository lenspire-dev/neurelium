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

export interface PlanInfo {
  readonly plan: Plan;
  readonly name: string;
  readonly limits: PlanLimits;
  readonly source: 'subscription' | 'label';
  readonly expiresAt: string | null;
}
