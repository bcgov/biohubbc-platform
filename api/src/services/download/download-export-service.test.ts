import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  createMockDownloadRecord,
  createMockDownloadVersionExport,
  createMockDownloadVersionExportListRow,
  createMockDownloadVersionStatusRecord,
  createMockExportArtifactGroup
} from '../../__mocks__/download';
import { DEFAULT_MAX_PART_SIZE_BYTES, SIGNED_URL_EXPIRY_DOWNLOAD } from '../../constants/download';
import { ApiValidationError } from '../../errors/api-error';
import { HTTP403, HTTP404, HTTP409 } from '../../errors/http-error';
import { DownloadArtifactInfo } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { CreateDownloadVersionExportRequest } from '../../models/download-version-export';
import { DownloadVersionExportArtifactWithFile } from '../../models/download-version-export-artifact';
import { FeatureTypeWithProperties } from '../../models/feature-type';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { CodeService } from '../code-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { DownloadExportPart, DownloadExportService } from './download-export-service';
import { DownloadService } from './download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const EXPORT_ID = 'eeee0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';
const GROUP_ID = 'cccc0000-0000-0000-0000-000000000001';
const FAILED_GROUP_ID = 'cccc0000-0000-0000-0000-0000000000ff';
const SYSTEM_USER_ID = 42;

/**
 * A READY download whose most-recent version resolves to VERSION_ID — the precondition the picker
 * reads (`download.download_version_id`). Export creation gates on the explicit request version, not
 * this field, so create tests additionally stub `getDownloadVersion` via `stubReadyVersion`.
 */
const readyDownload = () =>
  createMockDownloadRecord({
    download_id: DOWNLOAD_ID,
    download_status: DownloadStatusEnum.READY,
    download_version_id: VERSION_ID
  });

/**
 * Stub `DownloadVersionRepository.getDownloadVersion` to resolve a READY version owned by
 * the parent download — the happy-path precondition export creation threads through after the auth
 * gate. Returns the stub so a test can override its resolution (e.g. a not-ready or wrong-owner
 * version) to exercise the version gates.
 */
const stubReadyVersion = () =>
  sinon.stub(DownloadVersionRepository.prototype, 'getDownloadVersion').resolves(
    createMockDownloadVersionStatusRecord({
      download_version_id: VERSION_ID,
      download_id: DOWNLOAD_ID,
      status: DownloadStatusEnum.READY
    })
  );

/**
 * Build a `FeatureTypeWithProperties` code entry. The service maps `properties[].{name,type_name}`
 * through `materializedColumnsForType`, so the only fields that matter for column derivation are the
 * type name and each property's `name`/`type_name`; the rest carry harmless defaults.
 */
const featureTypeCode = (
  name: string,
  properties: { name: string; type_name: string }[]
): FeatureTypeWithProperties => ({
  feature_type: { feature_type_id: 1, name, display_name: name, description: null },
  properties: properties.map((property, index) => ({
    feature_type_property_id: index + 1,
    name: property.name,
    display_name: property.name,
    description: null,
    type_name: property.type_name,
    required_value: false,
    calculated_value: false,
    allow_multiple: false
  }))
});

/**
 * A per-type Parquet artifact key the materialized-types parser recognizes — version-scoped:
 * `downloads/{downloadId}/versions/{downloadVersionId}/{featureType}/data.parquet`.
 */
const parquetArtifact = (featureType: string): DownloadArtifactInfo => ({
  artifact_id: `bbbb0000-0000-0000-0000-00000000000${featureType.length}`,
  object_key: `downloads/${DOWNLOAD_ID}/versions/${VERSION_ID}/${featureType}/data.parquet`
});

/**
 * A minimal valid `per_feature_type` recipe over the `observation` type — the happy-path inbound
 * body, carrying the explicit `download_version_id` the create contract requires. Spread
 * `{ ...validPerTypeRequest(), ...overrides }` to perturb a single field.
 */
const validPerTypeRequest = (): CreateDownloadVersionExportRequest => ({
  download_version_id: VERSION_ID,
  version: 1,
  export_type: 'csv',
  mode: 'per_feature_type',
  feature_types: ['observation']
});

describe('DownloadExportService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadVersionExport', () => {
    /**
     * Stub the two NEW config-validation collaborators so the REAL pure utils
     * (`buildAvailableColumnsByType` → `materializedColumnsForType`, `validateExportConfig`,
     * `canonicalizeExportConfig`, `computeConfigHash`) run against a genuine materialized column map.
     * `observation` carries a `count` (number) column; `sample` carries `site` (string).
     */
    const stubMaterializedData = () => {
      // The create flow first gates on the explicit version (getDownloadVersion), then
      // builds the materialized column map from the version's artifacts + the schema codes.
      stubReadyVersion();
      sinon
        .stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifacts')
        .resolves([parquetArtifact('observation'), parquetArtifact('sample')]);
      sinon
        .stub(CodeService.prototype, 'getFeatureTypePropertyCodes')
        .resolves([
          featureTypeCode('observation', [{ name: 'count', type_name: 'number' }]),
          featureTypeCode('sample', [{ name: 'site', type_name: 'string' }])
        ]);
    };

    describe('valid recipe → group lifecycle', () => {
      it('per_feature_type recipe with no active group → creates group (hashed) + inserts export + publishes once', async () => {
        // Verifies: a valid per_feature_type recipe over a materialized type with no active group runs
        // the REAL validate/canonicalize/hash, creates the group keyed on a non-empty configHash with
        // mode/format derived from the recipe, inserts a csv/per_feature_type export, and enqueues once
        // (shouldEnqueue true on a freshly-created group).

        // Step 1: Auth resolves a READY download, and the real column map is built from stubbed data
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: No active group → resolver creates, then re-selects the created group
        const createdGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: GROUP_ID,
          status: DownloadStatusEnum.PENDING
        });
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .onFirstCall()
          .resolves(null)
          .onSecondCall()
          .resolves(createdGroup);
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves(true); // this call inserted the group → enqueue
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        const publishStub = sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export from the valid recipe
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          validPerTypeRequest(),
          getMockDBConnection()
        );

        // Step 4: Verify the group create payload — derived format/mode + a real, non-empty hash + config
        expect(createGroupStub).to.have.been.calledOnce;
        const groupPayload = createGroupStub.firstCall.args[0];
        expect(groupPayload.mode).to.equal('per_feature_type');
        expect(groupPayload.format).to.equal('csv');
        expect(groupPayload.configHash).to.be.a('string').with.length.greaterThan(0);
        expect(groupPayload.config.mode).to.equal('per_feature_type');
        expect(groupPayload.config.feature_types).to.deep.equal(['observation']);

        // Step 5: Verify the export-row insert derived csv/per_feature_type from the recipe
        expect(createExportStub).to.have.been.calledOnce;
        expect(createExportStub.firstCall.args[0]).to.include({ format: 'csv', mode: 'per_feature_type' });

        // Step 6: Verify exactly one publish for the freshly-created group
        expect(publishStub).to.have.been.calledOnce;
        expect(publishStub.firstCall.args[1]).to.deep.equal({
          downloadVersionExportArtifactGroupId: GROUP_ID
        });
      });

      it('lost the create race (ON CONFLICT no-op) → attaches to the winner group, inserts export, does NOT publish', async () => {
        // Verifies the double-enqueue guard: when the pre-create probe sees no group but the INSERT
        // loses the ON CONFLICT race to a concurrent identical request (createExportArtifactGroup
        // returns false), the resolver re-selects the winner's group and must NOT enqueue a second job
        // — the winner already queued the one build. The per-user export row is still inserted.

        // Step 1: Auth + real column map
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: Pre-create probe sees nothing; re-select finds the winner's group; the INSERT reports
        // it did NOT create the row (rowCount 0 → false)
        const winnerGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: GROUP_ID,
          status: DownloadStatusEnum.PENDING
        });
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .onFirstCall()
          .resolves(null)
          .onSecondCall()
          .resolves(winnerGroup);
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves(false); // lost the race
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        const publishStub = sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          validPerTypeRequest(),
          getMockDBConnection()
        );

        // Step 4: It attempted the insert and the export row was written, but no duplicate job was queued
        expect(createGroupStub).to.have.been.calledOnce;
        expect(createExportStub).to.have.been.calledOnce;
        expect(createExportStub.firstCall.args[0].download_version_export_artifact_group_id).to.equal(GROUP_ID);
        expect(publishStub).to.not.have.been.called;
      });

      it('identical recipe with an active group → reuses it: no group create, no publish, export still inserted', async () => {
        // Verifies: the configHash-keyed dedup — a second logically-identical recipe finds an active
        // group, so the resolver returns shouldEnqueue:false; no new group is created and nothing is
        // re-queued, but the per-user export row is still inserted (per-user provenance).

        // Step 1: Auth + real column map
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: findActive returns an already-ready group on the first probe (no re-select needed)
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.READY }));
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves();
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        const publishStub = sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export from the same valid recipe
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          validPerTypeRequest(),
          getMockDBConnection()
        );

        // Step 4: Verify the reuse decision — no create, no enqueue, but the export row is inserted
        expect(createGroupStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
        expect(createExportStub).to.have.been.calledOnce;
      });

      it('the configHash the resolver keys on is deterministic for the same recipe', async () => {
        // Verifies: the real hash is stable — two probes against findActive (the pre-create probe and
        // the post-create re-select) receive the IDENTICAL configHash, the property the DB dedupe key
        // relies on. The hash is computed by the real computeConfigHash, never stubbed.

        // Step 1: Auth + real column map
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: No active group → both probes run; capture the configHash each was called with
        const findActiveStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .onFirstCall()
          .resolves(null)
          .onSecondCall()
          .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PENDING }));
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves(true);
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          validPerTypeRequest(),
          getMockDBConnection()
        );

        // Step 4: Verify both findActive probes and the create used the SAME real hash (configHash is
        // findActive arg index 1; createExportArtifactGroup payload field configHash)
        const probeHash = findActiveStub.firstCall.args[1];
        const reselectHash = findActiveStub.secondCall.args[1];
        const createHash = createGroupStub.firstCall.args[0].configHash;
        expect(probeHash).to.be.a('string').with.length.greaterThan(0);
        expect(reselectHash).to.equal(probeHash);
        expect(createHash).to.equal(probeHash);
      });

      it('failed active group → ends it before creating a fresh one, then publishes once', async () => {
        // Verifies: a `failed` active group is ended (by its id) BEFORE a new group is created, then
        // publish fires once for the genuinely-new work.

        // Step 1: Auth + real column map
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: findActive returns a failed group first, then the fresh group on re-select
        const failedGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: FAILED_GROUP_ID,
          status: DownloadStatusEnum.FAILED,
          error_message: 'boom'
        });
        const freshGroup = createMockExportArtifactGroup({
          download_version_export_artifact_group_id: GROUP_ID,
          status: DownloadStatusEnum.PENDING
        });
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .onFirstCall()
          .resolves(failedGroup)
          .onSecondCall()
          .resolves(freshGroup);
        const endGroupStub = sinon.stub(DownloadVersionExportRepository.prototype, 'endExportArtifactGroup').resolves();
        const createGroupStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup')
          .resolves(true); // fresh group created after ending the failed one → enqueue
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());
        const publishStub = sinon
          .stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob')
          .resolves('mock-job-id' as any);

        // Step 3: Create the export
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          validPerTypeRequest(),
          getMockDBConnection()
        );

        // Step 4: Verify the dead group was ended (by its id) BEFORE the create, then one publish
        expect(endGroupStub).to.have.been.calledOnceWith(FAILED_GROUP_ID);
        expect(endGroupStub).to.have.been.calledBefore(createGroupStub);
        expect(publishStub).to.have.been.calledOnce;
        expect(publishStub.firstCall.args[1]).to.deep.equal({
          downloadVersionExportArtifactGroupId: GROUP_ID
        });
      });
    });

    describe('mode derivation', () => {
      it('denormalized recipe → inserts the export with mode denormalized', async () => {
        // Verifies: the insert `mode` is whatever the validated recipe resolved to — a valid
        // denormalized recipe (root in feature_types + a valid merge step over materialized columns)
        // persists with mode 'denormalized', not the per_feature_type default.

        // Step 1: Auth + real column map (observation.uuid + sample.parent_uuid are structural, always
        // valid join targets; both types are materialized)
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: findActive returns a ready group (no create / publish noise — mode is the focus)
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.READY }));
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport({ mode: 'denormalized' }));

        // Step 3: Create the export from a valid denormalized recipe
        const denormalizedRequest: CreateDownloadVersionExportRequest = {
          download_version_id: VERSION_ID,
          version: 1,
          export_type: 'csv',
          mode: 'denormalized',
          root_feature_type: 'observation',
          feature_types: ['observation', 'sample'],
          merge_steps: [
            {
              left_feature_type: 'observation',
              left_column: 'uuid',
              right_feature_type: 'sample',
              right_column: 'parent_uuid',
              merge_type: 'left'
            }
          ]
        };
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          denormalizedRequest,
          getMockDBConnection()
        );

        // Step 4: Verify the insert carried the recipe's mode
        expect(createExportStub.firstCall.args[0].mode).to.equal('denormalized');
      });
    });

    describe('insert payload', () => {
      it('defaults max_part_size_bytes and threads version id + resolved group id into the insert', async () => {
        // Verifies: the service resolves the version id from the download, defaults
        // max_part_size_bytes when the request omits it, hard-codes format='csv', and threads the
        // resolved group id into the insert payload.

        // Step 1: Auth + real column map
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: findActive returns a ready group
        sinon.stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup').resolves(
          createMockExportArtifactGroup({
            download_version_export_artifact_group_id: GROUP_ID,
            status: DownloadStatusEnum.READY
          })
        );
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());

        // Step 3: Create the export with NO max_part_size_bytes in the request
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          validPerTypeRequest(),
          getMockDBConnection()
        );

        // Step 4: Verify the full insert payload
        expect(createExportStub.firstCall.args[0]).to.deep.equal({
          download_version_id: VERSION_ID,
          format: 'csv',
          mode: 'per_feature_type',
          max_part_size_bytes: DEFAULT_MAX_PART_SIZE_BYTES,
          download_version_export_artifact_group_id: GROUP_ID
        });
      });

      it('peels a request-supplied max_part_size_bytes off the recipe and threads it to the insert', async () => {
        // Verifies: max_part_size_bytes is packaging, not recipe — it is stripped before
        // canonicalize/hash but still reaches the insert payload (and the group-resolution key)
        // unchanged when the request supplies it.

        // Step 1: Auth + real column map
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();

        // Step 2: findActive returns a ready group
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup')
          .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.READY }));
        const createExportStub = sinon
          .stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport')
          .resolves(createMockDownloadVersionExport());

        // Step 3: Create the export WITH an explicit max_part_size_bytes on the recipe body
        const service = new DownloadExportService(getMockDBConnection());
        await service.createDownloadVersionExport(
          DOWNLOAD_ID,
          SYSTEM_USER_ID,
          { ...validPerTypeRequest(), max_part_size_bytes: '10485760' },
          getMockDBConnection()
        );

        // Step 4: Verify the supplied value reached the insert payload
        expect(createExportStub.firstCall.args[0].max_part_size_bytes).to.equal('10485760');
      });
    });

    describe('invalid recipe → rejects before any side effect', () => {
      it('rejects ApiValidationError when a feature type is not materialized — persists nothing', async () => {
        // Verifies: validation runs (REAL validateExportConfig) against the materialized column map
        // BEFORE any group/job work; a recipe over a non-materialized type rejects with
        // ApiValidationError and never creates a group or publishes.

        // Step 1: Auth + real column map (only observation/sample materialized)
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();
        const findActiveStub = sinon.stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup');
        const createGroupStub = sinon.stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup');
        const createExportStub = sinon.stub(DownloadVersionExportRepository.prototype, 'createDownloadVersionExport');
        const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');

        // Step 2: Attempt to create the export with a recipe referencing an absent type
        const service = new DownloadExportService(getMockDBConnection());
        try {
          await service.createDownloadVersionExport(
            DOWNLOAD_ID,
            SYSTEM_USER_ID,
            { ...validPerTypeRequest(), feature_types: ['not_materialized'] },
            getMockDBConnection()
          );
          expect.fail('Expected throw');
        } catch (err) {
          // Step 3: Verify the validation error type
          expect(err).to.be.instanceOf(ApiValidationError);
        }

        // Step 4: Verify nothing was persisted or enqueued — validation gates before all side effects
        expect(findActiveStub).to.not.have.been.called;
        expect(createGroupStub).to.not.have.been.called;
        expect(createExportStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
      });

      it('rejects ApiValidationError when a merge step references a column absent from the type — persists nothing', async () => {
        // Verifies: the data-aware column existence check — a denormalized recipe whose merge step
        // joins on a column that does not exist on a materialized type rejects with ApiValidationError
        // before any side effect.

        // Step 1: Auth + real column map
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        stubMaterializedData();
        const createGroupStub = sinon.stub(DownloadVersionExportRepository.prototype, 'createExportArtifactGroup');
        const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');

        // Step 2: Attempt to create with a merge step keyed on a non-existent column ('nonexistent' is
        // not a property of sample and is not a structural column)
        const service = new DownloadExportService(getMockDBConnection());
        try {
          await service.createDownloadVersionExport(
            DOWNLOAD_ID,
            SYSTEM_USER_ID,
            {
              version: 1,
              export_type: 'csv',
              mode: 'denormalized',
              root_feature_type: 'observation',
              feature_types: ['observation', 'sample'],
              merge_steps: [
                {
                  left_feature_type: 'observation',
                  left_column: 'uuid',
                  right_feature_type: 'sample',
                  right_column: 'nonexistent',
                  merge_type: 'left'
                }
              ]
            },
            getMockDBConnection()
          );
          expect.fail('Expected throw');
        } catch (err) {
          // Step 3: Verify the validation error type
          expect(err).to.be.instanceOf(ApiValidationError);
        }

        // Step 4: Verify nothing was persisted or enqueued
        expect(createGroupStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
      });
    });

    describe('gates', () => {
      it('throws HTTP403 when systemUserId is null and does not call getAuthorizedDownload', async () => {
        // Verifies: exports are authenticated-only — a null user short-circuits before any auth /
        // group / publish work.

        // Step 1: Stub auth so we can assert it is never reached
        const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload');

        // Step 2: Call with a null systemUserId
        const service = new DownloadExportService(getMockDBConnection());
        try {
          await service.createDownloadVersionExport(DOWNLOAD_ID, null, validPerTypeRequest(), getMockDBConnection());
          expect.fail('Expected throw');
        } catch (err) {
          // Step 3: Verify HTTP403
          expect(err).to.be.instanceOf(HTTP403);
        }

        // Step 4: Verify auth was never invoked
        expect(authStub).to.not.have.been.called;
      });

      [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING, DownloadStatusEnum.FAILED].forEach((status) => {
        it(`throws HTTP409 when the named version status is ${status}, doing no resolver or publish work`, async () => {
          // Verifies: an export binds to a materialized snapshot — only a READY VERSION can export. The
          // named version's own status is the gate (not the parent download's), so a non-ready version
          // surfaces 409 before any group resolution or publish.

          // Step 1: Auth resolves; the named version exists and is owned by the download, but is not ready
          sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
          sinon.stub(DownloadVersionRepository.prototype, 'getDownloadVersion').resolves(
            createMockDownloadVersionStatusRecord({
              download_version_id: VERSION_ID,
              download_id: DOWNLOAD_ID,
              status
            })
          );
          const findActiveStub = sinon.stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup');
          const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');

          // Step 2: Attempt to create the export
          const service = new DownloadExportService(getMockDBConnection());
          try {
            await service.createDownloadVersionExport(
              DOWNLOAD_ID,
              SYSTEM_USER_ID,
              validPerTypeRequest(),
              getMockDBConnection()
            );
            expect.fail('Expected throw');
          } catch (err) {
            // Step 3: Verify HTTP409
            expect(err).to.be.instanceOf(HTTP409);
          }

          // Step 4: Verify no resolver / publish work happened
          expect(findActiveStub).to.not.have.been.called;
          expect(publishStub).to.not.have.been.called;
        });
      });

      it('throws HTTP404 when the named version belongs to a different download, doing no resolver or publish work', async () => {
        // Verifies: the version-ownership check is a real auth boundary — a caller authorized on one
        // download cannot export another download's materialized artifacts by naming its version id.

        // Step 1: Auth resolves the parent download, but the named version is owned by a DIFFERENT download
        sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
        sinon.stub(DownloadVersionRepository.prototype, 'getDownloadVersion').resolves(
          createMockDownloadVersionStatusRecord({
            download_version_id: VERSION_ID,
            download_id: 'aaaa0000-0000-0000-0000-0000000000ff',
            status: DownloadStatusEnum.READY
          })
        );
        const findActiveStub = sinon.stub(DownloadVersionExportRepository.prototype, 'findActiveExportArtifactGroup');
        const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');

        // Step 2: Attempt to create the export
        const service = new DownloadExportService(getMockDBConnection());
        try {
          await service.createDownloadVersionExport(
            DOWNLOAD_ID,
            SYSTEM_USER_ID,
            validPerTypeRequest(),
            getMockDBConnection()
          );
          expect.fail('Expected throw');
        } catch (err) {
          // Step 3: Verify HTTP404
          expect(err).to.be.instanceOf(HTTP404);
        }

        // Step 4: Verify no resolver / publish work happened
        expect(findActiveStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
      });
    });
  });

  describe('getDownloadVersionExportFeatureTypes', () => {
    it('returns one entry per materialized type with the full structural + property-derived column set', async () => {
      // Verifies: the picker read returns exactly the materialized types, each with the EXACT column
      // set the CSV pipeline emits — structural columns (submission_feature_id/uuid/parent_uuid) then
      // schema-derived headers — and drops codes for types that did not materialize a Parquet file.

      // Step 1: Auth resolves a READY download
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
      const versionStub = stubReadyVersion();

      // Step 2: Only `observation` materialized a Parquet artifact; codes also carry an
      // unmaterialized `artifact` type that must be filtered out
      sinon
        .stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifacts')
        .resolves([parquetArtifact('observation')]);
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves([
        featureTypeCode('observation', [
          { name: 'count', type_name: 'number' },
          { name: 'comment', type_name: 'string' }
        ]),
        featureTypeCode('artifact', [{ name: 'filePath', type_name: 'string' }])
      ]);

      // Step 3: Read the exportable feature types
      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.getDownloadVersionExportFeatureTypes(DOWNLOAD_ID, SYSTEM_USER_ID, VERSION_ID);

      // Step 4: Verify only the materialized type is offered, with the full column set in order
      expect(result).to.deep.equal([
        {
          feature_type: 'observation',
          columns: ['submission_feature_id', 'uuid', 'parent_uuid', 'count', 'comment']
        }
      ]);
      expect(versionStub).to.have.been.calledOnceWith(VERSION_ID);
    });

    it('delegates authorization to getAuthorizedDownload and propagates its HTTP403', async () => {
      // Verifies: the picker read authorizes against the parent download FIRST — an auth failure
      // (HTTP403) propagates and the materialized-types read never runs.

      // Step 1: Auth rejects with HTTP403
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));
      const listArtifactsStub = sinon.stub(DownloadVersionRepository.prototype, 'listDownloadVersionArtifacts');

      // Step 2: Attempt the read
      const service = new DownloadExportService(getMockDBConnection());
      try {
        await service.getDownloadVersionExportFeatureTypes(DOWNLOAD_ID, SYSTEM_USER_ID);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: Verify the auth error propagates
        expect(err).to.be.instanceOf(HTTP403);
      }

      // Step 4: Verify the materialized-types read never ran
      expect(listArtifactsStub).to.not.have.been.called;
    });
  });

  describe('getAuthorizedExport', () => {
    it('authorizes the parent download before fetching the export', async () => {
      // Verifies: team-auth runs against the parent download FIRST, then the export is loaded — the
      // auth rule lives in exactly one place.

      // Step 1: Stub auth and the export fetch
      const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(readyDownload());
      const exportRecord = {
        ...createMockDownloadVersionExport(),
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.READY,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        error_message: null
      };
      const getStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'getDownloadVersionExport')
        .resolves(exportRecord);

      // Step 2: Authorize the export
      const service = new DownloadExportService(getMockDBConnection());
      await service.getAuthorizedExport(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);

      // Step 3: Verify auth ran against the parent download with the export id, BEFORE the fetch
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, SYSTEM_USER_ID);
      expect(getStub).to.have.been.calledOnceWith(EXPORT_ID);
      expect(authStub).to.have.been.calledBefore(getStub);
    });

    it('propagates the auth error and never fetches the export when not authorized', async () => {
      // Verifies: an auth failure short-circuits — the export is never loaded.

      // Step 1: Auth rejects with HTTP403
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));
      const getStub = sinon.stub(DownloadVersionExportRepository.prototype, 'getDownloadVersionExport');

      // Step 2: Attempt to authorize the export
      const service = new DownloadExportService(getMockDBConnection());
      try {
        await service.getAuthorizedExport(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: Verify the auth error propagates
        expect(err).to.be.instanceOf(HTTP403);
      }

      // Step 4: Verify the export was never fetched
      expect(getStub).to.not.have.been.called;
    });
  });

  describe('listDownloadVersionExports', () => {
    it('lists exports without applying route-level authorization', async () => {
      const rows = [createMockDownloadVersionExportListRow({ download_id: DOWNLOAD_ID })];
      const listStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'listDownloadVersionExports')
        .resolves(rows);

      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.listDownloadVersionExports(DOWNLOAD_ID);

      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_ID);
      expect(result).to.eql(rows);
    });
  });

  describe('listDownloadVersionExportsCount', () => {
    it('counts exports without applying route-level authorization', async () => {
      const countStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'listDownloadVersionExportsCount')
        .resolves(2);

      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.listDownloadVersionExportsCount(DOWNLOAD_ID);

      expect(countStub).to.have.been.calledOnceWith(DOWNLOAD_ID);
      expect(result).to.equal(2);
    });
  });

  describe('listExportPartUrls', () => {
    it('builds one presigned URL per artifact — filename keyed by download + version id, object key from the artifact row', async () => {
      // Verifies: the saved filename is {downloadId}_{versionId}_{timestamp}_part{N}.zip (ids read
      // from the object key), getSignedUrl receives the group-keyed object_key, and chunk_id ASC order
      // is preserved.

      // Step 1: Stub the artifact list (full group-keyed object keys)
      const key1 = `downloads/${DOWNLOAD_ID}/versions/${VERSION_ID}/exports/${GROUP_ID}/biohub-${GROUP_ID}-part-1.zip`;
      const key2 = `downloads/${DOWNLOAD_ID}/versions/${VERSION_ID}/exports/${GROUP_ID}/biohub-${GROUP_ID}-part-2.zip`;
      const artifacts: DownloadVersionExportArtifactWithFile[] = [
        {
          download_version_export_artifact_id: 'ffff0000-0000-0000-0000-000000000001',
          download_version_export_artifact_group_id: GROUP_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          chunk_id: 1,
          byte_size: '100',
          object_key: key1
        },
        {
          download_version_export_artifact_id: 'ffff0000-0000-0000-0000-000000000002',
          download_version_export_artifact_group_id: GROUP_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000002',
          chunk_id: 2,
          byte_size: '200',
          object_key: key2
        }
      ];
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'listExportArtifactGroupArtifactsByExportId')
        .resolves(artifacts);
      const urlStub = sinon
        .stub(ObjectStorageService.prototype, 'getSignedUrl')
        .onFirstCall()
        .resolves('https://example.com/part-1')
        .onSecondCall()
        .resolves('https://example.com/part-2');

      // Step 2: List the part URLs with a fixed started_at
      const service = new DownloadExportService(getMockDBConnection());
      const parts = await service.listExportPartUrls(EXPORT_ID, '2026-04-22T15:38:43.000Z');

      // Step 3: Verify the per-part shape, order, and renamed file_size_bytes
      expect(parts).to.deep.equal([
        { chunk_id: 1, file_size_bytes: '100', url: 'https://example.com/part-1' },
        { chunk_id: 2, file_size_bytes: '200', url: 'https://example.com/part-2' }
      ]);

      // Step 4: Verify getSignedUrl got the GROUP-keyed object_key while the disposition filename
      // names the download + version (not the export or group), with the started_at timestamp
      expect(urlStub.firstCall.args).to.deep.equal([
        BucketType.MAIN,
        key1,
        SIGNED_URL_EXPIRY_DOWNLOAD,
        `attachment; filename="${DOWNLOAD_ID}_${VERSION_ID}_20260422-153843_part1.zip"`
      ]);
      expect(urlStub.secondCall.args[3]).to.equal(
        `attachment; filename="${DOWNLOAD_ID}_${VERSION_ID}_20260422-153843_part2.zip"`
      );
    });

    it('returns [] when the export has no artifacts', async () => {
      // Verifies: empty artifact list short-circuits to an empty parts array (no getSignedUrl calls).

      // Step 1: Stub an empty artifact list
      sinon.stub(DownloadVersionExportRepository.prototype, 'listExportArtifactGroupArtifactsByExportId').resolves([]);
      const urlStub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl');

      // Step 2: List the part URLs
      const service = new DownloadExportService(getMockDBConnection());
      const parts = await service.listExportPartUrls(EXPORT_ID, '2026-04-22T15:38:43.000Z');

      // Step 3: Verify empty result and no signing work
      expect(parts).to.have.lengthOf(0);
      expect(urlStub).to.not.have.been.called;
    });

    it('falls back to a live timestamp prefix when started_at is null', async () => {
      // Verifies: a null started_at does not crash — the filename uses a now()-derived prefix.

      // Step 1: Stub a single artifact (full group-keyed object key)
      const artifacts: DownloadVersionExportArtifactWithFile[] = [
        {
          download_version_export_artifact_id: 'ffff0000-0000-0000-0000-000000000001',
          download_version_export_artifact_group_id: GROUP_ID,
          artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
          chunk_id: 1,
          byte_size: '100',
          object_key: `downloads/${DOWNLOAD_ID}/versions/${VERSION_ID}/exports/${GROUP_ID}/biohub-${GROUP_ID}-part-1.zip`
        }
      ];
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'listExportArtifactGroupArtifactsByExportId')
        .resolves(artifacts);
      const urlStub = sinon.stub(ObjectStorageService.prototype, 'getSignedUrl').resolves('https://example.com/part-1');

      // Step 2: List with a null started_at
      const service = new DownloadExportService(getMockDBConnection());
      await service.listExportPartUrls(EXPORT_ID, null);

      // Step 3: Verify the disposition filename shape (live timestamp — assert shape, not exact value)
      expect(urlStub.firstCall.args[3]).to.match(
        new RegExp(`^attachment; filename="${DOWNLOAD_ID}_${VERSION_ID}_\\d{8}-\\d{6}_part1\\.zip"$`)
      );
    });
  });

  describe('getAuthorizedExportWithParts', () => {
    it('populates parts via listExportPartUrls when the export is ready', async () => {
      // Verifies: a READY export composes getAuthorizedExport + listExportPartUrls, threading the
      // export's started_at into the URL assembly, and returns the record with parts attached.

      // Step 1: Stub the composed methods — auth returns a READY export, parts listing returns one part
      const exportRecord = {
        ...createMockDownloadVersionExport({ download_version_export_id: EXPORT_ID }),
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.READY,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        error_message: null
      };
      const authStub = sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const parts: DownloadExportPart[] = [{ chunk_id: 1, file_size_bytes: '100', url: 'https://example.com/part-1' }];
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls').resolves(parts);

      // Step 2: Get the detail shape
      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.getAuthorizedExportWithParts(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);

      // Step 3: Verify auth threaded the params and parts were listed with the export's started_at
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);
      expect(listStub).to.have.been.calledOnceWith(EXPORT_ID, exportRecord.started_at);
      expect(result).to.eql({ ...exportRecord, parts });
    });

    it('returns empty parts and skips listExportPartUrls when the export is not ready', async () => {
      // Verifies: a non-ready export (pending) never assembles part URLs — parts is [].

      // Step 1: Stub auth to return a PENDING export
      const exportRecord = {
        ...createMockDownloadVersionExport({ download_version_export_id: EXPORT_ID }),
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.PENDING,
        started_at: null,
        completed_at: null,
        error_message: null
      };
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      // Step 2: Get the detail shape
      const service = new DownloadExportService(getMockDBConnection());
      const result = await service.getAuthorizedExportWithParts(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);

      // Step 3: Verify no URL assembly and an empty parts array
      expect(listStub).to.not.have.been.called;
      expect(result).to.eql({ ...exportRecord, parts: [] });
    });

    it('propagates the auth error and never lists parts when not authorized', async () => {
      // Verifies: an auth failure short-circuits — part URLs are never assembled.

      // Step 1: Auth rejects with HTTP403
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').rejects(new HTTP403('Access denied'));
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      // Step 2: Attempt to get the detail shape
      const service = new DownloadExportService(getMockDBConnection());
      try {
        await service.getAuthorizedExportWithParts(DOWNLOAD_ID, EXPORT_ID, SYSTEM_USER_ID);
        expect.fail('Expected throw');
      } catch (err) {
        // Step 3: Verify the auth error propagated
        expect(err).to.be.instanceOf(HTTP403);
      }

      // Step 4: Verify parts were never listed
      expect(listStub).to.not.have.been.called;
    });
  });
});
