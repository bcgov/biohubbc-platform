import { ensureProtocol } from 'utils/Utils';

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
}

export const getConfig = (): IConfig => {
  const {
    VITE_API_HOST,
    VITE_API_PORT,
    VITE_CHANGE_VERSION,
    VITE_NODE_ENV,
    VITE_VERSION,
    VITE_KEYCLOAK_HOST,
    VITE_KEYCLOAK_REALM,
    VITE_KEYCLOAK_CLIENT_ID,
    VITE_SITEMINDER_LOGOUT_URL,
    VITE_MAX_UPLOAD_NUM_FILES,
    VITE_MAX_UPLOAD_FILE_SIZE
  } = import.meta.env;

  const API_URL = VITE_API_PORT ? `${VITE_API_HOST}:${VITE_API_PORT}` : VITE_API_HOST;

  return {
    API_HOST: ensureProtocol(API_URL, 'http://'),
    CHANGE_VERSION: VITE_CHANGE_VERSION || 'unknown',
    NODE_ENV: VITE_NODE_ENV || 'development',
    VERSION: `${VITE_VERSION || 'NA'} (build #${VITE_CHANGE_VERSION || 'N/A'})`,
    KEYCLOAK_CONFIG: {
      authority: VITE_KEYCLOAK_HOST,
      realm: VITE_KEYCLOAK_REALM,
      clientId: VITE_KEYCLOAK_CLIENT_ID
    },
    SITEMINDER_LOGOUT_URL: VITE_SITEMINDER_LOGOUT_URL || '',
    MAX_UPLOAD_NUM_FILES: Number(VITE_MAX_UPLOAD_NUM_FILES) || 5,
    MAX_UPLOAD_FILE_SIZE: Number(VITE_MAX_UPLOAD_FILE_SIZE) || 10 * 1024 * 1024 // Default 10MB
  };
};
