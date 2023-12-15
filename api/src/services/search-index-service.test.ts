import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SearchIndexRepository } from '../repositories/search-index-respository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getMockDBConnection } from '../__mocks__/db';
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
            submission_id: 1, // Mock submission
            feature_type_id: 1, // dataset, observation, etc.
            data: {
              id: 100,
              type: 'some_random_thing',
              properties: {
                name: 'Ardvark',
                description: 'Desc1',
                taxonomy: 1001,
                start_date: new Date('2000-01-01'),
                geometry: { type: 'Point', coordinates: [11, 11] },
                count: 60,
                latitude: 11,
                longitude: 11
              }
            },
            parent_submission_feature_id: null,
            record_effective_date: '',
            record_end_date: null,
            create_date: '',
            create_user: 1,
            update_date: null,
            update_user: null,
            revision_count: 1,
            feature_type_name: '',
            feature_type_display_name: '',
            submission_feature_security_ids: []
          },
          {
            submission_feature_id: 22222,
            submission_id: 1, // Mock submission
            feature_type_id: 1, // dataset, observation, etc.
            data: {
              id: 200,
              type: 'another_random_thing',
              properties: {
                name: 'Buffalo',
                description: 'Desc2',
                taxonomy: 1002,
                start_date: new Date('2001-01-01'),
                geometry: { type: 'Point', coordinates: [22, 22] },
                count: 70,
                latitude: 22,
                longitude: 22
              }
            },
            parent_submission_feature_id: null,
            record_effective_date: '',
            record_end_date: null,
            create_date: '',
            create_user: 1,
            update_date: null,
            update_user: null,
            revision_count: 1,
            feature_type_name: '',
            feature_type_display_name: '',
            submission_feature_security_ids: []
          }
        ]);

      const insertSearchableStringStub = sinon.stub(SearchIndexRepository.prototype, 'insertSearchableStringRecords');

      const insertSearchableDatetimeStub = sinon.stub(
        SearchIndexRepository.prototype,
        'insertSearchableDatetimeRecords'
      );

      const insertSearchableSpatialStub = sinon.stub(SearchIndexRepository.prototype, 'insertSearchableSpatialRecords');

      const insertSearchableNumberStub = sinon.stub(SearchIndexRepository.prototype, 'insertSearchableNumberRecords');

      sinon.stub(SearchIndexRepository.prototype, 'getFeaturePropertiesWithTypeNames').resolves([
        {
          feature_property_type_name: 'number',
          feature_property_id: 8,
          feature_property_type_id: 2,
          name: 'count',
          display_name: 'Count',
          description: 'The count of the record',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'object',
          feature_property_id: 4,
          feature_property_type_id: 6,
          name: 'date_range',
          display_name: 'Date Range',
          description: 'A date range',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 2,
          feature_property_type_id: 1,
          name: 'description',
          display_name: 'Description',
          description: 'The description of the record',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'datetime',
          feature_property_id: 6,
          feature_property_type_id: 3,
          name: 'end_date',
          display_name: 'End Date',
          description: 'The end date of the record',
          parent_feature_property_id: 4,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'spatial',
          feature_property_id: 7,
          feature_property_type_id: 4,
          name: 'geometry',
          display_name: 'Geometry',
          description: 'The location of the record',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 9,
          feature_property_type_id: 2,
          name: 'latitude',
          display_name: 'Latitude',
          description: 'The latitude of the record',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 10,
          feature_property_type_id: 2,
          name: 'longitude',
          display_name: 'Longitude',
          description: 'The longitude of the record',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 1,
          feature_property_type_id: 1,
          name: 'name',
          display_name: 'Name',
          description: 'The name of the record',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'string',
          feature_property_id: 21,
          feature_property_type_id: 1,
          name: 's3_key',
          display_name: 'Key',
          description: 'The S3 storage key for an artifact',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 15:40:29.486362-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'datetime',
          feature_property_id: 5,
          feature_property_type_id: 3,
          name: 'start_date',
          display_name: 'Start Date',
          description: 'The start date of the record',
          parent_feature_property_id: 4,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          feature_property_type_name: 'number',
          feature_property_id: 3,
          feature_property_type_id: 2,
          name: 'taxonomy',
          display_name: 'Taxonomy Id',
          description: 'The taxonomy Id associated to the record',
          parent_feature_property_id: null,
          record_effective_date: '2023-12-08',
          record_end_date: null,
          create_date: '2023-12-08 14:37:41.315999-08',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        }
      ]);

      // Act
      await searchIndexService.indexFeaturesBySubmissionId(777);

      // Assert
      expect(getSubmissionFeaturesStub).to.be.calledWith(777);

      expect(insertSearchableStringStub).to.be.calledWith([
        {
          submission_feature_id: 11111,
          feature_property_id: 1, // Name
          value: 'Ardvark'
        },
        {
          submission_feature_id: 11111,
          feature_property_id: 2, // Description
          value: 'Desc1'
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 1, // Name
          value: 'Buffalo'
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 2, // Description
          value: 'Desc2'
        }
      ]);

      expect(insertSearchableDatetimeStub).to.be.calledWith([
        {
          submission_feature_id: 11111,
          feature_property_id: 5, // Start Date
          value: new Date('2000-01-01')
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 5, // Start Date
          value: new Date('2001-01-01')
        }
      ]);

      expect(insertSearchableSpatialStub).to.be.calledWith([
        {
          submission_feature_id: 11111,
          feature_property_id: 7, // Spatial
          value: { type: 'Point', coordinates: [11, 11] }
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 7, // Spatial
          value: { type: 'Point', coordinates: [22, 22] }
        }
      ]);

      expect(insertSearchableNumberStub).to.be.calledWith([
        {
          submission_feature_id: 11111,
          feature_property_id: 3, // Taxonomy
          value: 1001
        },
        {
          submission_feature_id: 11111,
          feature_property_id: 8, // Count
          value: 60
        },
        {
          submission_feature_id: 11111,
          feature_property_id: 9, // Lat
          value: 11
        },
        {
          submission_feature_id: 11111,
          feature_property_id: 10, // Long
          value: 11
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 3, // Taxonomy
          value: 1002
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 8, // Count
          value: 70
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 9, // Lat
          value: 22
        },
        {
          submission_feature_id: 22222,
          feature_property_id: 10, // Long
          value: 22
        }
      ]);
    });
  });
});
