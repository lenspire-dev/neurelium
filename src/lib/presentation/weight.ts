import {
  DEFAULT_WEIGHT_GRADE,
  normalizeWeightGrade,
  type WeightGrade
} from '#lib/domain/models/weight.js';

export interface WeightGradeMeta {
  readonly value: WeightGrade;
  readonly label: string;
  readonly description: string;
  readonly color: string;
  readonly badgeClass: string;
  readonly segmentClass: string;
}

export const WEIGHT_GRADE_META: readonly WeightGradeMeta[] = [
  {
    value: 1,
    label: 'Low',
    description: 'Quick review or optional work',
    color: 'sky',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    segmentClass: 'data-[selected=true]:border-sky-500 data-[selected=true]:bg-sky-500/10 data-[selected=true]:text-sky-700 dark:data-[selected=true]:text-sky-300'
  },
  {
    value: 2,
    label: 'Moderate',
    description: 'Normal weekly effort',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    segmentClass: 'data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-500/10 data-[selected=true]:text-emerald-700 dark:data-[selected=true]:text-emerald-300'
  },
  {
    value: 3,
    label: 'High',
    description: 'Significant effort or importance',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    segmentClass: 'data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500/10 data-[selected=true]:text-amber-800 dark:data-[selected=true]:text-amber-300'
  },
  {
    value: 4,
    label: 'Very high',
    description: 'Important; prioritize this',
    color: 'orange',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    segmentClass: 'data-[selected=true]:border-orange-500 data-[selected=true]:bg-orange-500/10 data-[selected=true]:text-orange-800 dark:data-[selected=true]:text-orange-300'
  },
  {
    value: 5,
    label: 'Critical',
    description: 'Must-do; top priority',
    color: 'rose',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    segmentClass: 'data-[selected=true]:border-rose-500 data-[selected=true]:bg-rose-500/10 data-[selected=true]:text-rose-700 dark:data-[selected=true]:text-rose-300'
  }
];

const gradeByValue = new Map(WEIGHT_GRADE_META.map((grade) => [grade.value, grade]));

export function weightMeta(value: number): WeightGradeMeta {
  return gradeByValue.get(normalizeWeightGrade(value)) ?? gradeByValue.get(DEFAULT_WEIGHT_GRADE)!;
}
