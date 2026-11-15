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
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args) {
  const result = spawnSync(npx, ['--yes', 'supabase', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Supabase CLI failed: npx supabase ${args.join(' ')}`);
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
  run(['start']);
  run(['db', 'query', '--file', pgTapSetup]);
  run(['test', 'db']);
} finally {
  if (existsSync(temporaryMigration)) unlinkSync(temporaryMigration);
}
