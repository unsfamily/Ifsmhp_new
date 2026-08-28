import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  randomToken,
  sha256,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from '../utils/security';

describe('security helpers', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const hash = await hashPassword('Correct Horse Battery Staple 2026!');

    expect(hash).not.toContain('Correct Horse');
    await expect(verifyPassword('Correct Horse Battery Staple 2026!', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('creates high-entropy tokens and stable hashes', () => {
    const one = randomToken();
    const two = randomToken();

    expect(one).not.toBe(two);
    expect(sha256(one)).toBe(sha256(one));
    expect(sha256(one)).not.toBe(sha256(two));
  });

  it('signs and verifies access token claims', () => {
    const token = signAccessToken({ sub: 'user_1', role: 'MEMBER', sessionId: 'session_1' });
    const claims = verifyAccessToken(token);

    expect(claims.sub).toBe('user_1');
    expect(claims.role).toBe('MEMBER');
    expect(claims.sessionId).toBe('session_1');
  });
});
