import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'supabase/tests/fixtures/salon_prerequisite.sql.fixture');
const temporaryMigration = path.join(
  root,
  'supabase/migrations/202610050800_test_only_salon_prerequisite.sql'
);
const config = path.join(root, 'supabase/config.toml');
const pgTapSetup = path.join(root, 'supabase/tests/fixtures/enable_pgtap.sql.fixture');
const concurrencySeed = path.join(root, 'supabase/tests/fixtures/concurrency_seed.sql.fixture');
const concurrencyTest = path.join(root, 'scripts/test-advertising-concurrency.mjs');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args) {
  const result = spawnSync(npx, ['--yes', 'supabase', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Supabase CLI failed: npx supabase ' + args.join(' '));
  }
}

function capture(args) {
  const result = spawnSync(npx, ['--yes', 'supabase', ...args], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Supabase CLI failed: npx supabase ' + args.join(' '));
  }
  return result.stdout;
}

function runNode(scriptPath, env) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: 'inherit',
    env,
    timeout: 120000,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Node integration test failed: ' + scriptPath);
  }
}

if (existsSync(temporaryMigration)) {
  throw new Error(
    'Temporary test migration already exists. Inspect and remove it before retrying.'
  );
}

copyFileSync(fixture, temporaryMigration);

try {
  if (!existsSync(config)) run(['init']);
  run(['start', '--exclude', 'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor']);
  run(['db', 'query', '--file', pgTapSetup]);
  run(['test', 'db']);
  run(['db', 'query', '--file', concurrencySeed]);

  const status = capture(['status', '-o', 'env']);
  const apiUrl = status.match(/^API_URL="([^"]+)"$/m)?.[1];
  const serviceRoleKey = status.match(/^SERVICE_ROLE_KEY="([^"]+)"$/m)?.[1];
  if (!apiUrl || !serviceRoleKey) {
    throw new Error('Could not read local Supabase API URL and service role key from CLI status.');
  }

  runNode(concurrencyTest, {
    ...process.env,
    LOCAL_SUPABASE_API_URL: apiUrl,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  });
} finally {
  if (existsSync(temporaryMigration)) unlinkSync(temporaryMigration);
}
