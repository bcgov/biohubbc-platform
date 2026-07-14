import { expect } from 'chai';
import { describe } from 'mocha';
import { getUnique } from './unique';

describe('getUnique', () => {
  it('removes duplicate values while preserving first-seen order', () => {
    expect(getUnique([2, 1, 2, 3, 1])).to.eql([2, 1, 3]);
  });
});
