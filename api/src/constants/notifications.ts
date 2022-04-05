import { IgcNotifyGenericMessage } from '../interfaces/gcnotify.interface';

//admin email template for new access requests
export const ACCESS_REQUEST_ADMIN_EMAIL: IgcNotifyGenericMessage = {
  subject: 'BioHub: A request for access has been received.',
  header: 'A request for access to the BioHub Data Aggregator System has been submitted.',
  body1: `To review the request,`,
  body2: 'This is an automated message from the BioHub BioHub Data Aggregator System',
  footer: ''
};

//admin email template for approval of access requests
export const ACCESS_REQUEST_APPROVAL_ADMIN_EMAIL: IgcNotifyGenericMessage = {
  subject: 'BioHub: Your request for access has been approved.',
  header: 'Your request for access to the BioHub Data Aggregator System has been approved.',
  body1: `To access the site, `,
  body2: 'This is an automated message from the BioHub BioHub Data Aggregator System',
  footer: ''
};
