import axios from 'axios';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiError } from '../errors/api-error';
import { IgcNotifyGenericMessage } from '../interfaces/gcnotify.interface';
import { Artifact } from '../repositories/artifact-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { ArtifactService } from './artifact-service';
import { GCNotifyService, ISubmitArtifactRequestAccess } from './gcnotify-service';

chai.use(sinonChai);

describe('GCNotifyService', () => {
  describe('sendEmailGCNotification', () => {
    afterEach(() => {
      sinon.restore();
    });

    const emailAddress = 'test@email.com';

    const message = {
      subject: 'message.subject',
      header: 'message.header',
      body1: 'message.body1',
      body2: 'message.body2',
      footer: 'message.footer'
    };

    it('should throw a 400 error when no email is given', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      sinon.stub(axios, 'post').resolves({ data: null });

      try {
        await gcNotifyServiece.sendEmailGCNotification('', message);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should throw a 400 error when no data is given', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      sinon.stub(axios, 'post').resolves({ data: null });

      try {
        await gcNotifyServiece.sendEmailGCNotification(emailAddress, message);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should not throw an error on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      sinon.stub(axios, 'post').resolves({ data: 201 });

      const result = await gcNotifyServiece.sendEmailGCNotification(emailAddress, {} as IgcNotifyGenericMessage);

      expect(result).to.eql(201);
    });
  });

  describe('sendNotificationForArtifactRequestAccess', () => {
    beforeEach(() => {
      sinon
        .stub(ArtifactService.prototype, 'getArtifactsByIds')
        .resolves([{ artifact_id: 1 }, { artifact_id: 2 }] as Artifact[]);
    });

    afterEach(() => {
      sinon.restore();
    });

    const mockRequestData: ISubmitArtifactRequestAccess = {
      fullName: 'name',
      emailAddress: 'email',
      phoneNumber: '2505551234',
      reasonDescription: 'reason',
      hasSignedAgreement: false,
      artifactIds: [1, 2],
      pathToParent: 'path',
      companyInformation: {
        companyName: 'company',
        jobTitle: 'job',
        streetAddress: 'address',
        city: 'city',
        postalCode: 'postal'
      },
      professionalOrganization: {
        organizationName: 'org',
        memberNumber: 'member'
      }
    };

    it('should throw a 400 error when submitter email response is empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      const axiosStub = sinon.stub(axios, 'post');
      axiosStub.onFirstCall().resolves({ data: null });
      axiosStub.onSecondCall().resolves({ data: true });

      try {
        await gcNotifyServiece.sendNotificationForArtifactRequestAccess(mockRequestData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should throw a 400 error when admin email response is empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      const axiosStub = sinon.stub(axios, 'post');
      axiosStub.onFirstCall().resolves({ data: true });
      axiosStub.onSecondCall().resolves({ data: null });

      try {
        await gcNotifyServiece.sendNotificationForArtifactRequestAccess(mockRequestData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should return false if submitter response is false', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      const axiosStub = sinon.stub(axios, 'post');
      axiosStub.onFirstCall().resolves({ data: false });
      axiosStub.onSecondCall().resolves({ data: true });

      try {
        await gcNotifyServiece.sendNotificationForArtifactRequestAccess(mockRequestData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should return false if admin response is false', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      const axiosStub = sinon.stub(axios, 'post');
      axiosStub.onFirstCall().resolves({ data: true });
      axiosStub.onSecondCall().resolves({ data: false });

      try {
        await gcNotifyServiece.sendNotificationForArtifactRequestAccess(mockRequestData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should not throw an error on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      const axiosStub = sinon.stub(axios, 'post');
      axiosStub.onFirstCall().resolves({ data: true });
      axiosStub.onSecondCall().resolves({ data: true });

      const result = await gcNotifyServiece.sendNotificationForArtifactRequestAccess(mockRequestData);

      expect(result).to.eql(true);
    });
  });

  describe('sendPhoneNumberGCNotification', () => {
    afterEach(() => {
      sinon.restore();
    });

    const sms = '2501231234';

    const message = {
      subject: 'message.subject',
      header: 'message.header',
      body1: 'message.body1',
      body2: 'message.body2',
      footer: 'message.footer'
    };

    it('should throw a 400 error when no phone number is given', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      sinon.stub(axios, 'post').resolves({ data: null });

      try {
        await gcNotifyServiece.sendPhoneNumberGCNotification('', message);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should throw a 400 error when no data is given', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      sinon.stub(axios, 'post').resolves({ data: null });

      try {
        await gcNotifyServiece.sendPhoneNumberGCNotification(sms, message);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiError).message).to.equal('Failed to send Notification');
      }
    });

    it('should not throw an error on success', async () => {
      const mockDBConnection = getMockDBConnection();
      const gcNotifyServiece = new GCNotifyService(mockDBConnection);

      sinon.stub(axios, 'post').resolves({ data: 201 });

      const result = await gcNotifyServiece.sendPhoneNumberGCNotification(sms, {} as IgcNotifyGenericMessage);

      expect(result).to.eql(201);
    });
  });
});
