export interface IConfig {
  API_HOST: string;
  CHANGE_VERSION: string;
  NODE_ENV: string;
  VERSION: string;
  KEYCLOAK_CONFIG: {
    authority: string;
    realm: string;
    clientId: string;
  };
  SITEMINDER_LOGOUT_URL: string;
  MAX_UPLOAD_NUM_FILES: number;
  MAX_UPLOAD_FILE_SIZE: number;
  MAX_UPLOAD_TARBALL_SIZE: number;
  MAX_TICKET_ATTACHMENT_FILE_SIZE: number;
}
