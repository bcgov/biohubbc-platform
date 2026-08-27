import Ajv from 'ajv';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as index from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';
import * as db from '../../../../../../database/db';
import { HTTP400, HTTPError } from '../../../../../../errors/http-error';
import { SubmissionFeaturePropertyService } from '../../../../../../services/submission-feature-property-service';

chai.use(sinonChai);

describe('properties index', () => {
  describe('getSubmissionFeatureProperties', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('propagates and re-throws errors', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const getSubmissionFeaturePropertiesStub = sinon
        .stub(SubmissionFeaturePropertyService.prototype, 'getSubmissionFeatureProperties')
        .throws(new HTTP400('Error', ['Error']));

      const requestHandler = index.getSubmissionFeatureProperties();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionId: '1',
        submissionFeatureId: '10'
      };
      mockReq.query = { search: 'wolf', page: '1', limit: '10', sort: 'property', order: 'asc' };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(getSubmissionFeaturePropertiesStub).to.have.been.calledOnce;
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('Error');
      }
    });

    it('should return 200 on success', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const getSubmissionFeaturePropertiesStub = sinon
        .stub(SubmissionFeaturePropertyService.prototype, 'getSubmissionFeatureProperties')
        .resolves({
          properties: [
            { id: 'species_name', property: 'species name', value: 'Wolf' },
            { id: 'count', property: 'count', value: '2' },
            {
              id: 'taxon:7',
              property: 'focal species',
              value: { taxon_id: 3, tsn: 180596, rank: 'Species', label: 'Canis lupus' }
            }
          ],
          total: 3
        });

      const requestHandler = index.getSubmissionFeatureProperties();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = {
        submissionId: '1',
        submissionFeatureId: '10'
      };
      mockReq.query = { search: 'wolf', page: '1', limit: '10', sort: 'property', order: 'asc' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSubmissionFeaturePropertiesStub).to.have.been.calledOnceWith(
        10,
        {
          page: 1,
          limit: 10,
          sort: 'property',
          order: 'asc'
        },
        { search: 'wolf' }
      );
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.properties).to.deep.equal([
        { id: 'species_name', property: 'species name', value: 'Wolf' },
        { id: 'count', property: 'count', value: '2' },
        {
          id: 'taxon:7',
          property: 'focal species',
          value: { taxon_id: 3, tsn: 180596, rank: 'Species', label: 'Canis lupus' }
        }
      ]);
      expect(mockRes.jsonValue.pagination.total).to.equal(3);
    });

    it('uses the API user connection for anonymous (no token) requests', async () => {
      const dbConnectionObj = getMockDBConnection();
      const getAPIUserDBConnectionStub = sinon
        .stub(db.dbDependencies, 'getAPIUserDBConnection')
        .returns(dbConnectionObj);
      const getDBConnectionStub = sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(SubmissionFeaturePropertyService.prototype, 'getSubmissionFeatureProperties')
        .resolves({ properties: [], total: 0 });

      const requestHandler = index.getSubmissionFeatureProperties();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      // No keycloak_token on the request => anonymous caller reading an unsecured feature.
      mockReq.params = {
        submissionId: '1',
        submissionFeatureId: '10'
      };
      mockReq.query = { page: '1', limit: '10' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
      expect(getDBConnectionStub).to.not.have.been.called;
      expect(mockRes.statusValue).to.equal(200);
    });
  });

  describe('openapi schema', () => {
    it('is a valid schema document', () => {
      const ajv = new Ajv();

      expect(ajv.validateSchema(index.GET.apiDoc as unknown as object)).to.be.true;
    });
  });
});
