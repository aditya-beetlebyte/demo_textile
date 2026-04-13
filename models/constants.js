export const ORDER_TYPES = ['3068D', '3001D', '32011W'];

export const TASK_STATUSES = ['pending', 'in_progress', 'in_review', 'completed'];

/** Normalize client input (e.g. in-progress, In Progress) to canonical status. */
export function normalizeTaskStatusInput(raw) {
  if (raw == null || raw === '') return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
}
