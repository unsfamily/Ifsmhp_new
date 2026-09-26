/**
 * Rules for DATABASE_URL that both the API boot and `db:setup` enforce.
 *
 * Loopback is the developer machine. Any other host is treated as a deployed
 * database (RDS for MySQL, or MySQL on the application instance reached by a
 * private address). Production refuses development passwords and unencrypted
 * remote connections.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const DEVELOPMENT_PASSWORDS = new Set(['ifsmhp', 'ChangeMeNow!2026']);

export interface DatabaseTarget {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslaccept: string | null;
  sslcert: string | null;
  loopback: boolean;
}

export function parseDatabaseUrl(url: string): DatabaseTarget {
  const parsed = new URL(url);
  const host = parsed.hostname;
  return {
    host,
    port: parsed.port || '3306',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    sslaccept: parsed.searchParams.get('sslaccept'),
    sslcert: parsed.searchParams.get('sslcert'),
    loopback: LOOPBACK_HOSTS.has(host),
  };
}

/**
 * MySQL account host for CREATE USER.
 *
 * On a local server the client is localhost. On RDS the client is never the
 * database hostname, so the account must be `'user'@'%'`.
 */
export function mysqlAccountHost(serverHost: string): string {
  return LOOPBACK_HOSTS.has(serverHost) ? 'localhost' : '%';
}

export function databaseDeploymentProblems(
  target: DatabaseTarget,
  options: { nodeEnv: string; reset: boolean },
): string[] {
  const problems: string[] = [];
  const production = options.nodeEnv === 'production';

  if (!target.database) problems.push('DATABASE_URL has no database name.');
  if (!target.password) {
    problems.push('DATABASE_URL has an empty password. Percent-encode reserved characters.');
  }

  if (options.reset && (production || !target.loopback)) {
    problems.push('--reset is refused for production and for any database that is not on localhost.');
  }

  if ((production || !target.loopback) && DEVELOPMENT_PASSWORDS.has(target.password)) {
    problems.push('DATABASE_URL still uses a development password.');
  }

  if (!target.loopback && (target.sslaccept !== 'strict' || !target.sslcert)) {
    problems.push(
      'A database that is not on localhost must set sslaccept=strict and sslcert to the RDS CA bundle.',
    );
  }

  return problems;
}
