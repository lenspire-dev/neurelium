import type { WorkspaceId } from './identifiers';

/** Calendar date in `YYYY-MM-DD` form, with no timezone attached. */
export type IsoDate = string;

/** Instant in ISO 8601 form, e.g. `2026-10-30T12:00:00.000Z`. */
export type IsoDateTime = string;

/** Monday of a planned week, in `YYYY-MM-DD` form. */
export type WeekStart = IsoDate;

export interface Timestamps {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface WorkspaceScoped {
  readonly workspaceId: WorkspaceId;
}
