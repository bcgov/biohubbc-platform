import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { SubmissionFeaturePropertyTaxon } from '../models/submission-feature-property-taxon';
import { SubmissionFeaturePropertyTaxonRepository } from './submission-feature-property-taxon-repository';

describe('SubmissionFeaturePropertyTaxonRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyTaxon = {
    submission_feature_property_taxon_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    taxon_id: 1234
  };

  describe('insert', () => {
    it('returns inserted row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyTaxonRepository(mockDBConnection);

      const result = await repository.insertSubmissionFeaturePropertyTaxon({
        submission_feature_id: 10,
        feature_type_property_id: 20,
        taxon_id: 1234
      });

      expect(result).to.eql(mockRow);
    });

    it('throws on failed insert', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyTaxonRepository(mockDBConnection);

      try {
        await repository.insertSubmissionFeaturePropertyTaxon({
          submission_feature_id: 10,
          feature_type_property_id: 20,
          taxon_id: 1234
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('getById', () => {
    it('returns row', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyTaxonRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyTaxonById(1);
      expect(result).to.eql(mockRow);
    });

    it('throws not found', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([])) });
      const repository = new SubmissionFeaturePropertyTaxonRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyTaxonById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });

    it('throws on unexpected row count', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow], 2)) });
      const repository = new SubmissionFeaturePropertyTaxonRepository(mockDBConnection);

      try {
        await repository.getSubmissionFeaturePropertyTaxonById(1);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });

  describe('lookups', () => {
    it('lists by submission_feature_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyTaxonRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyTaxonBySubmissionFeatureId(10);
      expect(result).to.eql([mockRow]);
    });

    it('lists by feature_type_property_id', async () => {
      const mockDBConnection = getMockDBConnection({ knex: () => Promise.resolve(mockQueryResult([mockRow])) });
      const repository = new SubmissionFeaturePropertyTaxonRepository(mockDBConnection);
      const result = await repository.getSubmissionFeaturePropertyTaxonByFeatureTypePropertyId(20);
      expect(result).to.eql([mockRow]);
    });
  });
});
