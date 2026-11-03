/**
 * Excel 2003 XML workbook. Excel and LibreOffice open it without a spreadsheet
 * dependency, and the same formula guard used by the CSV writer applies.
 */

const FORMULA = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/;

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const safe = FORMULA.test(raw) ? `'${raw}` : raw;
  return xml(safe);
}

export function toExcelSheet(sheetName: string, headers: string[], rows: unknown[][]): string {
  const name = xml(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet');
  const header = headers.map((header) => `<Cell><Data ss:Type="String">${cell(header)}</Data></Cell>`).join('');
  const body = rows.map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="String">${cell(value)}</Data></Cell>`).join('')}</Row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${name}"><Table><Row>${header}</Row>${body}</Table></Worksheet></Workbook>`;
}
