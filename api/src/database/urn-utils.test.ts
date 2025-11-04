import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { parseFeatureUrn } from './urn-utils';

chai.use(sinonChai);

describe('parseFeatureUrn', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('when called with a valid URN', () => {
    it('returns the correct parsed components', () => {
      const urn = 'urn:123:observation:456';

      const result = parseFeatureUrn(urn);

      expect(result).to.deep.equal({
        submissionId: 123,
        featureTypeName: 'observation',
        submissionFeatureId: 456
      });
    });

    it('handles numeric strings properly by converting them to numbers', () => {
      const urn = 'urn:42:dataset:9001';

      const result = parseFeatureUrn(urn);

      expect(result.submissionId).to.be.a('number').and.equal(42);
      expect(result.submissionFeatureId).to.be.a('number').and.equal(9001);
      expect(result.featureTypeName).to.equal('dataset');
    });
  });

  describe('when called with an invalid URN', () => {
    it('throws an error if the prefix is not "urn"', () => {
      const urn = 'invalid:1:dataset:2';

      try {
        parseFeatureUrn(urn);
        expect.fail('Expected function to throw');
      } catch (error) {
        expect((error as Error).message).to.equal(`Invalid URN format: ${urn}`);
      }
    });

    it('throws an error if the URN has too few parts', () => {
      const urn = 'urn:123:dataset'; // missing feature ID

      try {
        parseFeatureUrn(urn);
        expect.fail('Expected function to throw');
      } catch (error) {
        expect((error as Error).message).to.equal(`Invalid URN format: ${urn}`);
      }
    });

    it('throws an error if the URN has too many parts', () => {
      const urn = 'urn:1:dataset:2:extra';

      try {
        parseFeatureUrn(urn);
        expect.fail('Expected function to throw');
      } catch (error) {
        expect((error as Error).message).to.equal(`Invalid URN format: ${urn}`);
      }
    });
  });
});
