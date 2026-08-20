import 'dotenv/config';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

if (process.argv.includes('--help')) {
  console.log(
    'Usage: pnpm db:restore <backup.dump> --confirm-restore\nRestore is destructive and should target an empty recovery database.',
  );
  process.exit(0);
}
if (!process.argv.includes('--confirm-restore')) {
  throw new Error('Pass --confirm-restore to acknowledge destructive restore');
}

const inputArgument = process.argv
  .slice(2)
  .find((value) => !value.startsWith('--'));
if (!inputArgument) throw new Error('A backup file path is required');
const input = resolve(inputArgument);
await access(input);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const url = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL must use PostgreSQL');
}

const environment = postgresEnvironment(url);
const exitCode = await new Promise((resolveExit, reject) => {
  const child = spawn(
    'pg_restore',
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      input,
    ],
    { env: environment, shell: false, stdio: 'inherit' },
  );
  child.once('error', reject);
  child.once('exit', (code) => resolveExit(code ?? 1));
});
if (exitCode !== 0) throw new Error(`pg_restore exited with code ${exitCode}`);
console.log(`Database restored from ${input}`);

function postgresEnvironment(url) {
  const sslMode = url.searchParams.get('sslmode');
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(sslMode ? { PGSSLMODE: sslMode } : {}),
  };
}
