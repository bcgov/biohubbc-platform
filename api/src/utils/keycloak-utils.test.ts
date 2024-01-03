import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import * as dbConstants from '../database/db-constants';
import { SystemUser } from '../repositories/user-repository';
import {
  coerceUserIdentitySource,
  getServiceClientSystemUser,
  getUserGuid,
  getUserIdentifier,
  getUserIdentitySource
} from './keycloak-utils';

chai.use(sinonChai);

describe('keycloakUtils', () => {
  describe('getUserGuid', () => {
    it('returns null response when null keycloakToken provided', () => {
      const response = getUserGuid(null as unknown as object);

      expect(response).to.be.null;
    });

    it('returns null response when a keycloakToken is provided with a missing preferred_username field', () => {
      const response = getUserGuid({ idir_username: 'username' });

      expect(response).to.be.null;
    });

    it('returns their guid', () => {
      const response = getUserGuid({ preferred_username: '123-456-789@idir' });

      expect(response).to.equal('123-456-789');
    });
  });

  describe('getUserIdentifier', () => {
    it('returns null response when null keycloakToken provided', () => {
      const response = getUserIdentifier(null as unknown as object);

      expect(response).to.be.null;
    });

    it('returns null response when a keycloakToken is provided with a missing username field', () => {
      const response = getUserIdentifier({ preferred_username: '123-456-789@idir' });

      expect(response).to.be.null;
    });

    it('returns the identifier from their IDIR username', () => {
      const response = getUserIdentifier({ preferred_username: '123-456-789@idir', idir_username: 'idiruser' });

      expect(response).to.equal('idiruser');
    });

    it('returns the identifier from their BCeID username', () => {
      const response = getUserIdentifier({ preferred_username: '123-456-789@idir', bceid_username: 'bceiduser' });

      expect(response).to.equal('bceiduser');
    });
  });

  describe('getUserIdentitySource', () => {
    it('returns non null response when null keycloakToken provided', () => {
      const response = getUserIdentitySource(null as unknown as object);

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('returns non null response when valid keycloakToken provided with no preferred_username', () => {
      const response = getUserIdentitySource({});

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('returns non null response when valid keycloakToken provided with null preferred_username', () => {
      const response = getUserIdentitySource({ preferred_username: null });

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('returns non null response when valid keycloakToken provided with no source', () => {
      const response = getUserIdentitySource({ preferred_username: 'username' });

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('returns non null response when valid keycloakToken provided with idir source', () => {
      const response = getUserIdentitySource({ preferred_username: 'username@idir' });

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.IDIR);
    });

    it('returns non null response when valid keycloakToken provided with bceid basic source', () => {
      const response = getUserIdentitySource({ preferred_username: 'username@bceidbasic' });

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.BCEID_BASIC);
    });

    it('returns non null response when valid keycloakToken provided with bceid business source', () => {
      const response = getUserIdentitySource({ preferred_username: 'username@bceidbusiness' });

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS);
    });

    it('returns non null response when valid keycloakToken provided with database source', () => {
      const response = getUserIdentitySource({ preferred_username: 'username@database' });

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('returns non null response when valid keycloakToken provided with system source', () => {
      const response = getUserIdentitySource({ preferred_username: 'username@system' });

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.SYSTEM);
    });
  });

  describe('coerceUserIdentitySource', () => {
    it('should coerce empty string user identity to DATABASE', () => {
      const response = coerceUserIdentitySource('');
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('should coerce null string user identity to DATABASE', () => {
      const response = coerceUserIdentitySource(null as unknown as string);
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('should coerce bceid basic user identity to BCEIDBASIC', () => {
      const response = coerceUserIdentitySource('bceidbasic');
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.BCEID_BASIC);
    });

    it('should coerce bceid business user identity to BCEIDBUSINESS', () => {
      const response = coerceUserIdentitySource('bceidbusiness');
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS);
    });

    it('should coerce idir user identity to IDIR', () => {
      const response = coerceUserIdentitySource('idir');
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.IDIR);
    });

    it('should coerce database user identity to DATABASE', () => {
      const response = coerceUserIdentitySource('database');
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });

    it('should coerce system user identity to SYSTEM', () => {
      const response = coerceUserIdentitySource('system');
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.SYSTEM);
    });
  });

  describe('getServiceClientSystemUser', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns null if the sub field is undefined', () => {
      const dbConstantsMock: dbConstants.DBConstants = { serviceClientUsers: [] };

      sinon.stub(dbConstants, 'getDBConstants').returns(dbConstantsMock);

      const token = { sub: undefined };

      const response = getServiceClientSystemUser(token);

      expect(response).to.be.null;
    });

    it('returns null if no matching known service client system user is found', () => {
      const dbConstantsMock: dbConstants.DBConstants = { serviceClientUsers: [] };

      sinon.stub(dbConstants, 'getDBConstants').returns(dbConstantsMock);

      const token = { sub: 'not-null' };

      const response = getServiceClientSystemUser(token);

      expect(response).to.be.null;
    });

    it('returns a matching known service client system user', () => {
      const serviceClientSystemUser: SystemUser = {
        system_user_id: 1,
        user_identity_source_id: 2,
        user_identifier: 'known-service-client',
        user_guid: 'known-service-client-guid',
        record_effective_date: '',
        record_end_date: '',
        create_date: '2023-12-12',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const dbConstantsMock: dbConstants.DBConstants = { serviceClientUsers: [serviceClientSystemUser] };

      sinon.stub(dbConstants, 'getDBConstants').returns(dbConstantsMock);

      const token = { sub: 'known-service-client-guid' };

      const response = getServiceClientSystemUser(token);

      expect(response).to.eql(serviceClientSystemUser);
    });
  });
});
