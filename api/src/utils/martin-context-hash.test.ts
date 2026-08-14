import { expect } from 'chai';
import { describe } from 'mocha';
import { computeMartinContextHash } from './martin-context-hash';

describe('computeMartinContextHash', () => {
  const base = {
    expressionId: 'f2b4f6b4-1111-4a5a-9a1c-000000000001',
    featureTypeId: 21,
    systemUserId: 7
  };

  it('is stable for identical input', () => {
    expect(computeMartinContextHash(base)).to.equal(computeMartinContextHash({ ...base }));
  });

  it('separates anonymous from authenticated callers', () => {
    // The critical property: an anonymous visitor must never share cached tiles with a signed-in
    // user, even when they run the same search — authorization is evaluated per user at serve time.
    const anonymous = computeMartinContextHash({ ...base, systemUserId: null });
    const authenticated = computeMartinContextHash({ ...base, systemUserId: 7 });

    expect(anonymous).to.not.equal(authenticated);
  });

  it('separates different users', () => {
    expect(computeMartinContextHash({ ...base, systemUserId: 8 })).to.not.equal(computeMartinContextHash(base));
  });

  it('separates different searches', () => {
    expect(computeMartinContextHash({ ...base, expressionId: 'f2b4f6b4-1111-4a5a-9a1c-000000000002' })).to.not.equal(
      computeMartinContextHash(base)
    );
  });

  it('separates a filtered search from an unfiltered view', () => {
    expect(computeMartinContextHash({ ...base, expressionId: null })).to.not.equal(computeMartinContextHash(base));
  });

  it('separates different feature types', () => {
    expect(computeMartinContextHash({ ...base, featureTypeId: 24 })).to.not.equal(computeMartinContextHash(base));
  });

  it('returns a sha256 hex digest', () => {
    expect(computeMartinContextHash(base)).to.match(/^[0-9a-f]{64}$/);
  });
});
