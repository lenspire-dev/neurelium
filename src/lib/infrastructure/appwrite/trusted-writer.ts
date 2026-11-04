import type { Functions } from 'appwrite';
import type { PlanInfo } from '../../domain/models/plan';
import type { Workspace } from '../../domain/models/workspace';
import type { WorkspaceRole } from '../../domain/models/workspace-member';
import { workspaceToData, type RowData, type StoredRow } from './mappers';

interface FunctionResult extends Partial<PlanInfo> {
  readonly ok?: boolean;
  readonly error?: string;
  readonly row?: StoredRow;
  readonly categories?: number;
  readonly topics?: number;
  readonly tasks?: number;
}

export interface ImportResult {
  readonly categories: number;
  readonly topics: number;
  readonly tasks: number;
}

export interface RowWriter {
  createRow(tableId: string, rowId: string, data: RowData): Promise<StoredRow>;
}

export interface WorkspaceWriter extends RowWriter {
  createWorkspace(workspace: Workspace): Promise<StoredRow>;
}

export interface InviteMemberInput {
  readonly workspaceId: string;
  readonly email: string;
  readonly role: Exclude<WorkspaceRole, 'owner'>;
  readonly redirectUrl: string;
}

export interface MemberInviter {
  inviteMember(input: InviteMemberInput): Promise<void>;
}

export class AppwriteTrustedWriter implements RowWriter, MemberInviter {
  constructor(
    private readonly functions: Functions,
    private readonly functionId: string
  ) {}

  async createRow(tableId: string, rowId: string, data: RowData): Promise<StoredRow> {
    const result = await this.execute({ action: 'createRow', tableId, rowId, data });
    if (result.row === undefined) {
      throw new Error('Server function did not return the created row.');
    }
    return result.row;
  }

  async createWorkspace(workspace: Workspace): Promise<StoredRow> {
    const result = await this.execute({
      action: 'createWorkspace',
      workspaceId: workspace.id,
      data: workspaceToData(workspace)
    });
    if (result.row === undefined) {
      throw new Error('Server function did not return the created workspace.');
    }
    return result.row;
  }

  async inviteMember(input: InviteMemberInput): Promise<void> {
    await this.execute({
      action: 'inviteMember',
      workspaceId: input.workspaceId,
      email: input.email,
      role: input.role,
      redirectUrl: input.redirectUrl
    });
  }

  async importTree(workspaceId: string, tree: unknown): Promise<ImportResult> {
    const result = await this.execute({ action: 'import', workspaceId, tree });
    return {
      categories: result.categories ?? 0,
      topics: result.topics ?? 0,
      tasks: result.tasks ?? 0
    };
  }

  async getPlan(): Promise<PlanInfo> {
    const result = await this.execute({ action: 'getPlan' });
    if (
      result.plan === undefined ||
      result.name === undefined ||
      result.limits === undefined ||
      result.source === undefined
    ) {
      throw new Error('Server function did not return plan details.');
    }
    return {
      plan: result.plan,
      name: result.name,
      limits: result.limits,
      source: result.source,
      expiresAt: result.expiresAt ?? null
    };
  }

  private async execute(body: Record<string, unknown>): Promise<FunctionResult> {
    const execution = await this.functions.createExecution({
      functionId: this.functionId,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' }
    });

    let result: FunctionResult;
    try {
      result = JSON.parse(execution.responseBody) as FunctionResult;
    } catch {
      throw new Error('Server function returned an invalid response.');
    }

    if (execution.responseStatusCode >= 400 || result.ok !== true) {
      throw new Error(result.error ?? 'Request failed.');
    }
    return result;
  }
}
