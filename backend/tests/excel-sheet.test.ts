import { describe, expect, it } from 'vitest';
import { readXlsxEntries, toExcelSheet } from '../utils/excel-sheet';

describe('Excel sheet export', () => {
  it('writes an xlsx workbook that escapes markup and neutralises formula cells', () => {
    const sheet = toExcelSheet('Members', ['Name', 'Note'], [['<Ada & Bo>', '=HYPERLINK("http://evil")']]);
    expect(sheet.subarray(0, 2).toString()).toBe('PK');
    const entries = readXlsxEntries(sheet);
    expect(entries.get('xl/workbook.xml')).toContain('name="Members"');
    const worksheet = entries.get('xl/worksheets/sheet1.xml') ?? '';
    expect(worksheet).toContain('&lt;Ada &amp; Bo&gt;');
    expect(worksheet).toContain("'=HYPERLINK");
    expect(worksheet).not.toContain('<Ada');
  });
});
