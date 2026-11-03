import { describe, expect, test } from 'bun:test';
import { countCategoryImport, parseCategoryImport } from './json-import';

describe('parseCategoryImport', () => {
  test('parses nested categories, topics, and tasks with weight defaults', () => {
    const result = parseCategoryImport(`
      {
        "name": " Math ",
        "icon": "📐",
        "color": "teal",
        "subcategories": [
          {
            "name": "Algebra",
            "weight": 4,
            "topics": [
              {
                "name": "Equations",
                "tasks": [
                  { "title": "Solve exercises", "icon": "🧮", "weight": 3 },
                  { "title": "Review notes" }
                ]
              }
            ]
          }
        ]
      }
    `);

    expect(result.name).toBe('Math');
    expect(result.icon).toBe('📐');
    expect(result.color).toBe('teal');
    expect(result.weight).toBe(2);
    expect(result.subcategories[0]?.name).toBe('Algebra');
    expect(result.subcategories[0]?.color).toBeNull();
    expect(result.subcategories[0]?.weight).toBe(4);
    expect(result.subcategories[0]?.topics[0]?.tasks.map((task) => task.weight)).toEqual([3, 2]);
    expect(result.subcategories[0]?.topics[0]?.tasks[0]?.icon).toBe('🧮');
  });

  test('counts the full tree', () => {
    const result = parseCategoryImport(`
      {
        "name": "Math",
        "topics": [{ "name": "Numbers", "tasks": [{ "title": "Read" }] }],
        "subcategories": [
          {
            "name": "Algebra",
            "topics": [
              { "name": "Equations", "tasks": [{ "title": "Solve" }, { "title": "Check" }] }
            ]
          }
        ]
      }
    `);

    expect(countCategoryImport(result)).toEqual({ categories: 2, topics: 2, tasks: 3 });
  });

  test('rejects invalid weights and malformed JSON', () => {
    expect(() => parseCategoryImport('{"name":"Math","weight":6}')).toThrow(
      'category.weight must be an integer from 1 to 5.'
    );
    expect(() => parseCategoryImport('{')).toThrow('Invalid JSON:');
    expect(() => parseCategoryImport('{"name":"Math","subcategories":{}}')).toThrow(
      'category.subcategories must be an array.'
    );
    expect(() => parseCategoryImport('{"name":"Math","color":"crimson"}')).toThrow(
      'category.color must be a supported category color.'
    );
  });
});
