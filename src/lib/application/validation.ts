import { isIsoDate, isWeekStart } from '../domain/algorithms/week';
import {
  isCategoryStatus,
  type CategoryStatus
} from '../domain/models/category-status';
import { isCategoryColor, type CategoryColor } from '../domain/models/category-color';
import type { IsoDate, WeekStart } from '../domain/models/common';
import { isTaskStatus, type TaskStatus } from '../domain/models/task-status';
import type { WeightGrade } from '../domain/models/weight';
import { ValidationError } from './errors';

export function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ValidationError(`${field} is required.`);
  return trimmed;
}

export function requireWeightGrade(value: number, field: string): WeightGrade {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new ValidationError(`${field} must be a grade from 1 to 5.`);
  }
  return value as WeightGrade;
}

export function optionalIcon(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if ([...trimmed].length > 16) {
    throw new ValidationError(`${field} must be a short emoji.`);
  }
  return trimmed;
}

export function optionalCategoryColor(
  value: string | null | undefined,
  field: string
): CategoryColor | null {
  if (value === null || value === undefined || value === '') return null;
  if (!isCategoryColor(value)) {
    throw new ValidationError(`${field} must be a supported category color.`);
  }
  return value;
}

export function optionalCategoryStatus(
  value: string | null | undefined,
  field: string
): CategoryStatus | null {
  if (value === null || value === undefined || value === '') return null;
  if (!isCategoryStatus(value)) {
    throw new ValidationError(`${field} must be todo, in_progress, or done.`);
  }
  return value;
}

export function requirePercentage(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new ValidationError(`${field} must be greater than zero and at most 100.`);
  }
  return value;
}

export function requireIsoDate(value: string, field: string): IsoDate {
  if (!isIsoDate(value)) throw new ValidationError(`${field} must be a valid YYYY-MM-DD date.`);
  return value;
}

export function optionalIsoDate(
  value: string | null | undefined,
  field: string
): IsoDate | null {
  if (value === null || value === undefined || value === '') return null;
  return requireIsoDate(value, field);
}

export function requireTaskStatus(value: string, field: string): TaskStatus {
  if (!isTaskStatus(value)) {
    throw new ValidationError(`${field} must be todo, in_progress, or done.`);
  }
  return value;
}

export function requireWeekStart(value: string, field: string): WeekStart {
  if (!isIsoDate(value) || !isWeekStart(value)) {
    throw new ValidationError(`${field} must be a Monday in YYYY-MM-DD format.`);
  }
  return value;
}

export function optionalNote(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
