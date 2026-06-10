import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ApiValidationError } from '../errors/api-error';
import { ExportConfig } from '../models/download-export-config';
import {
  buildOutputRecord,
  canonicalizeExportConfig,
  coerceJoinKey,
  computeConfigHash,
  computeDimensionProjection,
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
      ).to.throw();
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
      ).to.throw();
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

  describe('buildOutputRecord', () => {
    it('filters, renames, and orders to the output columns', () => {
      const joined = { name: 'wolf', deployment_device_id: 'd1', deployment_model: 'x' };
      const record = buildOutputRecord(joined, [
        { feature_type: 'deployment', column: 'device_id', output_column: 'device' },
        { feature_type: 'animal', column: 'name' }
      ]);

      expect(record).to.deep.equal({ device: 'd1', animal_name: 'wolf' });
      expect(Object.keys(record)).to.deep.equal(['device', 'animal_name']);
    });

    it('renders a missing value as an empty string', () => {
      const record = buildOutputRecord({ animal_name: 'wolf' }, [{ feature_type: 'deployment', column: 'device_id' }]);

      expect(record).to.deep.equal({ deployment_device_id: '' });
    });

    it('emits all columns when output_columns is omitted', () => {
      const record = buildOutputRecord({ uuid: 'a', deployment_device_id: 'd1', count: 5 }, undefined);

      expect(record).to.deep.equal({ uuid: 'a', deployment_device_id: 'd1', count: '5' });
    });
  });
});
