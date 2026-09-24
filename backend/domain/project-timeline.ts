import { z } from 'zod';

// Calendar dates, not instants. Avoid Date's rollover and special handling of
// years 0–99, and never shift a project's dates through a timezone.
export function validProjectDate(value: string): boolean {
  if (value.length !== 10 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}

const dateField = (label: string) => z.string({ required_error: `${label} is required`, invalid_type_error: `Enter a valid ${label}` })
  .superRefine((value, ctx) => {
    if (!value) ctx.addIssue({ code: 'custom', message: `${label} is required` });
    else if (!validProjectDate(value)) ctx.addIssue({ code: 'custom', message: `Enter a valid ${label}` });
  });

export const projectDateFields = { fromDate: dateField('From Date'), toDate: dateField('To Date') };
export function validateProjectRange(value: { fromDate: string; toDate: string }, ctx: z.RefinementCtx) {
  if (validProjectDate(value.fromDate) && validProjectDate(value.toDate) && value.toDate < value.fromDate) {
    ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'To Date must be on or after From Date' });
  }
}
export const projectRangeSchema = z.object(projectDateFields).superRefine(validateProjectRange);

export function serializeProjectTimeline(value: { fromDate?: string; toDate?: string }): string {
  const range = projectRangeSchema.parse(value);
  return `${range.fromDate} / ${range.toDate}`;
}

export function parseProjectTimeline(timeline: string | null): { fromDate: string | null; toDate: string | null } {
  if (timeline?.length === 23 && timeline.slice(10, 13) === ' / ') {
    const result = projectRangeSchema.safeParse({ fromDate: timeline.slice(0, 10), toDate: timeline.slice(13) });
    if (result.success) return result.data;
  }
  return { fromDate: null, toDate: null };
}
