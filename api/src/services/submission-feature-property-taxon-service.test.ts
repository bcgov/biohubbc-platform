import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import {
  CreateSubmissionFeaturePropertyTaxon,
  SubmissionFeaturePropertyTaxon
} from '../models/submission-feature-property-taxon';
import { SubmissionFeaturePropertyTaxonRepository } from '../repositories/submission-feature-property-taxon-repository';
import { SubmissionFeaturePropertyTaxonService } from './submission-feature-property-taxon-service';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyTaxonService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockRow: SubmissionFeaturePropertyTaxon = {
    submission_feature_property_taxon_id: 1,
    submission_feature_id: 10,
    feature_type_property_id: 20,
    taxon_id: 1234
  };

  const createPayload: CreateSubmissionFeaturePropertyTaxon = {
    submission_feature_id: 10,
    feature_type_property_id: 20,
    taxon_id: 1234
  };
  it('delegates create', async () => {
    const service = new SubmissionFeaturePropertyTaxonService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyTaxonRepository.prototype, 'insertSubmissionFeaturePropertyTaxon')
      .resolves(mockRow);
    const result = await service.createSubmissionFeaturePropertyTaxon(createPayload);
    expect(stub).to.have.been.calledOnceWith(createPayload);
    expect(result).to.eql(mockRow);
  });

  it('delegates getById', async () => {
    const service = new SubmissionFeaturePropertyTaxonService(getMockDBConnection());
    const stub = sinon
      .stub(SubmissionFeaturePropertyTaxonRepository.prototype, 'getSubmissionFeaturePropertyTaxonById')
      .resolves(mockRow);
    const result = await service.getSubmissionFeaturePropertyTaxonById(1);
    expect(stub).to.have.been.calledOnceWith(1);
    expect(result).to.eql(mockRow);
  });

  it('delegates getBySubmissionFeatureId', async () => {
    const service = new SubmissionFeaturePropertyTaxonService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyTaxonRepository.prototype,
        'getSubmissionFeaturePropertyTaxonBySubmissionFeatureId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyTaxonBySubmissionFeatureId(10);
    expect(stub).to.have.been.calledOnceWith(10);
    expect(result).to.eql([mockRow]);
  });

  it('delegates getByFeatureTypePropertyId', async () => {
    const service = new SubmissionFeaturePropertyTaxonService(getMockDBConnection());
    const stub = sinon
      .stub(
        SubmissionFeaturePropertyTaxonRepository.prototype,
        'getSubmissionFeaturePropertyTaxonByFeatureTypePropertyId'
      )
      .resolves([mockRow]);
    const result = await service.getSubmissionFeaturePropertyTaxonByFeatureTypePropertyId(20);
    expect(stub).to.have.been.calledOnceWith(20);
    expect(result).to.eql([mockRow]);
  });
  it('propagates repository errors', async () => {
    const service = new SubmissionFeaturePropertyTaxonService(getMockDBConnection());
    sinon
      .stub(SubmissionFeaturePropertyTaxonRepository.prototype, 'insertSubmissionFeaturePropertyTaxon')
      .rejects(new Error('DB error'));

    try {
      await service.createSubmissionFeaturePropertyTaxon(createPayload);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect((error as Error).message).to.equal('DB error');
    }
  });
});
