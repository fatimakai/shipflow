import 'dotenv/config';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm db:backup [output.dump]');
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const url = new URL(databaseUrl);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL must use PostgreSQL');
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.argv[2] ?? `backups/nestship-${timestamp}.dump`);
await mkdir(dirname(output), { recursive: true });

const environment = postgresEnvironment(url);
const exitCode = await run('pg_dump', [
  '--format=custom',
  '--no-owner',
  '--no-acl',
  '--file',
  output,
]);
if (exitCode !== 0) throw new Error(`pg_dump exited with code ${exitCode}`);
console.log(`Database backup created at ${output}`);

function run(command, args) {
  return new Promise((resolveExit, reject) => {
    const child = spawn(command, args, {
      env: environment,
      shell: false,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolveExit(code ?? 1));
  });
}

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
