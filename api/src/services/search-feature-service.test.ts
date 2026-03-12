import chai, { expect } from 'chai';
import dayjs from 'dayjs';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { CodeService } from './code-service';
import { SearchFeatureService } from './search-feature-service';
import { SearchFeatureResultWithRelevancy } from './search-feature-service.interface';

chai.use(sinonChai);

describe('SearchFeatureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('indexFeaturesBySubmissionId', () => {
    it('should correctly index a submission with multiple feature types', async () => {
      const mockDBConnection = getMockDBConnection();

      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'deleteSearchRecordsBySubmissionId').resolves();

      const getSubmissionFeaturesStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId')
        .resolves([
          {
            submission_feature_id: 11111,
            submission_id: 777,
            feature_type_id: 1,
            urn: 'urn:777:dataset:11111',
            data: {
              name: 'Dataset1',
              description: 'Desc1'
            },
            source_id: '123',
            uuid: '123-456-789',
            parent_submission_feature_id: null,
            record_effective_date: '2024-01-01',
            record_end_date: null,
            create_date: '2024-01-01',
            create_user: 1,
            update_date: null,
            update_user: null,
            revision_count: 0,
            feature_type_name: 'dataset',
            feature_type_display_name: 'Dataset',
            submission_feature_security_ids: []
          },
          {
            submission_feature_id: 22222,
            submission_id: 777,
            urn: 'urn:777:dataset:22222',
            feature_type_id: 2,
            data: {
              count: 70,
              start_date: '2001-01-01',
              end_date: null,
              latitude: 49,
              longitude: -127,
              geometry: { type: 'Point', coordinates: [-127, 49] }
            },
            source_id: '456',
            uuid: '234-456-678',
            parent_submission_feature_id: 11111,
            record_effective_date: '2024-01-01',
            record_end_date: null,
            create_date: '2024-01-01',
            create_user: 1,
            update_date: null,
            update_user: null,
            revision_count: 0,
            feature_type_name: 'observation',
            feature_type_display_name: 'Observation',
            submission_feature_security_ids: []
          },
          {
            submission_feature_id: 33333,
            submission_id: 777,
            urn: 'urn:777:dataset:33333',
            feature_type_id: 3,
            data: {
              filename: 'myText.txt',
              description: 'Desc2'
            },
            source_id: '789',
            uuid: '456-567-567',
            parent_submission_feature_id: 11111,
            record_effective_date: '2024-01-01',
            record_end_date: null,
            create_date: '2024-01-01',
            create_user: 1,
            update_date: null,
            update_user: null,
            revision_count: 0,
            feature_type_name: 'artifact',
            feature_type_display_name: 'Artifact',
            submission_feature_security_ids: []
          }
        ]);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves([
        {
          feature_type: {
            feature_type_id: 1,
            feature_type_name: 'dataset',
            feature_type_display_name: 'Dataset'
          },
          feature_type_properties: [
            {
              feature_property_id: 1,
              feature_property_name: 'name',
              feature_property_display_name: 'Name',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            },
            {
              feature_property_id: 2,
              feature_property_name: 'description',
              feature_property_display_name: 'Description',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            }
          ]
        },
        {
          feature_type: {
            feature_type_id: 2,
            feature_type_name: 'observation',
            feature_type_display_name: 'Observation'
          },
          feature_type_properties: [
            {
              feature_property_id: 3,
              feature_property_name: 'count',
              feature_property_display_name: 'Count',
              feature_property_type_id: 2,
              feature_property_type_name: 'number'
            },
            {
              feature_property_id: 4,
              feature_property_name: 'date_range',
              feature_property_display_name: 'Date Range',
              feature_property_type_id: 3,
              feature_property_type_name: 'object'
            },
            {
              feature_property_id: 5,
              feature_property_name: 'start_date',
              feature_property_display_name: 'Start Date',
              feature_property_type_id: 4,
              feature_property_type_name: 'datetime'
            },
            {
              feature_property_id: 6,
              feature_property_name: 'end_date',
              feature_property_display_name: 'End Date',
              feature_property_type_id: 4,
              feature_property_type_name: 'datetime'
            },
            {
              feature_property_id: 7,
              feature_property_name: 'latitude',
              feature_property_display_name: 'Latitude',
              feature_property_type_id: 2,
              feature_property_type_name: 'number'
            },
            {
              feature_property_id: 8,
              feature_property_name: 'longitude',
              feature_property_display_name: 'Longitude',
              feature_property_type_id: 2,
              feature_property_type_name: 'number'
            },
            {
              feature_property_id: 9,
              feature_property_name: 'geometry',
              feature_property_display_name: 'Geometry',
              feature_property_type_id: 5,
              feature_property_type_name: 'spatial'
            }
          ]
        },
        {
          feature_type: {
            feature_type_id: 3,
            feature_type_name: 'artifact',
            feature_type_display_name: 'Artifact'
          },
          feature_type_properties: [
            {
              feature_property_id: 10,
              feature_property_name: 'filename',
              feature_property_display_name: 'Filename',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            },
            {
              feature_property_id: 2,
              feature_property_name: 'description',
              feature_property_display_name: 'Description',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            }
          ]
        }
      ]);

      const insertSearchableStringStub = sinon.stub(SearchFeatureRepository.prototype, 'insertSearchableStringRecords');

      const insertSearchableDatetimeStub = sinon.stub(
        SearchFeatureRepository.prototype,
        'insertSearchableDatetimeRecords'
      );

      const insertSearchableSpatialStub = sinon.stub(
        SearchFeatureRepository.prototype,
        'insertSearchableSpatialRecords'
      );

      const insertSearchableNumberStub = sinon.stub(SearchFeatureRepository.prototype, 'insertSearchableNumberRecords');

      await searchFeatureService.indexFeaturesBySubmissionId(777);

      expect(getSubmissionFeaturesStub).to.be.calledOnceWith(777);

      expect(insertSearchableStringStub).to.be.calledOnceWith([
        {
          submission_feature_id: 11111,
          feature_property_id: 1,
          value: 'Dataset1'
        },
        {
          submission_feature_id: 11111,
          feature_property_id: 2,
          value: 'Desc1'
        },
        {
          submission_feature_id: 33333,
          feature_property_id: 10,
          value: 'myText.txt'
        },
        {
          submission_feature_id: 33333,
          feature_property_id: 2,
          value: 'Desc2'
        }
      ]);

      expect(insertSearchableDatetimeStub).to.be.calledOnceWith([
        {
          submission_feature_id: 22222,
          feature_property_id: 5,
          value: '2001-01-01'
        }
      ]);

      expect(insertSearchableSpatialStub).to.be.calledOnceWith([
        {
          submission_feature_id: 22222,
          feature_property_id: 9,
          value: { type: 'Point', coordinates: [-127, 49] }
        }
      ]);

      expect(insertSearchableNumberStub).to.be.calledOnceWith([
        {
          submission_feature_id: 22222,
          feature_property_id: 3,
          value: 70
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 7,
          value: 49
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 8,
          value: -127
        }
      ]);
    });

    it('should skip features with no applicable feature type properties', async () => {
      const mockDBConnection = getMockDBConnection();

      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'deleteSearchRecordsBySubmissionId').resolves();

      sinon.stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId').resolves([
        {
          submission_feature_id: 11111,
          submission_id: 777,
          feature_type_id: 99,
          urn: 'urn:777:unknown:11111',
          data: { name: 'Unknown' },
          source_id: '123',
          uuid: '123-456-789',
          parent_submission_feature_id: null,
          record_effective_date: '2024-01-01',
          record_end_date: null,
          create_date: '2024-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'unknown',
          feature_type_display_name: 'Unknown',
          submission_feature_security_ids: []
        }
      ]);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves([]);

      const insertSearchableStringStub = sinon.stub(SearchFeatureRepository.prototype, 'insertSearchableStringRecords');

      await searchFeatureService.indexFeaturesBySubmissionId(777);

      expect(insertSearchableStringStub).not.to.be.called;
    });

    it('should skip null or empty property values', async () => {
      const mockDBConnection = getMockDBConnection();

      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'deleteSearchRecordsBySubmissionId').resolves();

      sinon.stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId').resolves([
        {
          submission_feature_id: 11111,
          submission_id: 777,
          feature_type_id: 1,
          urn: 'urn:777:dataset:11111',
          data: {
            name: 'Dataset1',
            description: null,
            emptyString: ''
          },
          source_id: '123',
          uuid: '123-456-789',
          parent_submission_feature_id: null,
          record_effective_date: '2024-01-01',
          record_end_date: null,
          create_date: '2024-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'dataset',
          feature_type_display_name: 'Dataset',
          submission_feature_security_ids: []
        }
      ]);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves([
        {
          feature_type: {
            feature_type_id: 1,
            feature_type_name: 'dataset',
            feature_type_display_name: 'Dataset'
          },
          feature_type_properties: [
            {
              feature_property_id: 1,
              feature_property_name: 'name',
              feature_property_display_name: 'Name',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            },
            {
              feature_property_id: 2,
              feature_property_name: 'description',
              feature_property_display_name: 'Description',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            }
          ]
        }
      ]);

      const insertSearchableStringStub = sinon.stub(SearchFeatureRepository.prototype, 'insertSearchableStringRecords');

      await searchFeatureService.indexFeaturesBySubmissionId(777);

      expect(insertSearchableStringStub).to.be.calledOnceWith([
        {
          submission_feature_id: 11111,
          feature_property_id: 1,
          value: 'Dataset1'
        }
      ]);
    });

    it('should call delete before insert for idempotency', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const deleteStub = sinon.stub(SearchFeatureRepository.prototype, 'deleteSearchRecordsBySubmissionId').resolves();

      sinon.stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId').resolves([
        {
          submission_feature_id: 11111,
          submission_id: 777,
          feature_type_id: 1,
          urn: 'urn:777:dataset:11111',
          data: { name: 'Dataset1' },
          source_id: '123',
          uuid: '123-456-789',
          parent_submission_feature_id: null,
          record_effective_date: '2024-01-01',
          record_end_date: null,
          create_date: '2024-01-01',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          feature_type_name: 'dataset',
          feature_type_display_name: 'Dataset',
          submission_feature_security_ids: []
        }
      ]);

      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves([
        {
          feature_type: { feature_type_id: 1, feature_type_name: 'dataset', feature_type_display_name: 'Dataset' },
          feature_type_properties: [
            {
              feature_property_id: 1,
              feature_property_name: 'name',
              feature_property_display_name: 'Name',
              feature_property_type_id: 1,
              feature_property_type_name: 'string'
            }
          ]
        }
      ]);

      const insertStub = sinon.stub(SearchFeatureRepository.prototype, 'insertSearchableStringRecords');

      await searchFeatureService.indexFeaturesBySubmissionId(777);

      expect(deleteStub).to.have.been.calledOnceWith(777);
      expect(deleteStub).to.have.been.calledBefore(insertStub);
    });

    it('should call delete even when no features exist for the submission', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const deleteStub = sinon.stub(SearchFeatureRepository.prototype, 'deleteSearchRecordsBySubmissionId').resolves();

      sinon.stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId').resolves([]);
      sinon.stub(CodeService.prototype, 'getFeatureTypePropertyCodes').resolves([]);

      const insertStub = sinon.stub(SearchFeatureRepository.prototype, 'insertSearchableStringRecords');

      await searchFeatureService.indexFeaturesBySubmissionId(777);

      expect(deleteStub).to.have.been.calledOnceWith(777);
      expect(insertStub).not.to.have.been.called;
    });
  });

  describe('searchFeatures', () => {
    it('should return features matching keyword search', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Study',
          feature_description: 'A study of moose',
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 0.5,
          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({ keyword: 'moose' });

      expect(result).to.have.lengthOf(1);
      expect(result[0].submission_feature_id).to.equal(1);
    });

    it('should return features filtered by feature type', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Data',
          feature_description: 'Moose dataset',
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 1.0,
          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({ feature_types: ['dataset'] });

      expect(result).to.have.lengthOf(1);
      expect(result[0].feature_type_name).to.equal('dataset');
    });

    it('should return features filtered by species', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 2,
          feature_type_name: 'observation',
          feature_name: 'Moose Sighting',
          feature_description: null,
          submission_name: 'Wildlife Project',
          is_secured: false,
          relevancy_score: 1.0,

          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({ species: ['Alces alces'] });

      expect(result).to.have.lengthOf(1);
      expect(result[0].submission_feature_id).to.equal(1);
    });

    it('should return features filtered by property conditions', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Data',
          feature_description: null,
          submission_name: 'Project',
          is_secured: false,
          relevancy_score: 1.0,

          create_date: dayjs().toISOString()
        }
      ];

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      const result = await searchFeatureService.searchFeatures({
        properties: [
          {
            operand: 'and',
            conditions: [
              {
                name: 'count',
                operator: 'gt',
                value: '10'
              }
            ]
          }
        ]
      });

      expect(result).to.have.lengthOf(1);
    });

    it('should apply pagination to search results', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const mockResults: SearchFeatureResultWithRelevancy[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Data 1',
          feature_description: null,
          submission_name: 'Project',
          is_secured: false,
          relevancy_score: 1.0,

          create_date: dayjs().toISOString()
        }
      ];

      const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves(mockResults);

      await searchFeatureService.searchFeatures({ keyword: 'data' }, { page: 1, limit: 10 });

      expect(searchStub).to.be.calledOnceWith({ keyword: 'data' }, { page: 1, limit: 10 }, undefined);
    });

    it('should forward systemUserId to repository when provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves([]);

      await searchFeatureService.searchFeatures({ keyword: 'moose' }, undefined, 42);

      expect(searchStub).to.be.calledOnceWith({ keyword: 'moose' }, undefined, 42);
    });

    it('should forward null systemUserId to repository for anonymous searches', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const searchStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves([]);

      await searchFeatureService.searchFeatures({ keyword: 'moose' }, undefined, null);

      expect(searchStub).to.be.calledOnceWith({ keyword: 'moose' }, undefined, null);
    });

    it('should return empty array for no matches', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFilters').resolves([]);

      const result = await searchFeatureService.searchFeatures({ keyword: 'nonexistent' });

      expect(result).to.eql([]);
    });

    it('should return empty array with empty filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const result = await searchFeatureService.searchFeatures({});

      expect(result).to.eql([]);
    });
  });

  describe('getSearchFeaturesCount', () => {
    it('should return count for keyword search', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(5);

      const result = await searchFeatureService.getSearchFeaturesCount({ keyword: 'moose' });

      expect(result).to.equal(5);
    });

    it('should return count for feature type filter', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(3);

      const result = await searchFeatureService.getSearchFeaturesCount({ feature_types: ['dataset'] });

      expect(result).to.equal(3);
    });

    it('should return count for property filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(2);

      const result = await searchFeatureService.getSearchFeaturesCount({
        properties: [
          {
            operand: 'and',
            conditions: [
              {
                name: 'status',
                operator: 'eq',
                value: 'active'
              }
            ]
          }
        ]
      });

      expect(result).to.equal(2);
    });

    it('should return zero when no matches found', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(0);

      const result = await searchFeatureService.getSearchFeaturesCount({ keyword: 'nonexistent' });

      expect(result).to.equal(0);
    });

    it('should forward systemUserId to repository when provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const countStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(5);

      await searchFeatureService.getSearchFeaturesCount({ keyword: 'moose' }, 42);

      expect(countStub).to.be.calledOnceWith({ keyword: 'moose' }, 42);
    });

    it('should forward null systemUserId to repository for anonymous searches', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchFeatureService = new SearchFeatureService(mockDBConnection);

      const countStub = sinon.stub(SearchFeatureRepository.prototype, 'searchFeaturesByFiltersCount').resolves(3);

      await searchFeatureService.getSearchFeaturesCount({ keyword: 'moose' }, null);

      expect(countStub).to.be.calledOnceWith({ keyword: 'moose' }, null);
    });
  });
});
