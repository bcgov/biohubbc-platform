import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ExportConfig, MergeStep } from './download-export-config';

describe('download-export-config model', () => {
  describe('MergeStep', () => {
    it('defaults merge_type to left when omitted', () => {
      const parsed = MergeStep.parse({
        left_feature_type: 'animal',
        left_column: 'uuid',
        right_feature_type: 'deployment',
        right_column: 'parent_uuid'
      });

      expect(parsed.merge_type).to.equal('left');
    });

    it('rejects an unsupported merge_type', () => {
      const result = MergeStep.safeParse({
        left_feature_type: 'animal',
        left_column: 'uuid',
        right_feature_type: 'deployment',
        right_column: 'parent_uuid',
        merge_type: 'inner'
      });

      expect(result.success).to.be.false;
    });
  });

  describe('ExportConfig', () => {
    it('parses a valid per_feature_type config', () => {
      const result = ExportConfig.safeParse({
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['animal', 'deployment']
      });

      expect(result.success).to.be.true;
    });

    it('parses a valid denormalized config', () => {
      const result = ExportConfig.safeParse({
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
      });

      expect(result.success).to.be.true;
    });

    it('defaults merge_steps to an empty array', () => {
      const parsed = ExportConfig.parse({
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['animal']
      });

      expect(parsed.merge_steps).to.deep.equal([]);
    });

    it('rejects an empty feature_types array', () => {
      const result = ExportConfig.safeParse({
        version: 1,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: []
      });

      expect(result.success).to.be.false;
    });

    // Mode-dependent structural rules (per_feature_type vs merge_steps, denormalized
    // root requirements) are no longer enforced by the schema — they moved to
    // validateExportConfig, which throws ApiValidationError. See export-config-utils.test.ts.

    it('rejects a version other than 1', () => {
      const result = ExportConfig.safeParse({
        version: 2,
        export_type: 'csv',
        mode: 'per_feature_type',
        feature_types: ['animal']
      });

      expect(result.success).to.be.false;
    });
  });
});
