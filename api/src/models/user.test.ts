import { expect } from 'chai';
import { describe } from 'mocha';
import { isSystemUserInactive, SystemUser } from './user';

describe('isSystemUserInactive', () => {
  it('returns false if `record_end_date` is null', () => {
    const result = isSystemUserInactive({ record_end_date: null } as unknown as SystemUser);

    expect(result).to.be.false;
  });

  it('returns true if `record_end_date` is in the past', () => {
    const result = isSystemUserInactive({ record_end_date: '2020-01-01' } as unknown as SystemUser);

    expect(result).to.be.true;
  });

  it('returns false if `record_end_date` is in the future', () => {
    const result = isSystemUserInactive({ record_end_date: '2999-01-01' } as unknown as SystemUser);

    expect(result).to.be.false;
  });
});
