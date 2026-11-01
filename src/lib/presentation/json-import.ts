import { isCategoryColor, type CategoryColor } from '#lib/domain/models/category-color.js';
import { DEFAULT_WEIGHT_GRADE, isWeightGrade, type WeightGrade } from '#lib/domain/models/weight.js';

export interface ImportTask {
  readonly title: string;
  readonly icon: string | null;
  readonly weight: WeightGrade;
}

export interface ImportTopic {
  readonly name: string;
  readonly tasks: readonly ImportTask[];
}

export interface ImportCategory {
  readonly name: string;
  readonly icon: string | null;
  readonly color: CategoryColor | null;
  readonly weight: WeightGrade;
  readonly topics: readonly ImportTopic[];
  readonly subcategories: readonly ImportCategory[];
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalText(value: unknown, path: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`${path} must be a string.`);
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if ([...trimmed].length > 16) throw new Error(`${path} must be a short emoji.`);
  return trimmed;
}

function categoryColor(value: unknown, path: string): CategoryColor | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isCategoryColor(value)) {
    throw new Error(`${path} must be a supported category color.`);
  }
  return value;
}

function weight(value: unknown, path: string): WeightGrade {
  if (value === undefined) return DEFAULT_WEIGHT_GRADE;
  if (typeof value !== 'number' || !isWeightGrade(value)) {
    throw new Error(`${path} must be an integer from 1 to 5.`);
  }
  return value;
}

function list(value: unknown, path: string): readonly unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value;
}

function parseTask(value: unknown, path: string): ImportTask {
  const input = record(value, path);
  return {
    title: text(input.title, `${path}.title`),
    icon: optionalText(input.icon, `${path}.icon`),
    weight: weight(input.weight, `${path}.weight`)
  };
}

function parseTopic(value: unknown, path: string): ImportTopic {
  const input = record(value, path);
  return {
    name: text(input.name, `${path}.name`),
    tasks: list(input.tasks, `${path}.tasks`).map((task, index) =>
      parseTask(task, `${path}.tasks[${index}]`)
    )
  };
}

function parseCategory(value: unknown, path: string): ImportCategory {
  const input = record(value, path);
  return {
    name: text(input.name, `${path}.name`),
    icon: optionalText(input.icon, `${path}.icon`),
    color: categoryColor(input.color, `${path}.color`),
    weight: weight(input.weight, `${path}.weight`),
    topics: list(input.topics, `${path}.topics`).map((topic, index) =>
      parseTopic(topic, `${path}.topics[${index}]`)
    ),
    subcategories: list(input.subcategories, `${path}.subcategories`).map((child, index) =>
      parseCategory(child, `${path}.subcategories[${index}]`)
    )
  };
}

export function parseCategoryImport(json: string): ImportCategory {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'could not parse input.'}`);
  }
  return parseCategory(value, 'category');
}
