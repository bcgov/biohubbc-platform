import { expect } from 'chai';
import { describe } from 'mocha';
import {
  countPendingAdministrativeActivitiesSQL,
  getAdministrativeActivitiesSQL,
  postAdministrativeActivitySQL,
  putAdministrativeActivitySQL
} from './administrative-activity-queries';

describe('getAdministrativeActivitiesSQL', () => {
  it('returns a SQL statement when no administrativeActivityTypeName or administrativeActivityStatusTypes provided', () => {
    const response = getAdministrativeActivitiesSQL();

    expect(response).to.not.be.null;
  });

  it('returns a SQL statement when administrativeActivityStatusTypes is null and administrativeActivityStatusTypes is valid', () => {
    const response = getAdministrativeActivitiesSQL((null as unknown) as string, ['status']);

    expect(response).to.not.be.null;
  });

  it('returns a SQL statement when administrativeActivityStatusTypes is empty string and administrativeActivityStatusTypes is valid', () => {
    const response = getAdministrativeActivitiesSQL('', ['status']);

    expect(response).to.not.be.null;
  });

  it('returns a SQL statement when administrativeActivityStatusTypes is valid and administrativeActivityStatusTypes is null', () => {
    const response = getAdministrativeActivitiesSQL('type', (null as unknown) as string[]);

    expect(response).to.not.be.null;
  });

  it('returns a SQL statement when administrativeActivityStatusTypes is valid and administrativeActivityStatusTypes is empty', () => {
    const response = getAdministrativeActivitiesSQL('type', []);

    expect(response).to.not.be.null;
  });

  it('returns a SQL statement when valid parameters provided', () => {
    const response = getAdministrativeActivitiesSQL('type', ['status 1', 'status 2']);

    expect(response).to.not.be.null;
  });
});

describe('postAdministrativeActivitySQL', () => {
  it('returns a SQL statement', () => {
    const response = postAdministrativeActivitySQL(1, {});
    expect(response).to.not.be.null;
  });
});

describe('countPendingAdministrativeActivitiesSQL', () => {
  it('returns a SQL statement', () => {
    const response = countPendingAdministrativeActivitiesSQL('username');
    expect(response).to.not.be.null;
  });
});

describe('putAdministrativeActivitySQL', () => {
  it('returns a SQL statement', () => {
    const response = putAdministrativeActivitySQL(1, 1);
    expect(response).to.not.be.null;
  });
});
