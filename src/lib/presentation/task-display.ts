import type { Task, Topic } from '../domain/models/hierarchy.js';

export function taskDisplayName(task: Task, topic: Topic | undefined): string {
  return topic === undefined ? task.title : `${topic.name} · ${task.title}`;
}
