import { describe, expect, test } from 'bun:test';
import { isWorkspaceRole, workspaceRoleFromRoles } from './workspace-member';

describe('workspace roles', () => {
  test('prefers the most privileged role in a membership', () => {
    expect(workspaceRoleFromRoles(['member', 'owner'])).toBe('owner');
    expect(workspaceRoleFromRoles(['viewer', 'admin'])).toBe('admin');
    expect(workspaceRoleFromRoles(['viewer'])).toBe('viewer');
    expect(workspaceRoleFromRoles([])).toBe('member');
  });

  test('rejects unknown role strings', () => {
    expect(isWorkspaceRole('admin')).toBe(true);
    expect(isWorkspaceRole('guest')).toBe(false);
  });
});
