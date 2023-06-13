import axios from 'axios';
import { ACCESS_REQUEST_ADMIN_EMAIL, ACCESS_REQUEST_APPROVAL_ADMIN_EMAIL } from '../constants/notifications';
import { IDBConnection } from '../database/db';
import { ApiError, ApiErrorType, ApiGeneralError } from '../errors/api-error';
import { IgcNotifyGenericMessage, IgcNotifyPostReturn } from '../interfaces/gcnotify.interface';
import { AdministrativeRepository } from '../repositories/administrative-repository';
import { DBService } from './db-service';
import { KeycloakService } from './keycloak-service';
import { makeLoginUrl } from '../utils/string-utils';

const EMAIL_TEMPLATE = process.env.GCNOTIFY_ONBOARDING_REQUEST_EMAIL_TEMPLATE || '';
const SMS_TEMPLATE = process.env.GCNOTIFY_ONBOARDING_REQUEST_SMS_TEMPLATE || '';
const EMAIL_URL = process.env.GCNOTIFY_EMAIL_URL || '';
const SMS_URL = process.env.GCNOTIFY_SMS_URL || '';
const API_KEY = process.env.GCNOTIFY_SECRET_API_KEY || '';

const config = {
  headers: {
    Authorization: API_KEY,
    'Content-Type': 'application/json'
  }
};

export interface IGcNotifyArtifactRequestAccess {
  // TODO
}

export class GCNotifyService extends DBService {
  administrativeRepository: AdministrativeRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.administrativeRepository = new AdministrativeRepository(connection);
  }
  /**
   * Send email notification to recipient
   *
   *
   * @param {string} emailAddress
   * @param {IgcNotifyGenericMessage} message
   * @returns {IgcNotifyPostReturn}
   */
  async sendEmailGCNotification(emailAddress: string, message: IgcNotifyGenericMessage): Promise<IgcNotifyPostReturn> {
    const data = {
      email_address: emailAddress,
      template_id: EMAIL_TEMPLATE,
      personalisation: {
        subject: message.subject,
        header: message.header,
        main_body1: message.body1,
        main_body2: message.body2,
        footer: message.footer
      }
    };

    const response = await axios.post(EMAIL_URL, data, config);

    const result = (response && response.data) || null;

    if (!result) {
      throw new ApiError(ApiErrorType.UNKNOWN, 'Failed to send Notification');
    }

    return result;
  }

  async sendNotificationForArtifactRequestAccess(requestData: IGcNotifyArtifactRequestAccess): Promise<boolean> {
    const url = makeLoginUrl(process.env.APP_HOST, requestData.pathToParent);
    const hrefUrl = `[${resubmitData.parentName}](${url})`;

    const message: IgcNotifyRequestRemovalMessage = {
      subject: '',
      header: '',
      date: new Date().toLocaleString(),
      file_name: resubmitData.fileName,
      link: hrefUrl,
      description: resubmitData.formValues.description,
      full_name: resubmitData.formValues.full_name,
      email: resubmitData.formValues.email_address,
      phone: resubmitData.formValues.phone_number
    };

    const submitterMessage: IgcNotifyRequestRemovalMessage = {
      ...message,
      subject: 'Species Inventory Management System - Your Request to Remove or Resubmit Has Been Sent',
      header: `Your request to remove or resubmit data has been sent.

      A BioHub Administrator should be in contact with you shortly to discuss your request.`
    };

    const adminMessage: IgcNotifyRequestRemovalMessage = {
      ...message,
      subject: 'Species Inventory Management System -  Request to Remove or Resubmit',
      header: ''
    };

    const submitterEmailResponse = await this.requestRemovalEmailNotification(
      resubmitData.formValues.email_address,
      submitterMessage
    );
    const adminEmailResponse = await this.requestRemovalEmailNotification(adminEmail, adminMessage);

    if (!submitterEmailResponse || !adminEmailResponse) {
      throw new ApiError(ApiErrorType.UNKNOWN, 'Failed to send Notification');
    }

    return Boolean(submitterEmailResponse && adminEmailResponse);
  }

  /**
   * Send sms notification to recipient
   *
   *
   * @param {string} sms
   * @param {IgcNotifyGenericMessage} message
   * @returns {IgcNotifyPostReturn}
   */
  async sendPhoneNumberGCNotification(sms: string, message: IgcNotifyGenericMessage): Promise<IgcNotifyPostReturn> {
    const data = {
      phone_number: sms,
      template_id: SMS_TEMPLATE,
      personalisation: {
        header: message.header,
        main_body1: message.body1,
        main_body2: message.body2,
        footer: message.footer
      }
    };

    const response = await axios.post(SMS_URL, data, config);

    const result = (response && response.data) || null;

    if (!result) {
      throw new ApiError(ApiErrorType.UNKNOWN, 'Failed to send Notification');
    }

    return result;
  }

  /**
   * Check if access request is approved, then send Approval email
   *
   * @param {number} adminActivityTypeId
   * @param {string} userIdentifier
   * @param {string} identitySource
   * @memberof GCNotifyService
   */
  async sendApprovalEmail(adminActivityTypeId: number, userIdentifier: string, identitySource: string) {
    if (await this.administrativeRepository.checkIfAccessRequestIsApproval(adminActivityTypeId)) {
      const userEmail = await this.getUserKeycloakEmail(userIdentifier, identitySource);
      this.sendAccessRequestApprovalEmail(userEmail);
    }
  }

  /**
   * Get users email from username and identity source
   *
   * @param {string} userIdentifier
   * @param {string} identitySource
   * @return {*}  {Promise<string>}
   * @memberof GCNotifyService
   */
  async getUserKeycloakEmail(userIdentifier: string, identitySource: string): Promise<string> {
    const keycloakService = new KeycloakService();
    const userDetails = await keycloakService.getUserByUsername(`${userIdentifier}@${identitySource}`);
    return userDetails.email;
  }

  /**
   * Send Approval Email
   *
   * @param {string} userEmail
   * @memberof GCNotifyService
   */
  async sendAccessRequestApprovalEmail(userEmail: string) {
    const APP_HOST = process.env.APP_HOST;
    const NODE_ENV = process.env.NODE_ENV;

    const url = `${APP_HOST}/`;
    const hrefUrl = `[click here.](${url})`;
    try {
      await this.sendEmailGCNotification(userEmail, {
        ...ACCESS_REQUEST_APPROVAL_ADMIN_EMAIL,
        subject: `${NODE_ENV}: ${ACCESS_REQUEST_APPROVAL_ADMIN_EMAIL.subject}`,
        body1: `${ACCESS_REQUEST_APPROVAL_ADMIN_EMAIL.body1} ${hrefUrl}`,
        footer: `${APP_HOST}`
      });
    } catch (error) {
      throw new ApiGeneralError('Failed to send gcNotification approval email', [(error as Error).message]);
    }
  }

  /**
   * Send Email that Access Request has been received
   *
   * @memberof GCNotifyService
   */
  async sendAccessRequestReceivedEmail() {
    const ADMIN_EMAIL = process.env.GCNOTIFY_ADMIN_EMAIL || '';
    const APP_HOST = process.env.APP_HOST;
    const NODE_ENV = process.env.NODE_ENV;

    const url = `${APP_HOST}/admin/users?authLogin=true`;
    const hrefUrl = `[click here.](${url})`;
    this.sendEmailGCNotification(ADMIN_EMAIL, {
      ...ACCESS_REQUEST_ADMIN_EMAIL,
      subject: `${NODE_ENV}: ${ACCESS_REQUEST_ADMIN_EMAIL.subject}`,
      body1: `${ACCESS_REQUEST_ADMIN_EMAIL.body1} ${hrefUrl}`,
      footer: `${APP_HOST}`
    });
  }
}
