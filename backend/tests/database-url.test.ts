import { describe, expect, it } from 'vitest';
import { databaseDeploymentProblems, mysqlAccountHost, parseDatabaseUrl } from '../config/database-url';

const remote = 'mysql://ifsmhp:s3cret-value@ifsmhp.abc.us-east-1.rds.amazonaws.com:3306/ifsmhp_platform';
const remoteTls = `${remote}?sslaccept=strict&sslcert=/opt/ifsmhp/us-east-1-bundle.pem`;

describe('production database URL', () => {
  it('allows a loopback URL without TLS', () => {
    const target = parseDatabaseUrl('mysql://ifsmhp:local-secret@127.0.0.1:3308/ifsmhp_platform');
    expect(target.loopback).toBe(true);
    expect(databaseDeploymentProblems(target, { nodeEnv: 'production', reset: false })).toEqual([]);
  });

  it('refuses a remote production URL without the RDS CA', () => {
    const target = parseDatabaseUrl(remote);
    expect(target.loopback).toBe(false);
    expect(databaseDeploymentProblems(target, { nodeEnv: 'development', reset: false })).toEqual([
      'A database that is not on localhost must set sslaccept=strict and sslcert to the RDS CA bundle.',
    ]);
  });

  it('accepts a remote production URL that pins the RDS CA', () => {
    const target = parseDatabaseUrl(remoteTls);
    expect(target.sslaccept).toBe('strict');
    expect(target.sslcert).toBe('/opt/ifsmhp/us-east-1-bundle.pem');
    expect(databaseDeploymentProblems(target, { nodeEnv: 'production', reset: false })).toEqual([]);
  });

  it('refuses development passwords and reset against a remote host', () => {
    const target = parseDatabaseUrl(
      'mysql://ifsmhp:ifsmhp@ifsmhp.abc.us-east-1.rds.amazonaws.com:3306/ifsmhp_platform?sslaccept=strict&sslcert=/opt/ifsmhp/us-east-1-bundle.pem',
    );
    const problems = databaseDeploymentProblems(target, { nodeEnv: 'development', reset: true });
    expect(problems).toContain('DATABASE_URL still uses a development password.');
    expect(problems).toContain('--reset is refused for production and for any database that is not on localhost.');
  });

  it('creates remote MySQL accounts for any client host', () => {
    expect(mysqlAccountHost('127.0.0.1')).toBe('localhost');
    expect(mysqlAccountHost('ifsmhp.abc.us-east-1.rds.amazonaws.com')).toBe('%');
  });
});
