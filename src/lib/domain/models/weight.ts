export const WEIGHT_GRADES = [1, 2, 3, 4, 5] as const;

export type WeightGrade = (typeof WEIGHT_GRADES)[number];

export const DEFAULT_WEIGHT_GRADE: WeightGrade = 2;

export function isWeightGrade(value: number): value is WeightGrade {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function normalizeWeightGrade(value: number): WeightGrade {
  if (!Number.isFinite(value)) return DEFAULT_WEIGHT_GRADE;
  return Math.min(5, Math.max(1, Math.round(value))) as WeightGrade;
}
