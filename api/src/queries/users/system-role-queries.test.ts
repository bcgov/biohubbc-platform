import { expect } from 'chai';
import { describe } from 'mocha';
import { postSystemRolesSQL } from './system-role-queries';

describe('postSystemRolesSQL', () => {
  it('returns a SQL statement', () => {
    const response = postSystemRolesSQL(1, [1, 2]);

    expect(response).to.not.be.null;
  });
});
