import { faker } from '@faker-js/faker';
import { Knex } from 'knex';
import { computeSubmissionFeatureClosureForUpload } from '../seed-utils';
import {
  insertSampleSiteRecord,
  insertSubmissionRecord,
  insertSubmissionUploadRecord,
  insertSurveyRecord,
  insertTelemetryRecord,
  insertUploadRecord
} from './04_mock_test_data';

const ENABLE_MOCK_FEATURE_SEEDING = process.env.ENABLE_MOCK_FEATURE_SEEDING === 'true';

type SecurityLevel = 'SECURE' | 'PARTIALLY_SECURE' | 'UNSECURE';
type ScanStatus = 'pending' | 'completed' | 'failed';
type SecurityStatus = 'clean' | 'pending' | 'infected' | 'error' | 'skipped';

interface SeedContext {
  submission_id: number;
  upload_id: string;
  submission_upload_id: string;
  artifacts: { artifact_id: string; role: string }[];
}

type SeedConnection = Knex | Knex.Transaction;

export async function seed(knex: Knex): Promise<void> {
  if (!ENABLE_MOCK_FEATURE_SEEDING) {
    return knex.raw('SELECT null;'); // dummy query to appease knex
  }

  await knex.transaction(async (trx) => {
    await trx.raw(`
      SET SCHEMA 'biohub';
      SET SEARCH_PATH = 'biohub','public';
    `);

    // The real feature data comes from the committed snapshot seed (10_snapshot_features.ts), which is
    // injected post-malware-scan and so can only represent a clean/scanned state. These tiny synthetic
    // submissions exist solely to cover the artifact scan-status axis the snapshot cannot express — one
    // per scan state: SECURE→clean, PARTIALLY_SECURE→pending, UNSECURE→infected (see getSecurityConfig).
    const scenarios: { level: SecurityLevel; reviewed: boolean; withArchive: boolean }[] = [
      { level: 'SECURE', reviewed: true, withArchive: true },
      { level: 'PARTIALLY_SECURE', reviewed: true, withArchive: true },
      { level: 'UNSECURE', reviewed: true, withArchive: false }
    ];

    const seedContexts: SeedContext[] = [];

    for (const scenario of scenarios) {
      const ctx = await createSubmissionWithUploads(trx, scenario.level, scenario.reviewed, scenario.withArchive);
      seedContexts.push(ctx);
    }

    // Cross-join every seeded system_user with every seeded submission via submission_team
    const systemUsers = await trx('system_user').select('system_user_id');
    const teamName = `Seed Submission Team ${faker.string.alphanumeric(12)}`;
    const [{ team_id: seedTeamId }] = await trx('team')
      .insert({
        name: teamName,
        description: 'Auto-generated team for seeded submissions.',
        create_user: 1
      })
      .returning('team_id');

    for (const { system_user_id } of systemUsers) {
      await trx.raw(
        `
          INSERT INTO team_member (team_id, system_user_id, create_user)
          SELECT ?, ?, 1
          WHERE NOT EXISTS (
            SELECT 1
            FROM team_member tm
            WHERE tm.team_id = ?
              AND tm.system_user_id = ?
              AND tm.record_end_date IS NULL
          );
        `,
        [seedTeamId, system_user_id, seedTeamId, system_user_id]
      );
    }

    for (const { submission_id } of seedContexts) {
      await trx.raw(
        `
          INSERT INTO submission_team (submission_id, team_id, create_user)
          SELECT ?, ?, 1
          WHERE NOT EXISTS (
            SELECT 1
            FROM submission_team st
            WHERE st.submission_id = ?
              AND st.team_id = ?
              AND st.record_end_date IS NULL
          );
        `,
        [submission_id, seedTeamId, submission_id, seedTeamId]
      );
    }

    // Backfill data_byte_size for seeded rows — migration runs before seeds,
    // so seeded submission_feature rows have NULL data_byte_size
    await trx.raw(`
      UPDATE submission_feature sf
      SET data_byte_size = octet_length(sf.data::text) + 500 + COALESCE(
        (SELECT a.byte_size FROM artifact a WHERE a.object_key = sf.data->>'artifact_key'),
        0
      )
      WHERE sf.data_byte_size IS NULL;
    `);

    // Derived reachability closure — recomputed wholesale per upload (DELETE + recursive-CTE INSERT),
    // mirroring SubmissionFeatureClosureRepository. Search resolves relatedness against this table, so
    // seeded uploads need their closure rows to be searchable.
    for (const { submission_upload_id } of seedContexts) {
      await computeSubmissionFeatureClosureForUpload(trx, submission_upload_id);
    }
  });
}

/**
 * Creates a complete submission with realistic upload, artifact, and security data
 */
const createSubmissionWithUploads = async (
  knex: SeedConnection,
  securityLevel: SecurityLevel,
  reviewed: boolean,
  withArchive: boolean
): Promise<SeedContext> => {
  // --- 1. Create upload session ---
  const upload_id = await insertUploadRecord(knex);

  // --- 2. Create submission & link upload ---
  const submission_id = await insertSubmissionRecord(knex, reviewed, reviewed);
  const submission_upload_id = await insertSubmissionUploadRecord(knex, submission_id, upload_id);

  // --- 3. Create features (requires submission_upload_id for FK) ---
  const parent_feature_id = await insertSurveyRecord(knex, { submission_id, submission_upload_id });
  const sampleSiteIds = await Promise.all([
    insertSampleSiteRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: parent_feature_id
    }),
    insertSampleSiteRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: parent_feature_id
    })
  ]);
  const telemetryIds = await Promise.all([
    insertTelemetryRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: parent_feature_id
    }),
    insertTelemetryRecord(knex, {
      submission_id,
      submission_upload_id,
      parent_submission_feature_id: parent_feature_id
    })
  ]);

  await insertMockRelatedSubmissionFeatures(knex, sampleSiteIds, telemetryIds);

  // --- 4. Create artifacts and security scans ---
  const artifacts: { artifact_id: string; role: string }[] = [];

  if (withArchive) {
    await createArchiveUpload(knex, upload_id, submission_id, securityLevel, artifacts);
  } else {
    await createDirectUpload(knex, upload_id, submission_id, securityLevel, artifacts);
  }

  return { submission_id, upload_id, submission_upload_id, artifacts };
};

/**
 * Insert deterministic mock relationships between sample-site and telemetry features.
 *
 * @param {Knex} knex
 * @param {number[]} sampleSiteIds
 * @param {number[]} telemetryIds
 * @returns {Promise<void>}
 */
const insertMockRelatedSubmissionFeatures = async (
  knex: SeedConnection,
  sampleSiteIds: number[],
  telemetryIds: number[]
): Promise<void> => {
  const relationshipRows = [
    { source_feature_id: sampleSiteIds[0], target_feature_id: telemetryIds[0], create_user: 1 },
    { source_feature_id: sampleSiteIds[0], target_feature_id: telemetryIds[1], create_user: 1 },
    { source_feature_id: sampleSiteIds[1], target_feature_id: telemetryIds[1], create_user: 1 }
  ];

  await knex('submission_feature_feature')
    .insert(relationshipRows)
    .onConflict(['source_feature_id', 'target_feature_id'])
    .ignore();
};

/**
 * Creates direct artifacts with individual scans (no archive)
 */
const createDirectUpload = async (
  knex: SeedConnection,
  upload_id: string,
  submission_id: number,
  securityLevel: SecurityLevel,
  artifacts: { artifact_id: string; role: string }[]
): Promise<void> => {
  // Define file types and their characteristics
  const fileSpecs = [
    { name: 'feature.csv', role: 'feature', size: faker.number.int({ min: 5000, max: 500000 }) },
    { name: 'metadata.json', role: 'attachment', size: faker.number.int({ min: 1000, max: 50000 }) },
    { name: 'readme.txt', role: 'attachment', size: faker.number.int({ min: 500, max: 10000 }) }
  ];

  for (const fileSpec of fileSpecs) {
    // --- Create artifact ---
    const artifact_result = await knex('artifact')
      .insert({
        bucket: 'biohub-submissions',
        object_key: `submissions/${submission_id}/${faker.string.uuid()}/${fileSpec.name}`,
        byte_size: fileSpec.size,
        checksum_sha256: faker.string.hexadecimal({ length: 64, casing: 'lower' }).substring(0, 64),
        artifact_status: 'uploaded',
        uploaded_at: new Date(),
        format: 'tar',
        create_user: 1
      })
      .returning('artifact_id');
    const { artifact_id } = artifact_result[0];

    artifacts.push({ artifact_id, role: fileSpec.role });

    // --- Link artifact to upload ---
    await knex('upload_artifact').insert({
      upload_id,
      artifact_id,
      role: fileSpec.role,
      create_user: 1
    });

    // --- Create security record ---
    const { security, scanStatus } = getSecurityConfig(securityLevel);

    const artifact_security_result = await knex('artifact_security')
      .insert({
        artifact_id,
        security: security,
        create_user: 1
      })
      .returning('artifact_security_id');
    const { artifact_security_id } = artifact_security_result[0];

    // --- Create security scan ---
    const scan_result = await knex('artifact_security_scan')
      .insert({
        artifact_security_id,
        scan_status: scanStatus,
        scanner_version: 'ClamAV-1.2.3',
        scanned_at: scanStatus === 'completed' ? new Date() : null,
        results: generateScanResults(security),
        create_user: 1
      })
      .returning('artifact_security_scan_id');
    const { artifact_security_scan_id: scan_id } = scan_result[0];

    // --- Create per-file scan results ---
    await knex('artifact_security_scan_file').insert({
      artifact_security_scan_id: scan_id,
      file_path: fileSpec.name,
      result: security === 'pending' ? 'pending' : security,
      create_user: 1
    });
  }
};

/**
 * Creates an archive upload with multiple files inside
 */
const createArchiveUpload = async (
  knex: SeedConnection,
  upload_id: string,
  submission_id: number,
  securityLevel: SecurityLevel,
  artifacts: { artifact_id: string; role: string }[]
): Promise<void> => {
  // --- 1. Create archive artifact ---
  const archive_result = await knex('artifact')
    .insert({
      bucket: 'biohub-submissions',
      object_key: `submissions/${submission_id}/archive-${faker.string.uuid()}.zip`,
      byte_size: faker.number.int({ min: 10000, max: 5000000 }),
      checksum_sha256: faker.string.hexadecimal({ length: 64, casing: 'lower' }).substring(0, 64),
      artifact_status: 'uploaded',
      uploaded_at: new Date(),
      format: 'tar',
      create_user: 1
    })
    .returning('artifact_id');
  const { artifact_id: archive_artifact_id } = archive_result[0];

  artifacts.push({ artifact_id: archive_artifact_id, role: 'archive' });

  // --- 2. Create upload_archive record ---
  const upload_archive_result = await knex('upload_archive')
    .insert({
      upload_id,
      artifact_id: archive_artifact_id,
      archive_status: 'completed',
      create_user: 1
    })
    .returning('upload_archive_id');
  const { upload_archive_id } = upload_archive_result[0];

  // --- 3. Create archive security record ---
  const { security: archiveSecurity, scanStatus } = getSecurityConfig(securityLevel);

  const archive_security_result = await knex('artifact_security')
    .insert({
      artifact_id: archive_artifact_id,
      security: archiveSecurity,
      create_user: 1
    })
    .returning('artifact_security_id');
  const { artifact_security_id: archive_security_id } = archive_security_result[0];

  // --- 4. Create archive scan ---
  const archive_scan_result = await knex('artifact_security_scan')
    .insert({
      artifact_security_id: archive_security_id,
      scan_status: scanStatus,
      scanner_version: 'ClamAV-1.2.3',
      scanned_at: scanStatus === 'completed' ? new Date() : null,
      results: generateScanResults(archiveSecurity),
      create_user: 1
    })
    .returning('artifact_security_scan_id');
  const { artifact_security_scan_id: archive_scan_id } = archive_scan_result[0];

  // --- 5. Create files inside archive ---
  const archiveFiles = [
    { path: 'data/feature.csv', role: 'feature', infected: false },
    { path: 'data/metadata.json', role: 'attachment', infected: securityLevel === 'UNSECURE' },
    { path: 'docs/readme.md', role: 'attachment', infected: false },
    { path: 'docs/notes.txt', role: 'attachment', infected: false }
  ];

  for (const file of archiveFiles) {
    // --- Create extracted artifact ---
    const artifact_result = await knex('artifact')
      .insert({
        bucket: 'biohub-submissions',
        object_key: `submissions/${submission_id}/${file.path}`,
        byte_size: faker.number.int({ min: 1000, max: 500000 }),
        checksum_sha256: faker.string.hexadecimal({ length: 64, casing: 'lower' }).substring(0, 64),
        artifact_status: 'uploaded',
        uploaded_at: new Date(),
        format: 'tar',
        create_user: 1
      })
      .returning('artifact_id');
    const { artifact_id } = artifact_result[0];

    artifacts.push({ artifact_id, role: file.role });

    // --- Link to upload and archive ---
    await knex('upload_artifact').insert({
      upload_id,
      artifact_id,
      upload_archive_id,
      path: file.path,
      role: file.role,
      create_user: 1
    });

    // --- Create security record for extracted file ---
    const fileSecurity = file.infected ? 'infected' : archiveSecurity;

    await knex('artifact_security')
      .insert({
        artifact_id,
        security: fileSecurity,
        create_user: 1
      })
      .returning('artifact_security_id');

    // --- Reuse archive scan for all extracted files ---
    await knex('artifact_security_scan_file').insert({
      artifact_security_scan_id: archive_scan_id,
      file_path: file.path,
      result: fileSecurity === 'pending' ? 'pending' : fileSecurity,
      create_user: 1
    });
  }
};

/**
 * Determines security and scan status based on security level
 */
const getSecurityConfig = (level: SecurityLevel): { security: SecurityStatus; scanStatus: ScanStatus } => {
  switch (level) {
    case 'SECURE':
      return { security: 'clean', scanStatus: 'completed' };
    case 'PARTIALLY_SECURE':
      return { security: 'pending', scanStatus: 'completed' };
    case 'UNSECURE':
      return { security: 'infected', scanStatus: 'completed' };
    default:
      return { security: 'pending', scanStatus: 'pending' };
  }
};

/**
 * Generates realistic scan results based on security status
 */
const generateScanResults = (security: SecurityStatus): object => {
  const baseResults = {
    scanner: 'ClamAV',
    timestamp: new Date().toISOString(),
    scan_time: `${faker.number.int({ min: 100, max: 5000 })}ms`
  };

  switch (security) {
    case 'clean':
      return {
        ...baseResults,
        threat_count: 0,
        status: 'OK',
        summary: 'No threats detected'
      };
    case 'infected':
      return {
        ...baseResults,
        threat_count: faker.number.int({ min: 1, max: 5 }),
        status: 'INFECTED',
        summary: 'Malware detected',
        threats: [
          { name: 'Trojan.Generic', file: 'metadata.json', severity: 'high' },
          { name: 'PUA.Adware', file: 'script.exe', severity: 'medium' }
        ]
      };
    case 'pending':
      return {
        ...baseResults,
        status: 'PENDING',
        summary: 'Scan in progress or queued'
      };
    case 'error':
      return {
        ...baseResults,
        status: 'ERROR',
        summary: 'Scan failed',
        error: 'Timeout during scan'
      };
    default:
      return { ...baseResults, status: 'UNKNOWN' };
  }
};
