import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DOWNLOAD_EXPORT_FANOUT_MAX_ROWS } from '../constants/download';
import { ApiValidationError } from '../errors/api-error';
import { ExportConfig, MergeStep } from '../models/download-export-config';
import {
  buildOutputRecord,
  canonicalizeExportConfig,
  coerceJoinKey,
  computeConfigHash,
  computeDimensionProjection,
  dedupeOutputColumnNames,
  DimensionMaps,
  joinRowTransform,
  materializedColumnsForType,
  mergePrefixed,
  orderMergeSteps,
  stableStringify,
  validateExportConfig
} from './export-config-utils';

/**
 * Parse a recipe through the real schema so tests run on the same defaulted
 * shape the service hands the canonicalizer.
 */
const parse = (raw: unknown): ExportConfig => ExportConfig.parse(raw);

describe('export-config-utils', () => {
  describe('materializedColumnsForType', () => {
    it('prepends the structural columns to the schema headers', () => {
      const columns = materializedColumnsForType([
        { feature_property_name: 'count', feature_property_type_name: 'number' },
        { feature_property_name: 'species', feature_property_type_name: 'string' }
      ]);

      expect(columns).to.deep.equal(['submission_feature_id', 'uuid', 'parent_uuid', 'count', 'species']);
    });
  });

  describe('canonicalizeExportConfig + computeConfigHash', () => {
    const baseConfig = {
      version: 1 as const,
      export_type: 'csv' as const,
      mode: 'denormalized' as const,
      root_feature_type: 'animal',
      feature_types: ['deployment', 'animal'],
      merge_steps: [
        {
          left_feature_type: 'animal',
          left_column: 'uuid',
          right_feature_type: 'deployment',
          right_column: 'parent_uuid'
        }
      ],
      output_columns: [{ feature_type: 'deployment', column: 'device_id' }]
    };

    it('sorts feature_types', () => {
      const canonical = canonicalizeExportConfig(parse(baseConfig));
      expect(canonical.feature_types).to.deep.equal(['animal', 'deployment']);
    });

    it('dedupes feature_types (a set has no multiplicity)', () => {
      const canonical = canonicalizeExportConfig(
        parse({ ...baseConfig, feature_types: ['animal', 'animal', 'deployment'] })
      );
      expect(canonical.feature_types).to.deep.equal(['animal', 'deployment']);
    });

    it('hashes identically whether or not feature_types carries a duplicate (reuse hit, not a miss)', () => {
      const single = computeConfigHash(
        canonicalizeExportConfig(parse({ ...baseConfig, feature_types: ['animal', 'deployment'] }))
      );
      const withDuplicate = computeConfigHash(
        canonicalizeExportConfig(parse({ ...baseConfig, feature_types: ['animal', 'deployment', 'deployment'] }))
      );
      expect(single).to.equal(withDuplicate);
    });

    it('preserves merge_steps order', () => {
      const config = parse({
        ...baseConfig,
        feature_types: ['animal', 'deployment', 'observation'],
        merge_steps: [
          { left_feature_type: 'animal', left_column: 'uuid', right_feature_type: 'deployment', right_column: 'a' },
          { left_feature_type: 'deployment', left_column: 'b', right_feature_type: 'observation', right_column: 'c' }
        ]
      });

      const canonical = canonicalizeExportConfig(config);
      expect(canonical.merge_steps.map((step) => step.right_feature_type)).to.deep.equal(['deployment', 'observation']);
    });

    it('defaults output_column to {feature_type}_{column} before hashing', () => {
      const canonical = canonicalizeExportConfig(parse(baseConfig));
      expect(canonical.output_columns?.[0].output_column).to.equal('deployment_device_id');
    });

    it('hashes identically for shuffled object keys', () => {
      const a = computeConfigHash(canonicalizeExportConfig(parse(baseConfig)));
      const b = computeConfigHash(
        canonicalizeExportConfig(
          parse({
            output_columns: [{ column: 'device_id', feature_type: 'deployment' }],
            merge_steps: [
              {
                right_column: 'parent_uuid',
                right_feature_type: 'deployment',
                left_column: 'uuid',
                left_feature_type: 'animal'
              }
            ],
            feature_types: ['deployment', 'animal'],
            root_feature_type: 'animal',
            mode: 'denormalized',
            export_type: 'csv',
            version: 1
          })
        )
      );

      expect(a).to.equal(b);
    });

    it('hashes identically for shuffled feature_types', () => {
      const a = computeConfigHash(canonicalizeExportConfig(parse(baseConfig)));
      const b = computeConfigHash(
        canonicalizeExportConfig(parse({ ...baseConfig, feature_types: ['animal', 'deployment'] }))
      );

      expect(a).to.equal(b);
    });

    it('hashes differently when merge_steps are reordered', () => {
      const forward = parse({
        ...baseConfig,
        feature_types: ['animal', 'deployment', 'observation'],
        merge_steps: [
          { left_feature_type: 'animal', left_column: 'uuid', right_feature_type: 'deployment', right_column: 'a' },
          { left_feature_type: 'deployment', left_column: 'b', right_feature_type: 'observation', right_column: 'c' }
        ]
      });
      const reversed = parse({
        ...baseConfig,
        feature_types: ['animal', 'deployment', 'observation'],
        merge_steps: [
          { left_feature_type: 'deployment', left_column: 'b', right_feature_type: 'observation', right_column: 'c' },
          { left_feature_type: 'animal', left_column: 'uuid', right_feature_type: 'deployment', right_column: 'a' }
        ]
      });

      expect(computeConfigHash(canonicalizeExportConfig(forward))).to.not.equal(
        computeConfigHash(canonicalizeExportConfig(reversed))
      );
    });

    it('re-hashes a stored (already-canonical) config to itself', () => {
      const canonical = canonicalizeExportConfig(parse(baseConfig));
      const firstHash = computeConfigHash(canonical);
      const secondHash = computeConfigHash(canonicalizeExportConfig(parse(canonical)));

      expect(secondHash).to.equal(firstHash);
    });

    it('produces a 64-character hex digest', () => {
      const hash = computeConfigHash(canonicalizeExportConfig(parse(baseConfig)));
      expect(hash).to.match(/^[0-9a-f]{64}$/);
    });
  });

  describe('stableStringify', () => {
    it('serializes null', () => {
      expect(stableStringify(null)).to.equal('null');
    });

    it('sorts object keys but preserves array order', () => {
      expect(stableStringify({ b: 1, a: [3, 1, 2] })).to.equal('{"a":[3,1,2],"b":1}');
    });
  });

  describe('orderMergeSteps', () => {
    it('orders a linear chain root-first', () => {
      const ordered = orderMergeSteps('animal', [
        {
          left_feature_type: 'deployment',
          left_column: 'b',
          right_feature_type: 'observation',
          right_column: 'c',
          merge_type: 'left'
        },
        {
          left_feature_type: 'animal',
          left_column: 'uuid',
          right_feature_type: 'deployment',
          right_column: 'a',
          merge_type: 'left'
        }
      ]);

      expect(ordered.map((step) => step.right_feature_type)).to.deep.equal(['deployment', 'observation']);
    });

    it('throws on a cycle', () => {
      expect(() =>
        orderMergeSteps('animal', [
          {
            left_feature_type: 'deployment',
            left_column: 'b',
            right_feature_type: 'observation',
            right_column: 'c',
            merge_type: 'left'
          },
          {
            left_feature_type: 'observation',
            left_column: 'c',
            right_feature_type: 'deployment',
            right_column: 'b',
            merge_type: 'left'
          }
        ])
      ).to.throw(/unreachable from root/);
    });

    it('throws when a step is unreachable from the root', () => {
      expect(() =>
        orderMergeSteps('animal', [
          {
            left_feature_type: 'observation',
            left_column: 'c',
            right_feature_type: 'sample',
            right_column: 'd',
            merge_type: 'left'
          }
        ])
      ).to.throw(/unreachable from root/);
    });

    it('throws on a self-edge (root joined onto itself)', () => {
      expect(() =>
        orderMergeSteps('animal', [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'animal',
            right_column: 'parent_uuid',
            merge_type: 'left'
          }
        ])
      ).to.throw(/cycle/);
    });

    it('throws on a back-edge that re-joins the root after a chain', () => {
      // root-reachable cycle: animal -> deployment -> animal. Both left sides are
      // reachable, so this was previously accepted; the right side re-joining the
      // already-present root must now be rejected.
      expect(() =>
        orderMergeSteps('animal', [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'deployment',
            right_column: 'a',
            merge_type: 'left'
          },
          {
            left_feature_type: 'deployment',
            left_column: 'b',
            right_feature_type: 'animal',
            right_column: 'uuid',
            merge_type: 'left'
          }
        ])
      ).to.throw(/cycle/);
    });

    it('throws when the same dimension is folded in twice', () => {
      expect(() =>
        orderMergeSteps('animal', [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'deployment',
            right_column: 'a',
            merge_type: 'left'
          },
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'deployment',
            right_column: 'a',
            merge_type: 'left'
          }
        ])
      ).to.throw(/cycle/);
    });

    it('still accepts a legitimate multi-step chain (no over-rejection)', () => {
      const ordered = orderMergeSteps('animal', [
        {
          left_feature_type: 'animal',
          left_column: 'uuid',
          right_feature_type: 'deployment',
          right_column: 'a',
          merge_type: 'left'
        },
        {
          left_feature_type: 'deployment',
          left_column: 'b',
          right_feature_type: 'observation',
          right_column: 'c',
          merge_type: 'left'
        }
      ]);

      expect(ordered.map((step) => step.right_feature_type)).to.deep.equal(['deployment', 'observation']);
    });
  });

  describe('validateExportConfig', () => {
    const columns = new Map<string, Set<string>>([
      ['animal', new Set(['submission_feature_id', 'uuid', 'parent_uuid', 'name'])],
      ['deployment', new Set(['submission_feature_id', 'uuid', 'parent_uuid', 'device_id'])]
    ]);

    /**
     * Run validation and return the accumulated messages from the thrown
     * ApiValidationError, failing the test if validation unexpectedly passed.
     */
    const invalidErrors = (raw: unknown): (string | object)[] => {
      let thrown: unknown;
      try {
        validateExportConfig(parse(raw), columns);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, 'expected validateExportConfig to throw').to.be.instanceOf(ApiValidationError);
      return (thrown as ApiValidationError).errors;
    };

    it('does not throw for a valid per_feature_type config', () => {
      expect(() =>
        validateExportConfig(
          parse({ version: 1, export_type: 'csv', mode: 'per_feature_type', feature_types: ['animal', 'deployment'] }),
          columns
        )
      ).to.not.throw();
    });

    it('does not throw for a valid denormalized config', () => {
      expect(() =>
        validateExportConfig(
          parse({
            version: 1,
            export_type: 'csv',
            mode: 'denormalized',
            root_feature_type: 'animal',
            feature_types: ['animal', 'deployment'],
            merge_steps: [
              {
                left_feature_type: 'animal',
                left_column: 'uuid',
                right_feature_type: 'deployment',
                right_column: 'parent_uuid'
              }
            ],
            output_columns: [{ feature_type: 'deployment', column: 'device_id' }]
          }),
          columns
        )
      ).to.not.throw();
    });

    it('does not throw for a degenerate single-type empty-steps denormalized config', () => {
      expect(() =>
        validateExportConfig(
          parse({
            version: 1,
            export_type: 'csv',
            mode: 'denormalized',
            root_feature_type: 'animal',
            feature_types: ['animal']
          }),
          columns
        )
      ).to.not.throw();
    });

    it('accepts structural columns as valid join targets', () => {
      expect(() =>
        validateExportConfig(
          parse({
            version: 1,
            export_type: 'csv',
            mode: 'denormalized',
            root_feature_type: 'animal',
            feature_types: ['animal', 'deployment'],
            merge_steps: [
              {
                left_feature_type: 'animal',
                left_column: 'uuid',
                right_feature_type: 'deployment',
                right_column: 'parent_uuid'
              }
            ]
          }),
          columns
        )
      ).to.not.throw();
    });

    it('throws for per_feature_type carrying merge_steps', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['animal', 'deployment'],
        merge_steps: [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'deployment',
            right_column: 'parent_uuid'
          }
        ]
      });

      expect(errors.some((error) => String(error).includes('merge_steps'))).to.be.true;
    });

    it('throws for denormalized without a root_feature_type', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        feature_types: ['animal', 'deployment']
      });

      expect(errors.some((error) => String(error).includes('root_feature_type'))).to.be.true;
    });

    it('throws for denormalized when root_feature_type is not in feature_types', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'observation',
        feature_types: ['animal', 'deployment']
      });

      expect(errors.some((error) => String(error).includes('observation'))).to.be.true;
    });

    it('throws for a feature type that is not materialized', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['animal', 'observation']
      });

      expect(errors).to.have.lengthOf(1);
      expect(String(errors[0])).to.contain('observation');
    });

    it('throws for a column that does not exist on a type', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment'],
        merge_steps: [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'deployment',
            right_column: 'missing_col'
          }
        ]
      });

      expect(errors.some((error) => String(error).includes('missing_col'))).to.be.true;
    });

    it('accumulates multiple errors into one ApiValidationError', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment'],
        merge_steps: [
          {
            left_feature_type: 'animal',
            left_column: 'no_left',
            right_feature_type: 'deployment',
            right_column: 'no_right'
          }
        ],
        output_columns: [{ feature_type: 'deployment', column: 'also_missing' }]
      });

      expect(errors.length).to.be.greaterThan(1);
    });

    it('throws for a cyclic merge graph', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment'],
        merge_steps: [
          {
            left_feature_type: 'deployment',
            left_column: 'device_id',
            right_feature_type: 'animal',
            right_column: 'name'
          }
        ]
      });

      // 'deployment' is unreachable from root 'animal' — orderMergeSteps throws, surfaced as an error.
      expect(errors.length).to.be.greaterThan(0);
    });

    it('throws for a root-reachable cycle (back-edge re-joining the root)', () => {
      // animal -> deployment -> animal: both left sides are reachable, so this is a
      // genuine cycle (not an orphan). It must surface as an ApiValidationError (400),
      // not slip through to the pipeline.
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment'],
        merge_steps: [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'deployment',
            right_column: 'parent_uuid'
          },
          {
            left_feature_type: 'deployment',
            left_column: 'device_id',
            right_feature_type: 'animal',
            right_column: 'name'
          }
        ]
      });

      expect(errors.some((error) => typeof error === 'string' && /cycle/.test(error))).to.be.true;
    });

    it('throws for a selected feature type the merge graph never reaches (island)', () => {
      // 'deployment' is materialized and selected but no merge step joins it, so it
      // never enters the single denormalized output — an island, not an orphan step.
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment']
      });

      expect(errors).to.have.lengthOf(1);
      expect(String(errors[0])).to.contain('deployment');
      expect(String(errors[0])).to.contain('not reachable');
    });

    it('does not add a reachability error when ordering already failed (cycle/orphan wins)', () => {
      // deployment -> animal leaves deployment an unreachable left side, so orderMergeSteps
      // throws and reachability is never evaluated — the orphan message must stand alone,
      // not be doubled up with an island error for the same type.
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment'],
        merge_steps: [
          {
            left_feature_type: 'deployment',
            left_column: 'uuid',
            right_feature_type: 'animal',
            right_column: 'parent_uuid'
          }
        ]
      });

      expect(errors).to.have.lengthOf(1);
      expect(errors.some((error) => String(error).includes('not reachable'))).to.be.false;
    });
  });

  describe('validateExportConfig — multi-type merge reachability', () => {
    // A three-type materialized fixture so chains and multiple islands can be exercised
    // without tripping the separate "not materialized" check.
    const columns = new Map<string, Set<string>>([
      ['animal', new Set(['submission_feature_id', 'uuid', 'parent_uuid', 'name'])],
      ['deployment', new Set(['submission_feature_id', 'uuid', 'parent_uuid', 'device_id'])],
      ['observation', new Set(['submission_feature_id', 'uuid', 'parent_uuid', 'count'])]
    ]);

    const invalidErrors = (raw: unknown): (string | object)[] => {
      let thrown: unknown;
      try {
        validateExportConfig(parse(raw), columns);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, 'expected validateExportConfig to throw').to.be.instanceOf(ApiValidationError);
      return (thrown as ApiValidationError).errors;
    };

    it('does not flag a type reached transitively through a non-root left side', () => {
      // observation joins off deployment, not the root, yet is still reachable — the
      // reachable set must accumulate every step's right side, not just the root's.
      expect(() =>
        validateExportConfig(
          parse({
            version: 1,
            export_type: 'csv',
            mode: 'denormalized',
            root_feature_type: 'animal',
            feature_types: ['animal', 'deployment', 'observation'],
            merge_steps: [
              {
                left_feature_type: 'animal',
                left_column: 'uuid',
                right_feature_type: 'deployment',
                right_column: 'parent_uuid'
              },
              {
                left_feature_type: 'deployment',
                left_column: 'uuid',
                right_feature_type: 'observation',
                right_column: 'parent_uuid'
              }
            ]
          }),
          columns
        )
      ).to.not.throw();
    });

    it('flags only the island when a valid chain leaves one type unjoined', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment', 'observation'],
        merge_steps: [
          {
            left_feature_type: 'animal',
            left_column: 'uuid',
            right_feature_type: 'deployment',
            right_column: 'parent_uuid'
          }
        ]
      });

      expect(errors).to.have.lengthOf(1);
      expect(String(errors[0])).to.contain('observation');
      expect(String(errors[0])).to.contain('not reachable');
    });

    it('accumulates a reachability error for every unjoined type', () => {
      const errors = invalidErrors({
        version: 1,
        export_type: 'csv',
        mode: 'denormalized',
        root_feature_type: 'animal',
        feature_types: ['animal', 'deployment', 'observation'],
        merge_steps: []
      });

      expect(errors).to.have.lengthOf(2);
      expect(errors.every((error) => String(error).includes('not reachable'))).to.be.true;
      expect(errors.map(String).join(' ')).to.contain('deployment');
      expect(errors.map(String).join(' ')).to.contain('observation');
    });
  });

  describe('coerceJoinKey', () => {
    it('coerces BigInt, number, and string forms of the same value consistently', () => {
      expect(coerceJoinKey(42n)).to.equal('42');
      expect(coerceJoinKey(42)).to.equal('42');
      expect(coerceJoinKey('42')).to.equal('42');
    });

    it('coerces a Date to ISO', () => {
      const date = new Date('2026-06-10T00:00:00.000Z');
      expect(coerceJoinKey(date)).to.equal('2026-06-10T00:00:00.000Z');
    });

    it('coerces null and undefined to the empty sentinel', () => {
      expect(coerceJoinKey(null)).to.equal('');
      expect(coerceJoinKey(undefined)).to.equal('');
    });

    it('coerces a Buffer to hex', () => {
      expect(coerceJoinKey(Buffer.from([0x01, 0xab]))).to.equal('01ab');
    });
  });

  describe('computeDimensionProjection', () => {
    it("includes the right_column, contributed output cols, and a downstream step's left_column", () => {
      const orderedSteps = [
        {
          left_feature_type: 'animal',
          left_column: 'uuid',
          right_feature_type: 'deployment',
          right_column: 'parent_uuid',
          merge_type: 'left' as const
        },
        {
          left_feature_type: 'deployment',
          left_column: 'device_id',
          right_feature_type: 'observation',
          right_column: 'device_ref',
          merge_type: 'left' as const
        }
      ];

      const projection = computeDimensionProjection('deployment', orderedSteps, [
        { feature_type: 'deployment', column: 'model' }
      ]);

      // right_column (joined onto), downstream left_column (chained merge), output col.
      expect([...projection].sort()).to.deep.equal(['device_id', 'model', 'parent_uuid']);
    });
  });

  describe('mergePrefixed', () => {
    it('prefixes right columns with the right feature type', () => {
      const merged = mergePrefixed({ uuid: 'a', name: 'wolf' }, { device_id: 'd1', uuid: 'b' }, 'deployment');

      expect(merged).to.deep.equal({
        uuid: 'a',
        name: 'wolf',
        deployment_device_id: 'd1',
        deployment_uuid: 'b'
      });
    });

    it('does not mutate the left row', () => {
      const left = { uuid: 'a' };
      mergePrefixed(left, { device_id: 'd1' }, 'deployment');
      expect(left).to.deep.equal({ uuid: 'a' });
    });
  });

  describe('joinRowTransform', () => {
    /**
     * Build a single-step `observation.parent_uuid -> animal.uuid` chain as a
     * typed `MergeStep[]` (all five fields incl. the defaulted `merge_type`).
     */
    const animalStep: MergeStep[] = [
      {
        left_feature_type: 'observation',
        left_column: 'parent_uuid',
        right_feature_type: 'animal',
        right_column: 'uuid',
        merge_type: 'left'
      }
    ];

    it('merges and prefixes the matched dimension row onto the root row (single match)', () => {
      // Verifies: a root row whose left key matches one dimension row yields exactly one
      // merged row carrying the root columns plus the prefixed `animal_*` columns.

      // Step 1: Build the dimension map bucketing the animal row under its uuid key 'p1'
      const dimMaps: DimensionMaps = new Map([['animal', new Map([['p1', [{ uuid: 'p1', species: 'wolf' }]]])]]);

      // Step 2: Broadcast the root row through the single-step chain
      const rows = [...joinRowTransform({ uuid: 'r1', parent_uuid: 'p1' }, 'observation', animalStep, dimMaps)];

      // Step 3: Exactly one merged row — root cols intact, right cols prefixed by feature type
      expect(rows).to.have.lengthOf(1);
      expect(rows[0]).to.deep.equal({
        uuid: 'r1',
        parent_uuid: 'p1',
        animal_uuid: 'p1',
        animal_species: 'wolf'
      });
    });

    it('keeps the root row unchanged when the dimension has no matching key (left join)', () => {
      // Verifies: left-join semantics — an unmatched root row survives as-is with no right columns,
      // never dropped.

      // Step 1: Dimension map has no bucket for the probe key 'p1'
      const dimMaps: DimensionMaps = new Map([['animal', new Map()]]);

      // Step 2: Broadcast the root row
      const rows = [...joinRowTransform({ uuid: 'r1', parent_uuid: 'p1' }, 'observation', animalStep, dimMaps)];

      // Step 3: One row, exactly the root, with no animal_* columns added
      expect(rows).to.have.lengthOf(1);
      expect(rows[0]).to.deep.equal({ uuid: 'r1', parent_uuid: 'p1' });
    });

    it('never matches a null left key, even against a null-keyed dimension bucket (SQL NULL != NULL)', () => {
      // Verifies: the load-bearing correctness case — coerceJoinKey(null) === '' and the transform
      // short-circuits on the empty probe key, skipping the dimension lookup entirely. A deliberately
      // present '' bucket proves the probe never reads it.

      // Step 1: Dimension map DELIBERATELY contains a '' bucket that would join if probed
      const dimMaps: DimensionMaps = new Map([['animal', new Map([['', [{ uuid: null, species: 'ghost' }]]])]]);

      // Step 2: Broadcast a root row whose left key is null
      const rows = [...joinRowTransform({ uuid: 'r1', parent_uuid: null }, 'observation', animalStep, dimMaps)];

      // Step 3: The empty-key probe is skipped — root kept unchanged, no spurious join to the '' bucket
      expect(rows).to.have.lengthOf(1);
      expect(rows[0]).to.deep.equal({ uuid: 'r1', parent_uuid: null });
    });

    it('fans out one row per matching dimension row', () => {
      // Verifies: a key matching N dimension rows produces N output rows, each carrying that
      // match's distinct prefixed values.

      // Step 1: Three animal rows share the join key 'p1'
      const dimMaps: DimensionMaps = new Map([
        [
          'animal',
          new Map([
            [
              'p1',
              [
                { uuid: 'p1', species: 'wolf' },
                { uuid: 'p1', species: 'bear' },
                { uuid: 'p1', species: 'fox' }
              ]
            ]
          ])
        ]
      ]);

      // Step 2: Broadcast the root row
      const rows = [...joinRowTransform({ uuid: 'r1', parent_uuid: 'p1' }, 'observation', animalStep, dimMaps)];

      // Step 3: Three output rows, one per match, each with its distinct species
      expect(rows).to.have.lengthOf(3);
      expect(rows.map((row) => row.animal_species)).to.deep.equal(['wolf', 'bear', 'fox']);
    });

    it('resolves a chained step left key at the prefixed name and cross-products the matches', () => {
      // Verifies: after step1 prefixes the animal columns, step2's left side
      // (animal.tag_id) resolves at the prefixed `animal_tag_id` — proving the
      // root-vs-prefixed left-key resolution. One animal fans into two tags.

      // Step 1: Order steps observation->animal then animal->tag; tag fans out to 2 rows
      const chainedSteps: MergeStep[] = [
        {
          left_feature_type: 'observation',
          left_column: 'parent_uuid',
          right_feature_type: 'animal',
          right_column: 'uuid',
          merge_type: 'left'
        },
        {
          left_feature_type: 'animal',
          left_column: 'tag_id',
          right_feature_type: 'tag',
          right_column: 'tag_id',
          merge_type: 'left'
        }
      ];
      const dimMaps: DimensionMaps = new Map<string, Map<string, Record<string, unknown>[]>>([
        ['animal', new Map([['p1', [{ uuid: 'p1', tag_id: 't1' }]]])],
        [
          'tag',
          new Map([
            [
              't1',
              [
                { tag_id: 't1', color: 'red' },
                { tag_id: 't1', color: 'blue' }
              ]
            ]
          ])
        ]
      ]);

      // Step 2: Broadcast through both steps
      const rows = [...joinRowTransform({ uuid: 'r1', parent_uuid: 'p1' }, 'observation', chainedSteps, dimMaps)];

      // Step 3: 1 animal x 2 tags = 2 rows; each carries the prefixed animal key and distinct tag color
      expect(rows).to.have.lengthOf(2);
      expect(rows.map((row) => row.animal_uuid)).to.deep.equal(['p1', 'p1']);
      expect(rows.map((row) => row.animal_tag_id)).to.deep.equal(['t1', 't1']);
      expect(rows.map((row) => row.tag_color)).to.deep.equal(['red', 'blue']);
    });

    it('throws when a single root row fans out past the cap', () => {
      // Verifies: the cumulative fan-out cap fails fast on a runaway root row instead of
      // producing an unbounded number of output rows.

      // Step 1: One key matches DOWNLOAD_EXPORT_FANOUT_MAX_ROWS + 1 dimension rows
      const matches = Array.from({ length: DOWNLOAD_EXPORT_FANOUT_MAX_ROWS + 1 }, (_, i) => ({
        uuid: 'p1',
        species: `s${i}`
      }));
      const dimMaps: DimensionMaps = new Map([['animal', new Map([['p1', matches]])]]);

      // Step 2: Draining the generator must throw, naming the fan-out cap
      expect(() => [
        ...joinRowTransform({ uuid: 'r1', parent_uuid: 'p1' }, 'observation', animalStep, dimMaps)
      ]).to.throw(/fan-out cap/);
    });

    it('passes the root row through unchanged when there are no steps (single-type identity)', () => {
      // Verifies: the zero-step degenerate case (single-type denormalized passthrough) yields the
      // root row verbatim with no transformation.

      // Step 1: No merge steps and an empty dimension map
      const rootRow = { uuid: 'r1', parent_uuid: 'p1', species: 'wolf' };

      // Step 2: Broadcast through the empty chain
      const rows = [...joinRowTransform(rootRow, 'observation', [], new Map())];

      // Step 3: Exactly the root row, unchanged
      expect(rows).to.have.lengthOf(1);
      expect(rows[0]).to.deep.equal({ uuid: 'r1', parent_uuid: 'p1', species: 'wolf' });
    });
  });

  describe('dedupeOutputColumnNames', () => {
    it('leaves already-unique names untouched (default-named columns keep output_column undefined)', () => {
      const input = [
        { feature_type: 'telemetry', column: 'uuid' },
        { feature_type: 'dataset', column: 'uuid' }
      ];

      // No collision (default names telemetry_uuid / dataset_uuid are distinct) → returned as-is.
      expect(dedupeOutputColumnNames(input)).to.deep.equal(input);
    });

    it('qualifies a cross-type collision of explicit names with the feature type (symmetric)', () => {
      // Two columns both explicitly named "id" — the corruption case. Both sides are
      // qualified with their feature type so the header is self-describing and no value is lost.
      const result = dedupeOutputColumnNames([
        { feature_type: 'telemetry', column: 'uuid', output_column: 'id' },
        { feature_type: 'dataset', column: 'uuid', output_column: 'id' }
      ]);

      // Source feature_type/column untouched; only the header name is qualified.
      expect(result).to.deep.equal([
        { feature_type: 'telemetry', column: 'uuid', output_column: 'telemetry_id' },
        { feature_type: 'dataset', column: 'uuid', output_column: 'dataset_id' }
      ]);
    });

    it('falls back to a numeric suffix for a SAME-type collision the feature prefix cannot separate', () => {
      // Two columns of the same type both named "id" → both qualify to telemetry_id → numeric backstop.
      const result = dedupeOutputColumnNames([
        { feature_type: 'telemetry', column: 'uuid', output_column: 'id' },
        { feature_type: 'telemetry', column: 'timestamp', output_column: 'id' }
      ]);

      expect(result.map((column) => column.output_column)).to.deep.equal(['telemetry_id', 'telemetry_id_2']);
    });

    it('does not steal a column that was already unique; the qualified name yields to it', () => {
      // "id" collides (telemetry/dataset) → telemetry's qualifies to "telemetry_id", but that name
      // is already taken by a third, non-colliding column — so the qualified one takes the suffix and
      // the un-collided column keeps its name.
      const result = dedupeOutputColumnNames([
        { feature_type: 'telemetry', column: 'uuid', output_column: 'id' },
        { feature_type: 'dataset', column: 'uuid', output_column: 'id' },
        { feature_type: 'x', column: 'y', output_column: 'telemetry_id' }
      ]);

      expect(result.map((column) => column.output_column)).to.deep.equal([
        'telemetry_id_2', // telemetry's "id" qualified, but "telemetry_id" was taken → suffixed
        'dataset_id',
        'telemetry_id' // pre-existing unique name preserved
      ]);
    });

    it('qualifies the explicit collider and leaves a colliding default name as the bare name', () => {
      // An explicit "dataset_uuid" on telemetry collides with dataset.uuid's default "dataset_uuid".
      const result = dedupeOutputColumnNames([
        { feature_type: 'telemetry', column: 'uuid', output_column: 'dataset_uuid' },
        { feature_type: 'dataset', column: 'uuid' } // default resolves to dataset_uuid → collision
      ]);

      // The explicit collider is feature-qualified; the default column (already feature-qualified)
      // keeps the bare name with output_column undefined.
      expect(result[0].output_column).to.equal('telemetry_dataset_uuid');
      expect(result[1]).to.deep.equal({ feature_type: 'dataset', column: 'uuid' });
    });
  });

  describe('buildOutputRecord', () => {
    it('filters, renames, and orders to the output columns', () => {
      // Root `animal` keeps its columns unprefixed (`name`); the `deployment`
      // dimension is read at its prefixed name (`deployment_device_id`).
      const joined = { name: 'wolf', deployment_device_id: 'd1', deployment_model: 'x' };
      const record = buildOutputRecord(
        joined,
        [
          { feature_type: 'deployment', column: 'device_id', output_column: 'device' },
          { feature_type: 'animal', column: 'name' }
        ],
        'animal'
      );

      expect(record).to.deep.equal({ device: 'd1', animal_name: 'wolf' });
      expect(Object.keys(record)).to.deep.equal(['device', 'animal_name']);
    });

    it('renders a missing value as an empty string', () => {
      const record = buildOutputRecord(
        { animal_name: 'wolf' },
        [{ feature_type: 'deployment', column: 'device_id' }],
        'animal'
      );

      expect(record).to.deep.equal({ deployment_device_id: '' });
    });

    it('keeps an unmatched dimension column empty even when it collides with a root column name', () => {
      // Root `dataset` carries the structural `uuid` unprefixed; the `capture`
      // dimension had no match, so `capture_uuid` is absent on the joined row. It
      // must render empty — never fall back to the root's `uuid` (the bug the
      // chained-merge integration test surfaced).
      const record = buildOutputRecord(
        { uuid: 'ds-1', name: 'Dataset One' },
        [
          { feature_type: 'dataset', column: 'name' },
          { feature_type: 'capture', column: 'uuid' }
        ],
        'dataset'
      );

      expect(record).to.deep.equal({ dataset_name: 'Dataset One', capture_uuid: '' });
    });

    it('emits all columns when output_columns is omitted', () => {
      const record = buildOutputRecord({ uuid: 'a', deployment_device_id: 'd1', count: 5 }, undefined, 'animal');

      expect(record).to.deep.equal({ uuid: 'a', deployment_device_id: 'd1', count: '5' });
    });
  });
});
