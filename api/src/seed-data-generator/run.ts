// Run-once entrypoint that wires generate -> dump -> write-fixtures for the two snapshot tiers
// (Boreal Moose + Feature Type Sampler). It is the only executable in this folder; generate.ts and
// dump.ts are pure library code with no entrypoint of their own.
//
// Execute it inside the api container (which carries the DB + MinIO env and the source bind mount):
//   docker compose exec api npx tsx src/seed-data-generator/run.ts [mooseTarPath]
//
// It writes the fixtures to a directory inside the mounted api tree (only `./api` is bind-mounted into
// the container — `database/` is not), so the produced JSON is copied to
// `database/src/seeds/fixtures/seed-features/` on the host afterwards. See README.md for the full loop.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDefaultPoolConfig, initDBPool } from '../database/db';
import { initPgBoss, stopPgBoss } from '../queue/pg-boss-service';
import { withConnection } from '../queue/with-connection';
import { getLogger } from '../utils/logger';
import { dumpSubmission, SnapshotFixture } from './dump';
import { DEFAULT_SECURE_DEPLOYMENT_IDENTIFIERS, generateSnapshot } from './generate';

const defaultLog = getLogger('seed-data-generator/run');

/** This module's directory, derived from the ESM module URL (the api package has no CJS `__dirname`). */
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Default path to the external Boreal Moose tar, staged into the api bind mount before the run.
 *
 * The 7.5 MB tar is not committed; it must be unwrapped (it is double-wrapped — a tar containing the
 * real inner tar) and copied into the api tree before this runs. The README documents the staging step.
 */
const DEFAULT_MOOSE_TAR_PATH = path.join(moduleDir, 'moose.tar');

/** The committed sampler source directory; the generator packs it into a tar buffer at runtime. */
const SAMPLER_SOURCE_DIR = path.join(moduleDir, 'fixtures', 'sampler');

/**
 * Output directory for the produced fixtures.
 *
 * Defaults to a folder inside the api bind mount because the container cannot reach the `database/`
 * tree; the committed home is `database/src/seeds/fixtures/seed-features/`, which the rerun loop copies
 * into from here.
 */
const OUTPUT_DIR = process.env.SEED_FIXTURE_OUTPUT_DIR ?? path.join(moduleDir, 'output');

/** One snapshot tier: the human name, its fixture file name, and the generated submission to dump. */
interface DumpedTier {
  name: string;
  fileName: string;
  fixture: SnapshotFixture;
}

/**
 * Generate a tier's submission via the real pipeline, then dump it to a fixture in one short transaction.
 *
 * @param {string} name The human-readable submission name.
 * @param {string} fileName The fixture file name to write under the output directory.
 * @param {string} tarPath The external tar file or the sampler source directory.
 * @param {string[] | undefined} secureDeploymentIdentifiers The deployments to secure (Moose only).
 * @returns {Promise<DumpedTier>} The dumped tier ready to write.
 */
async function generateAndDumpTier(
  name: string,
  fileName: string,
  tarPath: string,
  secureDeploymentIdentifiers: string[] | undefined
): Promise<DumpedTier> {
  const result = await generateSnapshot({ tarPath, submissionName: name, secureDeploymentIdentifiers });
  const fixture = await withConnection((connection) => dumpSubmission(connection, result.submissionId));

  defaultLog.info({ label: 'generateAndDumpTier', message: 'tier dumped', name, counts: fixture.counts });

  return { name, fileName, fixture };
}

/**
 * Write each tier's fixture plus an index.json listing them, all pretty-printed.
 *
 * The index lets the replay seed discover the fixtures without hardcoding the file list.
 *
 * @param {DumpedTier[]} tiers The dumped tiers to persist.
 * @returns {void}
 */
function writeFixtures(tiers: DumpedTier[]): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const tier of tiers) {
    const filePath = path.join(OUTPUT_DIR, tier.fileName);
    fs.writeFileSync(filePath, JSON.stringify(tier.fixture, null, 2));
    defaultLog.info({ label: 'writeFixtures', message: 'wrote fixture', filePath, counts: tier.fixture.counts });
  }

  const index = { fixtures: tiers.map((tier) => tier.fileName) };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
}

/**
 * Run both snapshot tiers and write their fixtures.
 *
 * @returns {Promise<void>}
 */
async function run(): Promise<void> {
  const mooseTarPath = process.argv[2] ?? DEFAULT_MOOSE_TAR_PATH;

  initDBPool(getDefaultPoolConfig());
  await initPgBoss();

  try {
    const moose = await generateAndDumpTier(
      'Boreal Moose',
      'boreal-moose.json',
      mooseTarPath,
      DEFAULT_SECURE_DEPLOYMENT_IDENTIFIERS
    );
    const sampler = await generateAndDumpTier('Feature Type Sampler', 'sampler.json', SAMPLER_SOURCE_DIR, undefined);

    writeFixtures([moose, sampler]);
  } finally {
    await stopPgBoss();
  }
}

try {
  await run();
  process.exit(0);
} catch (error) {
  defaultLog.error({ label: 'run', message: 'seed-data-generator run failed', error });
  process.exit(1);
}
