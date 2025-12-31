import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SearchFeatureResult, SearchIndexRepository } from '../repositories/search-index-respository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { CodeService } from './code-service';
import { SearchIndexService } from './search-index-service';

chai.use(sinonChai);

describe('SearchIndexService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('indexFeaturesBySubmissionId', () => {
    it('should correctly index a submission', async () => {
      const mockDBConnection = getMockDBConnection();

      const searchIndexService = new SearchIndexService(mockDBConnection);

      const getSubmissionFeaturesStub = sinon
        .stub(SubmissionRepository.prototype, 'getSubmissionFeaturesBySubmissionId')
        .resolves([
          {
            submission_feature_id: 11111,
            submission_id: 777,
            feature_type_id: 1,
            urn: `urn:777:dataset:11111`,
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
            urn: `urn:777:dataset:22222`,
            feature_type_id: 2,
            data: {
              count: 70,
              start_date: new Date('2001-01-01'),
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
            urn: `urn:777:dataset:33333`,
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

      const insertSearchableStringStub = sinon.stub(SearchIndexRepository.prototype, 'insertSearchableStringRecords');

      const insertSearchableDatetimeStub = sinon.stub(
        SearchIndexRepository.prototype,
        'insertSearchableDatetimeRecords'
      );

      const insertSearchableSpatialStub = sinon.stub(SearchIndexRepository.prototype, 'insertSearchableSpatialRecords');

      const insertSearchableNumberStub = sinon.stub(SearchIndexRepository.prototype, 'insertSearchableNumberRecords');

      // Act
      await searchIndexService.indexFeaturesBySubmissionId(777);

      // Assert
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
          value: new Date('2001-01-01')
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
  });

  describe('searchFeatures', () => {
    it('should split keywords by whitespace and search', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const mockResults: SearchFeatureResult[] = [
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
          relevancy_score: 0.5
        }
      ];

      const searchByKeywordsStub = sinon
        .stub(SearchIndexRepository.prototype, 'searchFeaturesByKeywords')
        .resolves(mockResults);

      const result = await searchIndexService.searchFeatures({ keywords: 'moose habitat' });

      expect(searchByKeywordsStub).to.be.calledOnceWith(['moose', 'habitat']);
      expect(result).to.have.lengthOf(1);
      expect(result[0].submission_feature_id).to.equal(1);
    });

    it('should handle extra whitespace in keywords', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const searchByKeywordsStub = sinon.stub(SearchIndexRepository.prototype, 'searchFeaturesByKeywords').resolves([]);

      await searchIndexService.searchFeatures({ keywords: '  moose   habitat  ' });

      expect(searchByKeywordsStub).to.be.calledOnceWith(['moose', 'habitat']);
    });

    it('should search by property filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const mockResults: SearchFeatureResult[] = [
        {
          submission_feature_id: 2,
          submission_id: 11,
          uuid: '550e8400-e29b-41d4-a716-446655440002',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Moose Survey',
          feature_description: 'Survey data',
          submission_name: 'Wildlife Survey',
          is_secured: true,
          relevancy_score: 0.6
        }
      ];

      const searchByFiltersStub = sinon
        .stub(SearchIndexRepository.prototype, 'searchFeaturesByPropertyFilters')
        .resolves(mockResults);

      const result = await searchIndexService.searchFeatures({
        propertyFilters: [{ featureTypeName: 'animal', propertyName: 'name', propertyType: 'string', value: 'moose' }]
      });

      expect(searchByFiltersStub).to.be.calledOnceWith([
        { featureTypeName: 'animal', propertyName: 'name', propertyType: 'string', value: 'moose' }
      ]);
      expect(result).to.have.lengthOf(1);
      expect(result[0].submission_feature_id).to.equal(2);
    });

    it('should aggregate results from keywords and filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const keywordResults: SearchFeatureResult[] = [
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
          relevancy_score: 0.5
        }
      ];

      const filterResults: SearchFeatureResult[] = [
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
          relevancy_score: 0.3
        }
      ];

      sinon.stub(SearchIndexRepository.prototype, 'searchFeaturesByKeywords').resolves(keywordResults);
      sinon.stub(SearchIndexRepository.prototype, 'searchFeaturesByPropertyFilters').resolves(filterResults);

      const result = await searchIndexService.searchFeatures({
        keywords: 'moose',
        propertyFilters: [{ featureTypeName: 'animal', propertyName: 'name', propertyType: 'string', value: 'moose' }]
      });

      expect(result).to.have.lengthOf(1);
      // Relevancy scores should be aggregated (0.5 + 0.3 = 0.8)
      expect(result[0].relevancy_score).to.equal(0.8);
    });

    it('should return empty array when no search criteria provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const result = await searchIndexService.searchFeatures({});

      expect(result).to.eql([]);
    });

    it('should return empty array for empty keywords string', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const result = await searchIndexService.searchFeatures({ keywords: '   ' });

      expect(result).to.eql([]);
    });

    it('should filter out invalid property filters', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const searchByFiltersStub = sinon
        .stub(SearchIndexRepository.prototype, 'searchFeaturesByPropertyFilters')
        .resolves([]);

      await searchIndexService.searchFeatures({
        propertyFilters: [
          { featureTypeName: 'animal', propertyName: 'name', propertyType: 'string', value: 'moose' },
          { featureTypeName: 'animal', propertyName: '', propertyType: 'string', value: 'invalid' },
          { featureTypeName: 'animal', propertyName: 'desc', propertyType: 'string', value: '' }
        ]
      });

      // Only the valid filter should be passed
      expect(searchByFiltersStub).to.be.calledOnceWith([
        { featureTypeName: 'animal', propertyName: 'name', propertyType: 'string', value: 'moose' }
      ]);
    });

    it('should sort results by relevancy score descending', async () => {
      const mockDBConnection = getMockDBConnection();
      const searchIndexService = new SearchIndexService(mockDBConnection);

      const mockResults: SearchFeatureResult[] = [
        {
          submission_feature_id: 1,
          submission_id: 10,
          uuid: '550e8400-e29b-41d4-a716-446655440001',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Study A',
          feature_description: 'Description A',
          submission_name: 'Project A',
          is_secured: false,
          relevancy_score: 0.3
        },
        {
          submission_feature_id: 2,
          submission_id: 11,
          uuid: '550e8400-e29b-41d4-a716-446655440002',
          feature_type_id: 1,
          feature_type_name: 'dataset',
          feature_name: 'Study B',
          feature_description: 'Description B',
          submission_name: 'Project B',
          is_secured: true,
          relevancy_score: 0.8
        }
      ];

      sinon.stub(SearchIndexRepository.prototype, 'searchFeaturesByKeywords').resolves(mockResults);

      const result = await searchIndexService.searchFeatures({ keywords: 'moose' });

      expect(result[0].submission_feature_id).to.equal(2);
      expect(result[1].submission_feature_id).to.equal(1);
    });
  });
});
