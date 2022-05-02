import { expect } from 'chai';
import { describe } from 'mocha';
import {
  activateSystemUserSQL,
  addSystemUserSQL,
  deactivateSystemUserSQL,
  deleteAllProjectRolesSQL,
  deleteAllSystemRolesSQL,
  getUserByIdSQL,
  getUserByUserIdentifierSQL,
  getUserListSQL
} from './user-queries';

describe('getUserByUserIdentifierSQL', () => {
  it('returns a SQL statement', () => {
    const response = getUserByUserIdentifierSQL('aUserName');

    expect(response).to.not.be.null;
  });
});

describe('getUserByIdSQL', () => {
  it('returns a SQL statement', () => {
    const response = getUserByIdSQL(1);

    expect(response).to.not.be.null;
  });
});

describe('getUserListSQL', () => {
  it('returns a SQL statement', () => {
    const response = getUserListSQL();

    expect(response).to.not.be.null;
  });
});

describe('addSystemUserSQL', () => {
  it('returns a SQL statement', () => {
    const response = addSystemUserSQL('validString', 'validString');

    expect(response).to.not.be.null;
  });
});

describe('deactivateSystemUserSQL', () => {
  it('returns a SQL statement', () => {
    const response = deactivateSystemUserSQL(1);

    expect(response).to.not.be.null;
  });
});

describe('activateSystemUserSQL', () => {
  it('returns a SQL statement', () => {
    const response = activateSystemUserSQL(1);

    expect(response).to.not.be.null;
  });
});

describe('deleteAllSystemRolesSQL', () => {
  it('returns a SQL statement', () => {
    const response = deleteAllSystemRolesSQL(1);

    expect(response).to.not.be.null;
  });
});

describe('deleteAllProjectRolesSQL', () => {
  it('returns a SQL statement', () => {
    const response = deleteAllProjectRolesSQL(1);

    expect(response).to.not.be.null;
  });
});
