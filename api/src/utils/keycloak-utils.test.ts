import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SYSTEM_IDENTITY_SOURCE } from '../constants/database';
import * as dbConstants from '../database/db-constants';
import { SystemUser } from '../repositories/user-repository';
import {
  BceidBasicUserInformation,
  BceidBusinessUserInformation,
  coerceUserIdentitySource,
  DatabaseUserInformation,
  getServiceClientSystemUser,
  getUserGuid,
  getUserIdentifier,
  getUserIdentitySource,
  IdirUserInformation,
  isBceidBasicUserInformation,
  isBceidBusinessUserInformation,
  isDatabaseUserInformation,
  isIdirUserInformation
} from './keycloak-utils';

chai.use(sinonChai);

describe('keycloakUtils', () => {
  describe('getUserGuid', () => {
    it('returns idir guid', () => {
      const keycloakUserInformation: IdirUserInformation = {
        idir_user_guid: '123456789',
        identity_provider: 'idir',
        idir_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@idir',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserGuid(keycloakUserInformation);

      expect(response).to.equal('123456789');
    });

    it('returns bceid basic guid', () => {
      const keycloakUserInformation: BceidBasicUserInformation = {
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbasic',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbasic',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserGuid(keycloakUserInformation);

      expect(response).to.equal('123456789');
    });

    it('returns bceid business guid', () => {
      const keycloakUserInformation: BceidBusinessUserInformation = {
        bceid_business_guid: '1122334455',
        bceid_business_name: 'Business Name',
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbusiness',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbusiness',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserGuid(keycloakUserInformation);

      expect(response).to.equal('123456789');
    });

    it('returns database guid', () => {
      const keycloakUserInformation: DatabaseUserInformation = {
        database_user_guid: '123456789',
        identity_provider: 'database',
        username: 'biohub_dapi_v1'
      };

      const response = getUserGuid(keycloakUserInformation);

      expect(response).to.equal('123456789');
    });
  });

  describe('getUserIdentifier', () => {
    it('returns idir username', () => {
      const keycloakUserInformation: IdirUserInformation = {
        idir_user_guid: '123456789',
        identity_provider: 'idir',
        idir_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@idir',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserIdentifier(keycloakUserInformation);

      expect(response).to.equal('tname');
    });

    it('returns bceid basic username', () => {
      const keycloakUserInformation: BceidBasicUserInformation = {
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbasic',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbasic',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserIdentifier(keycloakUserInformation);

      expect(response).to.equal('tname');
    });

    it('returns bceid business username', () => {
      const keycloakUserInformation: BceidBusinessUserInformation = {
        bceid_business_guid: '1122334455',
        bceid_business_name: 'Business Name',
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbusiness',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbusiness',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserIdentifier(keycloakUserInformation);

      expect(response).to.equal('tname');
    });

    it('returns database username', () => {
      const keycloakUserInformation: DatabaseUserInformation = {
        database_user_guid: '123456789',
        identity_provider: 'database',
        username: 'biohub_dapi_v1'
      };

      const response = getUserIdentifier(keycloakUserInformation);

      expect(response).to.equal('biohub_dapi_v1');
    });
  });

  describe('getUserIdentitySource', () => {
    it('returns idir source', () => {
      const keycloakUserInformation: IdirUserInformation = {
        idir_user_guid: '123456789',
        identity_provider: 'idir',
        idir_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@idir',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserIdentitySource(keycloakUserInformation);

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.IDIR);
    });

    it('returns bceid basic source', () => {
      const keycloakUserInformation: BceidBasicUserInformation = {
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbasic',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbasic',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserIdentitySource(keycloakUserInformation);

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.BCEID_BASIC);
    });

    it('returns bceid business source', () => {
      const keycloakUserInformation: BceidBusinessUserInformation = {
        bceid_business_guid: '1122334455',
        bceid_business_name: 'Business Name',
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbusiness',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbusiness',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = getUserIdentitySource(keycloakUserInformation);

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS);
    });

    it('returns database source', () => {
      const keycloakUserInformation: DatabaseUserInformation = {
        database_user_guid: '123456789',
        identity_provider: 'database',
        username: 'biohub_dapi_v1'
      };

      const response = getUserIdentitySource(keycloakUserInformation);

      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });
  });

  describe('coerceUserIdentitySource', () => {
    it('should coerce empty string user identity to DATABASE', () => {
      const response = coerceUserIdentitySource('');
      expect(response).to.equal(SYSTEM_IDENTITY_SOURCE.DATABASE);
    });
    it('should coerce null string user identity to DATABASE', () => {
      const response = coerceUserIdentitySource((null as unknown) as string);
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
  });

  describe('isIdirUserInformation', () => {
    it('returns true when idir token information provided', () => {
      const keycloakUserInformation: IdirUserInformation = {
        idir_user_guid: '123456789',
        identity_provider: 'idir',
        idir_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@idir',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isIdirUserInformation(keycloakUserInformation);

      expect(response).to.be.true;
    });

    it('returns false when bceid basic token information provided', () => {
      const keycloakUserInformation: BceidBasicUserInformation = {
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbasic',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbasic',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isIdirUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns false when bceid business token information provided', () => {
      const keycloakUserInformation: BceidBusinessUserInformation = {
        bceid_business_guid: '1122334455',
        bceid_business_name: 'Business Name',
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbusiness',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbusiness',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isIdirUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns false when database token information provided', () => {
      const keycloakUserInformation: DatabaseUserInformation = {
        database_user_guid: '123456789',
        identity_provider: 'database',
        username: 'biohub_dapi_v1'
      };

      const response = isIdirUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });
  });

  describe('isBceidBasicUserInformation', () => {
    it('returns false when idir token information provided', () => {
      const keycloakUserInformation: IdirUserInformation = {
        idir_user_guid: '123456789',
        identity_provider: 'idir',
        idir_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@idir',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isBceidBasicUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns true when bceid basic token information provided', () => {
      const keycloakUserInformation: BceidBasicUserInformation = {
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbasic',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbasic',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isBceidBasicUserInformation(keycloakUserInformation);

      expect(response).to.be.true;
    });

    it('returns false when bceid business token information provided', () => {
      const keycloakUserInformation: BceidBusinessUserInformation = {
        bceid_business_guid: '1122334455',
        bceid_business_name: 'Business Name',
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbusiness',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbusiness',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isBceidBasicUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns false when database token information provided', () => {
      const keycloakUserInformation: DatabaseUserInformation = {
        database_user_guid: '123456789',
        identity_provider: 'database',
        username: 'biohub_dapi_v1'
      };

      const response = isBceidBasicUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });
  });

  describe('isBceidBusinessUserInformation', () => {
    it('returns false when idir token information provided', () => {
      const keycloakUserInformation: IdirUserInformation = {
        idir_user_guid: '123456789',
        identity_provider: 'idir',
        idir_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@idir',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isBceidBusinessUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns false when bceid basic token information provided', () => {
      const keycloakUserInformation: BceidBasicUserInformation = {
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbasic',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbasic',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isBceidBusinessUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns true when bceid business token information provided', () => {
      const keycloakUserInformation: BceidBusinessUserInformation = {
        bceid_business_guid: '1122334455',
        bceid_business_name: 'Business Name',
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbusiness',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbusiness',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isBceidBusinessUserInformation(keycloakUserInformation);

      expect(response).to.be.true;
    });

    it('returns false when database token information provided', () => {
      const keycloakUserInformation: DatabaseUserInformation = {
        database_user_guid: '123456789',
        identity_provider: 'database',
        username: 'biohub_dapi_v1'
      };

      const response = isBceidBusinessUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });
  });

  describe('isDatabaseUserInformation', () => {
    it('returns false when idir token information provided', () => {
      const keycloakUserInformation: IdirUserInformation = {
        idir_user_guid: '123456789',
        identity_provider: 'idir',
        idir_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@idir',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isDatabaseUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns false when bceid basic token information provided', () => {
      const keycloakUserInformation: BceidBasicUserInformation = {
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbasic',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbasic',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isDatabaseUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns false when bceid business token information provided', () => {
      const keycloakUserInformation: BceidBusinessUserInformation = {
        bceid_business_guid: '1122334455',
        bceid_business_name: 'Business Name',
        bceid_user_guid: '123456789',
        identity_provider: 'bceidbusiness',
        bceid_username: 'tname',
        name: 'Test Name',
        preferred_username: '123456789@bceidbusiness',
        display_name: 'Test Name',
        email: 'email@email.com',
        email_verified: false,
        given_name: 'Test',
        family_name: ''
      };

      const response = isDatabaseUserInformation(keycloakUserInformation);

      expect(response).to.be.false;
    });

    it('returns true when database token information provided', () => {
      const keycloakUserInformation: DatabaseUserInformation = {
        database_user_guid: '123456789',
        identity_provider: 'database',
        username: 'biohub_dapi_v1'
      };

      const response = isDatabaseUserInformation(keycloakUserInformation);

      expect(response).to.be.true;
    });
  });

  describe('getServiceClientSystemUser', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns null if the clientId field is undefined', () => {
      const dbConstantsMock: dbConstants.DBConstants = { serviceClientUsers: [] };

      sinon.stub(dbConstants, 'getDBConstants').returns(dbConstantsMock);

      const token = { clientId: undefined, azp: 'not-null' };

      const response = getServiceClientSystemUser(token);

      expect(response).to.be.null;
    });

    it('returns null if the azp field is undefined', () => {
      const dbConstantsMock: dbConstants.DBConstants = { serviceClientUsers: [] };

      sinon.stub(dbConstants, 'getDBConstants').returns(dbConstantsMock);

      const token = { clientId: 'not-null', azp: undefined };

      const response = getServiceClientSystemUser(token);

      expect(response).to.be.null;
    });

    it('returns null if no matching known service client system user is found', () => {
      const dbConstantsMock: dbConstants.DBConstants = { serviceClientUsers: [] };

      sinon.stub(dbConstants, 'getDBConstants').returns(dbConstantsMock);

      const token = { clientId: 'not-null', azp: 'not-null' };

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

      const token = { clientId: 'known-service-client', azp: 'known-service-client' };

      const response = getServiceClientSystemUser(token);

      expect(response).to.eql(serviceClientSystemUser);
    });
  });
});
