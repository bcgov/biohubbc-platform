/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_API_HOST: string;
  VITE_API_PORT: string;
  VITE_KEYCLOAK_HOST: string;
  VITE_KEYCLOAK_REALM: string;
  VITE_KEYCLOAK_CLIENT_ID: string;
  VITE_SITEMINDER_LOGOUT_URL: string;
  VITE_MAX_UPLOAD_NUM_FILES: string;
  VITE_MAX_UPLOAD_FILE_SIZE: string;
  VITE_MAX_UPLOAD_TARBALL_SIZE: string;
  VITE_MAX_TICKET_ATTACHMENT_FILE_SIZE: string;
  VITE_NODE_ENV: string;
  VERSION: string;
  CHANGE_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
