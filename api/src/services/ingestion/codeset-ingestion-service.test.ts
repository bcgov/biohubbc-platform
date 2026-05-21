import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../../__mocks__/db';
import { IngestionValidationError } from '../../errors/submission-errors';
import { ContributorCodesetCodeService } from '../contributor-codeset-code-service';
import { ContributorCodesetService } from '../contributor-codeset-service';
import { CodesetIngestionService } from './codeset-ingestion-service';

describe('CodesetIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('persistContributorCodesets', () => {
    it('inserts contributor codes in bounded 10k batches', async () => {
      const dbConnection = getMockDBConnection();
      const service = new CodesetIngestionService(dbConnection);

      sinon.stub(ContributorCodesetService.prototype, 'getContributorCodesetsByContributorIdAndKeys').resolves([]);
      sinon
        .stub(ContributorCodesetCodeService.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
        .resolves([]);
      sinon.stub(ContributorCodesetService.prototype, 'createCodeset').resolves({ contributor_codeset_id: 321 } as any);

      const createCodesStub = sinon
        .stub(ContributorCodesetCodeService.prototype, 'createContributorCodesetCodes')
        .resolves([]);

      const codes: Record<string, { label: string; description: string; external_id: string }> = {};
      for (let index = 0; index < 10001; index += 1) {
        codes[`key-${index}`] = {
          label: `label-${index}`,
          description: `desc-${index}`,
          external_id: `${index}`
        };
      }

      await service.persistContributorCodesets(123, {
        agency: {
          label: 'Agency',
          description: 'Agency codes',
          external_id: 'agency',
          codes
        }
      } as any);

      expect(createCodesStub.callCount).to.equal(2);
      expect(createCodesStub.firstCall.args[0]).to.have.length(10000);
      expect(createCodesStub.secondCall.args[0]).to.have.length(1);
    });

    it('uses existing database labels when tar payload omits labels', async () => {
      const dbConnection = getMockDBConnection();
      const service = new CodesetIngestionService(dbConnection);

      sinon.stub(ContributorCodesetService.prototype, 'getContributorCodesetsByContributorIdAndKeys').resolves([
        {
          contributor_codeset_id: 50,
          contributor_id: 123,
          key: 'agency',
          label: 'Existing Agency',
          description: 'Existing Agency Description',
          external_id: 'agency-existing'
        } as any
      ]);
      sinon
        .stub(ContributorCodesetCodeService.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
        .resolves([
          {
            contributor_codeset_code_id: 77,
            contributor_codeset_id: 50,
            key: 'aarde',
            label: 'Existing Aarde',
            description: null,
            external_id: null
          } as any
        ]);

      const createCodesetStub = sinon
        .stub(ContributorCodesetService.prototype, 'createCodeset')
        .resolves({ contributor_codeset_id: 50 } as any);
      const createCodesStub = sinon
        .stub(ContributorCodesetCodeService.prototype, 'createContributorCodesetCodes')
        .resolves([]);

      await service.persistContributorCodesets(123, {
        agency: {
          codes: {
            aarde: {}
          }
        }
      } as any);

      expect(createCodesetStub.calledOnce).to.be.true;
      expect(createCodesetStub.firstCall.args[0].label).to.equal('existing agency');
      expect(createCodesStub.calledOnce).to.be.true;
      expect(createCodesStub.firstCall.args[0][0].label).to.equal('existing aarde');
    });

    it('throws when neither tar payload nor database metadata provides a required label', async () => {
      const dbConnection = getMockDBConnection();
      const service = new CodesetIngestionService(dbConnection);

      sinon.stub(ContributorCodesetService.prototype, 'getContributorCodesetsByContributorIdAndKeys').resolves([]);
      sinon
        .stub(ContributorCodesetCodeService.prototype, 'getContributorCodesetCodesByContributorCodesetIds')
        .resolves([]);
      const createCodesetStub = sinon
        .stub(ContributorCodesetService.prototype, 'createCodeset')
        .resolves({ contributor_codeset_id: 50 } as any);

      try {
        await service.persistContributorCodesets(123, {
          agency: {
            codes: {
              aarde: {}
            }
          }
        } as any);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(IngestionValidationError);
        expect((error as Error).message).to.include('Missing required label for contributor code metadata');
      }

      expect(createCodesetStub.called).to.be.false;
    });
  });
});
