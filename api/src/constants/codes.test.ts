import { expect } from 'chai';
import { describe } from 'mocha';
import { coordinator_agency, region } from './codes';

describe('coordinator_agency', () => {
  it('has values', () => {
    expect(coordinator_agency).is.not.empty;
  });
});

describe('region', () => {
  it('has values', () => {
    expect(region).is.not.empty;
  });
});
