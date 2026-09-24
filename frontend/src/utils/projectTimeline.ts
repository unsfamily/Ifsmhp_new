// Keep this calendar-only contract in step with backend/domain/project-timeline.
export function validProjectDate(value: string): boolean {
  if (value.length !== 10 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}

export function projectDateError(value: string, label: 'From Date' | 'To Date'): string | undefined {
  if (!value) return `${label} is required`;
  if (!validProjectDate(value)) return `Enter a valid ${label}`;
}

export function projectToDateError(fromDate: string, toDate: string): string | undefined {
  return projectDateError(toDate, 'To Date') ||
    (validProjectDate(fromDate) && toDate < fromDate ? 'To Date must be on or after From Date' : undefined);
}
