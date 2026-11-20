import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { TaskMember, TaskRecord } from "@/lib/task-service";
import { getTaskDueState, type TaskStatus, type TaskPriority, type TaskDates } from "@/lib/task-validation";

export function taskMemberLabel(locale: Locale, member: TaskMember) {
  return member.name || `${getDictionary(locale).tasks.unnamedMember} ${member.id.slice(0, 8)}`;
}

export function TaskStatusBadge({ locale, status }: { locale: Locale; status: TaskStatus }) {
  return <span className={`task-badge task-status-${status}`}>{getDictionary(locale).tasks.statuses[status]}</span>;
}

export function TaskPriorityBadge({ locale, priority }: { locale: Locale; priority: TaskPriority }) {
  const text = getDictionary(locale).tasks;
  return <span className={`task-badge task-priority-${priority}`}>{text.form.priority}: {text.priorities[priority]}</span>;
}

export function TaskDueBadge({ locale, task, dates }: { locale: Locale; task: TaskRecord; dates: TaskDates }) {
  const state = getTaskDueState(task, dates);
  return <span className={`task-badge task-due-${state}`}>{getDictionary(locale).tasks.dueStates[state]}</span>;
}
