import { describe, expect, it } from 'vitest';
import { safeChanges } from '../services/audit.service';

describe('safeChanges', () => {
  it('detects a public notice edit past the first 500 characters and keeps the audit copy bounded', () => {
    const shared = 'ن'.repeat(500);
    const before = `${shared} before`;
    const after = `${shared} after`;
    const changes = safeChanges({ publicNotices: { before, after } });
    const recorded = changes?.publicNotices as { before: string; after: string };
    expect(recorded.before).not.toBe(recorded.after);
    expect(recorded.before.length).toBeLessThanOrEqual(500);
    expect(recorded.after.length).toBeLessThanOrEqual(500);
    expect(recorded.before).not.toContain('before');
    expect(recorded.after).not.toContain('after');
    expect(safeChanges(changes)).toEqual(changes);
  });

  it('omits a public notice that did not change', () => {
    const notice = 'e'.repeat(800);
    expect(safeChanges({ publicNotices: { before: notice, after: notice } })).toBeUndefined();
  });

  it('does not treat a later difference in another field as a change', () => {
    const shared = 'c'.repeat(500);
    expect(safeChanges({ fullName: { before: `${shared} one`, after: `${shared} two` } })).toBeUndefined();
  });
});
