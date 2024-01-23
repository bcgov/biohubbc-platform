import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SearchIndexRepository } from '../repositories/search-index-respository';
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
});
