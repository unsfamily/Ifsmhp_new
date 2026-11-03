import { describe, expect, it } from 'vitest';
import { toExcelSheet } from '../utils/excel-sheet';

describe('Excel sheet export', () => {
  it('escapes markup and neutralises formula cells', () => {
    const sheet = toExcelSheet('Members', ['Name', 'Note'], [['<Ada & Bo>', '=HYPERLINK("http://evil")']]);
    expect(sheet).toContain('ss:Name="Members"');
    expect(sheet).toContain('&lt;Ada &amp; Bo&gt;');
    expect(sheet).toContain("'=HYPERLINK");
    expect(sheet).not.toContain('<Ada');
  });
});
