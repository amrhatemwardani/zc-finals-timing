export const PREP_TASKS = [
  { id: 'review', label: 'Review key topics and notes' },
  { id: 'practice', label: 'Complete a practice set' },
  { id: 'confirm', label: 'Check official room and exam instructions' },
  { id: 'materials', label: 'Pack the materials your course requires' },
] as const;

export type PrepProgress = Record<string, boolean[]>;

export interface PrepSummary {
  completed: number;
  total: number;
  percent: number;
}

export function normalizePrepChecks(checks: unknown): boolean[] {
  return PREP_TASKS.map((_, index) => Array.isArray(checks) && checks[index] === true);
}

export function summarizePrep(courseCodes: string[], progress: PrepProgress): PrepSummary {
  const total = courseCodes.length * PREP_TASKS.length;
  const completed = courseCodes.reduce((sum, code) => (
    sum + normalizePrepChecks(progress[code]).filter(Boolean).length
  ), 0);
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
