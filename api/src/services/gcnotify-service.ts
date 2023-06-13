import axios, { AxiosRequestConfig } from 'axios';
import { ACCESS_REQUEST_ADMIN_EMAIL, ACCESS_REQUEST_APPROVAL_ADMIN_EMAIL } from '../constants/notifications';
import { IDBConnection } from '../database/db';
import { ApiError, ApiErrorType, ApiGeneralError } from '../errors/api-error';
import { IgcNotifyGenericMessage, IgcNotifyPostReturn } from '../interfaces/gcnotify.interface';
import { AdministrativeRepository } from '../repositories/administrative-repository';
import { DBService } from './db-service';
import { KeycloakService } from './keycloak-service';
import { formatPhoneNumber, makeLoginUrl } from '../utils/string-utils';

const GC_NOTIFY_REQUEST_ACCESS_SECURE_DOCUMENTS = '4bb42a76-f79b-424f-ad0f-ad3671389ec2'; // @TODO

export interface IGcNotifyArtifactRequestAccess {
  fullName: string;
  emailAddress: string;
  phoneNumber: string;
  reasonDescription: string;
  hasSignedAgreement: boolean;
  requestedDocuments: string[];
  pathToParent: string;
}

export class GCNotifyService extends DBService {
  administrativeRepository: AdministrativeRepository;
  axiosConfig: AxiosRequestConfig;
  EMAIL_TEMPLATE: string;
  SMS_TEMPLATE: string;
  EMAIL_URL: string;
  SMS_URL: string;
  API_KEY: string;
  APP_HOST: string;
  adminEmail: string;

  constructor(connection: IDBConnection) {
    super(connection);
    this.administrativeRepository = new AdministrativeRepository(connection);

    this.EMAIL_TEMPLATE = process.env.GCNOTIFY_ONBOARDING_REQUEST_EMAIL_TEMPLATE || '';
    this.SMS_TEMPLATE = process.env.GCNOTIFY_ONBOARDING_REQUEST_SMS_TEMPLATE || '';
    this.EMAIL_URL = process.env.GCNOTIFY_EMAIL_URL || '';
    this.SMS_URL = process.env.GCNOTIFY_SMS_URL || '';
    this.API_KEY = process.env.GCNOTIFY_SECRET_API_KEY || '';
    this.APP_HOST = process.env.APP_HOST || '';
    this.adminEmail = process.env.GCNOTIFY_ADMIN_EMAIL || '';
  
    this.axiosConfig = {
      headers: {
        Authorization: this.API_KEY,
        'Content-Type': 'application/json'
      }
    };
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
      template_id: this.EMAIL_TEMPLATE,
      personalisation: {
        subject: message.subject,
        header: message.header,
        main_body1: message.body1,
        main_body2: message.body2,
        footer: message.footer
      }
    };

    const response = await axios.post(this.EMAIL_URL, data, this.axiosConfig);

    const result = (response && response.data) || null;

    if (!result) {
      throw new ApiError(ApiErrorType.UNKNOWN, 'Failed to send Notification');
    }

    return result;
  }

  async sendNotificationForArtifactRequestAccess(requestData: IGcNotifyArtifactRequestAccess): Promise<boolean> {
    const url = makeLoginUrl(this.APP_HOST, requestData.pathToParent);
    const link = `[${requestData.pathToParent}](${url})`;
    const email = `[${requestData.emailAddress}](mailto:${requestData.emailAddress})`;
    const phone = `[${formatPhoneNumber(requestData.phoneNumber)}](tel:${requestData.phoneNumber.replace(/\D/g,'')}`

    const baseMessage = {
      subject: '',
      header: '',
      date: new Date().toLocaleString(),
      reason_description: requestData.reasonDescription,
      link,
      full_name: requestData.fullName,
      email,
      phone
    };

    const submitterMessage = {
      ...baseMessage,
      subject: 'Species Inventory Management System - Your Request to Access Secure Documents Has Been Sent',
      header: `Your request to access secure documents has been sent.

      A BioHub Administrator should be in contact with you shortly to discuss your request.`
    };

    const adminMessage = {
      ...baseMessage,
      subject: 'Species Inventory Management System - Request to Access Secure Documents',
      header: 'A request to access secured documents has been submitted.'
    };

    const submitterEmailResponse = await axios.post(
      this.EMAIL_URL,
      {
        email_address: requestData.emailAddress,
        template_id: GC_NOTIFY_REQUEST_ACCESS_SECURE_DOCUMENTS,
        personalisation: submitterMessage
      },
      this.axiosConfig
    );

    const adminEmailResponse = await axios.post(
      this.EMAIL_URL,
      {
        email_address: this.adminEmail,
        template_id: GC_NOTIFY_REQUEST_ACCESS_SECURE_DOCUMENTS,
        personalisation: adminMessage
      },
      this.axiosConfig
    );

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
      template_id: this.SMS_TEMPLATE,
      personalisation: {
        header: message.header,
        main_body1: message.body1,
        main_body2: message.body2,
        footer: message.footer
      }
    };

    const response = await axios.post(this.SMS_URL, data, this.axiosConfig);

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
