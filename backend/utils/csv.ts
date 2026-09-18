/**
 * Minimal RFC 4180 CSV writer.
 *
 * Hand-rolled because the project carries no CSV dependency and a report export
 * needs only this much. Two things beyond plain joining matter:
 *
 *  - **Quoting.** A field containing a quote, comma, CR or LF must be wrapped in
 *    quotes with interior quotes doubled, or the row silently splits.
 *  - **Formula injection.** Excel and Sheets execute a cell beginning `=`, `+`,
 *    `-` or `@`, so a member-supplied value like `=HYPERLINK(...)` becomes a
 *    live formula in whoever opens the export. Those are prefixed with an
 *    apostrophe, which spreadsheets strip on display but never execute.
 */

export interface CsvColumn<Row> {
  key: keyof Row & string;
  label: string;
}

/** Excel only detects UTF-8 in a CSV when it starts with a byte-order mark. */
const BOM = '﻿';

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  // Neutralise a leading formula trigger before quoting, not after.
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /["\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Renders rows as a CSV document, header first. */
export function toCsv<Row extends Record<string, unknown>>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const lines = [columns.map(column => cell(column.label)).join(',')];
  for (const row of rows) lines.push(columns.map(column => cell(row[column.key])).join(','));
  // CRLF is what RFC 4180 specifies and what Excel on Windows expects.
  return BOM + lines.join('\r\n');
}

/** A filesystem-safe download name, e.g. `review-sla-2026-08-01-to-2026-08-31.csv`. */
export function csvFilename(key: string, from: string, to: string): string {
  return `${key}-${from}-to-${to}.csv`.replace(/[^a-zA-Z0-9.\-_]/g, '-');
}
