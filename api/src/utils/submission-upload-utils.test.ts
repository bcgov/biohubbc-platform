import { expect } from 'chai';
import { describe, it } from 'mocha';
import { calculateMultipartLayout } from './submission-upload-utils';

describe('submission-upload-utils', () => {
  describe('calculateMultipartLayout', () => {
    it('returns one part for a sub-5 MiB upload', () => {
      const result = calculateMultipartLayout(512 * 1024); // 0.5 MiB

      expect(result.partSizeBytes).to.equal(5 * 1024 * 1024);
      expect(result.partCount).to.equal(1);
    });

    it('uses 5 MiB at the 20 MiB threshold', () => {
      const result = calculateMultipartLayout(20 * 1024 * 1024);

      expect(result.partSizeBytes).to.equal(5 * 1024 * 1024);
      expect(result.partCount).to.equal(4);
    });

    it('scales to 6 MiB at 30 MiB', () => {
      const result = calculateMultipartLayout(30 * 1024 * 1024);

      expect(result.partSizeBytes).to.equal(6 * 1024 * 1024);
      expect(result.partCount).to.equal(5);
    });

    it('scales to 7 MiB at 40 MiB', () => {
      const result = calculateMultipartLayout(40 * 1024 * 1024);

      expect(result.partSizeBytes).to.equal(7 * 1024 * 1024);
      expect(result.partCount).to.equal(6);
    });

    it('uses larger parts for larger uploads to reduce request count', () => {
      const result = calculateMultipartLayout(500 * 1024 * 1024); // 500 MiB

      expect(result.partSizeBytes).to.be.greaterThan(10 * 1024 * 1024);
      expect(result.partCount).to.be.lessThan(50);
    });

    it('caps part size at 100 MiB for a 5 GiB upload', () => {
      const fiveGiB = 5 * 1024 * 1024 * 1024;
      const result = calculateMultipartLayout(fiveGiB);

      expect(result.partSizeBytes).to.equal(100 * 1024 * 1024);
      expect(result.partCount).to.equal(52);
    });

    it('increases part size for very large uploads to keep parts <= 10000', () => {
      const oneTiB = 1024 * 1024 * 1024 * 1024;
      const result = calculateMultipartLayout(oneTiB);

      expect(result.partCount).to.be.at.most(10000);
      expect(result.partSizeBytes).to.be.greaterThan(100 * 1024 * 1024);
    });

    it('throws for non-positive bytes', () => {
      expect(() => calculateMultipartLayout(0)).to.throw('Upload bytes must be a positive finite number.');
    });
  });
});
