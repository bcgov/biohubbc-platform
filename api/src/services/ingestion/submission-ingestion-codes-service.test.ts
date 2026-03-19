import { expect } from 'chai';
import { describe } from 'mocha';
import { IFlattenedBlock } from '../../models/submission-feature';
import { SubmissionIngestionCodesService } from './submission-ingestion-codes-service';

describe('SubmissionIngestionCodesService', () => {
  describe('getUniqueCodeReferencesFromBlocks', () => {
    it('returns unique parsed code references from string and array values', () => {
      const service = new SubmissionIngestionCodesService();
      const blocks: IFlattenedBlock[] = [
        {
          id: 'feature-1',
          type: 'dataset',
          properties: {
            agency: 'code::agency::aarde',
            tags: ['code::agency::aarde', 'code::agency::bevr']
          },
          content: [],
          parent: null
        }
      ];

      const result = service.getUniqueCodeReferencesFromBlocks(blocks);
      const slugs = result.map((reference) => reference.slug).sort();

      expect(slugs).to.eql(['code::agency::aarde', 'code::agency::bevr']);
    });

    it('ignores non-string and malformed values', () => {
      const service = new SubmissionIngestionCodesService();
      const blocks: IFlattenedBlock[] = [
        {
          id: 'feature-1',
          type: 'dataset',
          properties: {
            count: 5,
            nested: { key: 'value' },
            invalidCode: 'code::missing-part',
            mixed: ['code::agency::aarde', true, 7]
          },
          content: [],
          parent: null
        }
      ];

      const result = service.getUniqueCodeReferencesFromBlocks(blocks);

      expect(result).to.have.lengthOf(1);
      expect(result[0].slug).to.equal('code::agency::aarde');
    });
  });
});
