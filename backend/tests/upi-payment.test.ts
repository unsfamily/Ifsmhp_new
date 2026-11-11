import { describe, expect, it } from 'vitest';
import { applicationFeeUpiPayment, legacyMembershipPolicy, membershipSettings, policySnapshotValues, UPI_ID_PATTERN } from '../domain/membership';

const policy = { ...legacyMembershipPolicy, upiId: 'ifsmhp.fees@hdfcbank', upiPayeeName: 'IFSMHP' };
const upiId = membershipSettings.shape.upiId, payeeName = membershipSettings.shape.upiPayeeName;

describe('UPI ID validation', () => {
  it.each(['ifsmhp@hdfcbank', 'ifsmhp.fees@hdfcbank', '9876543210@ybl', 'pay-ifsmhp_01@okaxis', 'ab@upi'])('accepts %s', value => {
    expect(upiId.parse(value)).toBe(value);
  });
  it('trims surrounding spaces and allows blank to hide the QR code', () => {
    expect(upiId.parse('  ifsmhp@hdfcbank  ')).toBe('ifsmhp@hdfcbank');
    expect(upiId.parse('')).toBe('');
    expect(upiId.parse(undefined)).toBe('');
  });
  it.each([
    'ifsmhp', '@hdfcbank', 'ifsmhp@', 'ifsmhp@@hdfcbank', 'ifs mhp@hdfcbank', 'ifsmhp@hdfc bank', 'a@hdfcbank',
    'ifsmhp@hdfcbank&am=1', 'ifsmhp@hdfcbank&pa=attacker@examplebank', 'ifsmhp@hdfcbank?pa=attacker@examplebank', 'ifsmhp@hdfcbank#x', 'ifsmhp%40hdfcbank',
    'attacker@examplebank&pn=IFSMHP', 'ifsmhp@hdfc.bank', 'ifsmhp@1bank', 'https://evil.example/@ybl', 'upi://pay?pa=attacker@examplebank', 'ifsmhp@hdfcbank\nattacker@examplebank',
    '<script>@ybl', `${'a'.repeat(65)}@ybl`, `ifsmhp@${'b'.repeat(33)}`,
  ])('rejects %j', value => {
    expect(upiId.safeParse(value).success).toBe(false);
    expect(UPI_ID_PATTERN.test(value)).toBe(false);
  });
  it('accepts plain payee names and rejects characters that could alter the link', () => {
    expect(payeeName.parse('  IFSMHP Forum & Co.  ')).toBe('IFSMHP Forum & Co.');
    expect(payeeName.parse(undefined)).toBe('IFSMHP');
    for (const value of ['IFSMHP=1', 'IFSMHP?x', 'IFSMHP#', 'IFSMHP%20', '<b>IFSMHP</b>', 'IFSMHP\nX', 'a'.repeat(81)]) expect(payeeName.safeParse(value).success).toBe(false);
  });
});

describe('Application fee UPI payment link', () => {
  it('builds the exact link with a fixed amount in INR', () => {
    expect(applicationFeeUpiPayment(policy)).toEqual({
      upiId: 'ifsmhp.fees@hdfcbank', payeeName: 'IFSMHP', amount: '100.00',
      uri: 'upi://pay?pa=ifsmhp.fees@hdfcbank&pn=IFSMHP&am=100.00&cu=INR',
    });
  });
  it('encodes the payee name so it cannot add a parameter', () => {
    const uri = applicationFeeUpiPayment({ ...policy, upiPayeeName: 'IFSMHP Forum & Co.' })!.uri;
    expect(uri).toContain('&pn=IFSMHP%20Forum%20%26%20Co.&am=100.00&');
    const params = new URLSearchParams(uri.slice('upi://pay?'.length));
    expect([...params.keys()]).toEqual(['pa', 'pn', 'am', 'cu']);
    expect(params.get('pa')).toBe('ifsmhp.fees@hdfcbank');
    expect(params.get('pn')).toBe('IFSMHP Forum & Co.');
    expect(params.get('am')).toBe('100.00');
  });
  it('follows the configured fee amount', () => {
    expect(applicationFeeUpiPayment({ ...policy, applicationFee: '250.50' })!.uri).toContain('&am=250.50&cu=INR');
  });
  it.each([
    ['no UPI ID is set', { upiId: '' }],
    ['the application fee is disabled', { applicationFeeEnabled: false }],
    ['the currency is not INR', { currency: 'USD' as const }],
    ['the payee name is blank', { upiPayeeName: '' }],
    ['the fee is zero', { applicationFee: '0.00' }],
    ['the fee is not a two-decimal amount', { applicationFee: '100' }],
    ['a stored UPI ID is malformed', { upiId: 'ifsmhp@hdfcbank&pa=attacker@examplebank' }],
  ])('returns no link when %s', (_label, change) => {
    expect(applicationFeeUpiPayment({ ...policy, ...change })).toBeNull();
  });
  it('reads a policy snapshot saved before the UPI settings existed', () => {
    const older: Record<string, unknown> = { ...legacyMembershipPolicy };
    delete older.upiId;
    delete older.upiPayeeName;
    const parsed = membershipSettings.parse(older);
    expect(parsed).toMatchObject({ upiId: '', upiPayeeName: 'IFSMHP' });
    expect(applicationFeeUpiPayment(parsed)).toBeNull();
  });
  it('keeps the UPI settings out of the policy stored on an application', () => {
    const stored = policySnapshotValues(policy);
    expect(stored).not.toHaveProperty('upiId');
    expect(stored).not.toHaveProperty('upiPayeeName');
    expect(policy.upiId).toBe('ifsmhp.fees@hdfcbank');
    expect(Object.keys(stored).sort()).toEqual(Object.keys(policy).filter(key => key !== 'upiId' && key !== 'upiPayeeName').sort());
    expect(membershipSettings.parse(stored)).toEqual({ ...policy, upiId: '', upiPayeeName: 'IFSMHP' });
  });
  it('ships with no UPI ID, so no QR code appears until an administrator sets one', () => {
    expect(legacyMembershipPolicy.upiId).toBe('');
    expect(applicationFeeUpiPayment(legacyMembershipPolicy)).toBeNull();
  });
});
