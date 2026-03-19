import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { ApiExecuteSQLError } from '../errors/api-error';
import { ContributorCodeset } from '../models/contributor-codeset';
import { ContributorCodesetCode } from '../models/contributor-codeset-code';
import { ContributorCodesetCodeService } from '../services/contributor-codeset-code-service';
import { ContributorCodesetService } from '../services/contributor-codeset-service';
import { SubmissionFeaturePropertyIndexService } from '../services/submission-feature-property-index-service';
import { CodeReference } from '../utils/code-reference';
import { getMockDBConnection } from '../__mocks__/db';

describe('SubmissionFeaturePropertyIndexService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('persistContributorCodesByContributorId', () => {
    const codeReference: CodeReference = {
      slug: 'code::agency::aarde',
      contributorCodesetKey: 'agency',
      contributorCodesetCodeKey: 'aarde'
    };

    const mockCodesetRow: ContributorCodeset = {
      contributor_codeset_id: 10,
      contributor_id: 999,
      key: 'agency',
      label: 'agency',
      description: 'agency description',
      external_id: 'v1'
    };

    const mockCodeRow: ContributorCodesetCode = {
      contributor_codeset_code_id: 20,
      contributor_codeset_id: 10,
      key: 'aarde',
      label: 'aardvark',
      description: 'aardvark code',
      external_id: 'v1'
    };

    it('returns early when no referenced codes exist', async () => {
      const createCodesetsStub = sinon.stub(ContributorCodesetService.prototype, 'createCodesets').resolves([]);
      const createCodesStub = sinon
        .stub(ContributorCodesetCodeService.prototype, 'createContributorCodesetCodes')
        .resolves([]);
      const service = new SubmissionFeaturePropertyIndexService(getMockDBConnection());

      await service.persistContributorCodesByContributorId(999, {}, []);
      expect(createCodesetsStub.called).to.be.false;
      expect(createCodesStub.called).to.be.false;
    });

    it('persists referenced codesets/codes via contributor services', async () => {
      const createCodesetsStub = sinon
        .stub(ContributorCodesetService.prototype, 'createCodesets')
        .resolves([mockCodesetRow]);
      const createCodesStub = sinon
        .stub(ContributorCodesetCodeService.prototype, 'createContributorCodesetCodes')
        .resolves([mockCodeRow]);
      const service = new SubmissionFeaturePropertyIndexService(getMockDBConnection());

      await service.persistContributorCodesByContributorId(
        999,
        {
          agency: {
            external_id: 'v1',
            label: 'Agency',
            description: 'Agency Description',
            codes: {
              aarde: {
                external_id: 'v1',
                label: 'Aardvark',
                description: 'Aardvark Code'
              }
            }
          }
        },
        [codeReference]
      );

      expect(createCodesetsStub.calledOnce).to.be.true;
      expect(createCodesetsStub.getCall(0).args[0]).to.eql([
        {
          contributor_id: 999,
          key: 'agency',
          external_id: 'v1',
          label: 'agency',
          description: 'agency description'
        }
      ]);
      expect(createCodesStub.calledOnce).to.be.true;
      expect(createCodesStub.getCall(0).args[0]).to.eql([
        {
          contributor_codeset_id: 10,
          key: 'aarde',
          external_id: 'v1',
          label: 'aardvark',
          description: 'aardvark code'
        }
      ]);
    });

    it('throws when service resolves duplicate codeset keys', async () => {
      sinon
        .stub(ContributorCodesetService.prototype, 'createCodesets')
        .resolves([mockCodesetRow, { ...mockCodesetRow, contributor_codeset_id: 11 }]);
      sinon.stub(ContributorCodesetCodeService.prototype, 'createContributorCodesetCodes').resolves([mockCodeRow]);
      const service = new SubmissionFeaturePropertyIndexService(getMockDBConnection());

      try {
        await service.persistContributorCodesByContributorId(
          999,
          {
            agency: {
              external_id: 'v1',
              label: 'Agency',
              description: 'Agency Description',
              codes: {
                aarde: {
                  external_id: 'v1',
                  label: 'Aardvark',
                  description: 'Aardvark Code'
                }
              }
            }
          },
          [codeReference]
        );

        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });
  });
});
