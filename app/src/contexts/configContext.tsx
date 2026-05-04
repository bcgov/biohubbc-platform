import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ensureProtocol } from 'utils/Utils';

export interface IConfig {
  API_HOST: string;
  CHANGE_VERSION: string;
  NODE_ENV: string;
  VITE_NODE_ENV: string;
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

export const ConfigContext = React.createContext<IConfig | undefined>({
  API_HOST: '',
  CHANGE_VERSION: '',
  NODE_ENV: '',
  VITE_NODE_ENV: '',
  VERSION: '',
  KEYCLOAK_CONFIG: {
    authority: '',
    realm: '',
    clientId: ''
  },
  SITEMINDER_LOGOUT_URL: '',
  MAX_UPLOAD_NUM_FILES: 10,
  MAX_UPLOAD_FILE_SIZE: 52428800,
  MAX_UPLOAD_TARBALL_SIZE: 10737418240,
  MAX_TICKET_ATTACHMENT_FILE_SIZE: 15728640
});

/**
 * Return the app config based on locally set environment variables.
 *
 * @return {*}  {IConfig}
 */
const getLocalConfig = (): IConfig => {
  const API_HOST = import.meta.env.VITE_API_HOST;
  const API_PORT = import.meta.env.VITE_API_PORT;

  const API_URL = (API_PORT && `${API_HOST}:${API_PORT}`) || API_HOST || 'localhost';

  return {
    API_HOST: ensureProtocol(API_URL, 'http://'),
    CHANGE_VERSION: import.meta.env.CHANGE_VERSION || 'NA',
    NODE_ENV: import.meta.env.NODE_ENV,
    VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV || 'dev',
    VERSION: `${import.meta.env.VERSION || 'NA'}(build #${import.meta.env.CHANGE_VERSION || 'NA'})`,
    KEYCLOAK_CONFIG: {
      authority: import.meta.env.VITE_KEYCLOAK_HOST || '',
      realm: import.meta.env.VITE_KEYCLOAK_REALM || '',
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || ''
    },
    SITEMINDER_LOGOUT_URL: import.meta.env.VITE_SITEMINDER_LOGOUT_URL || '',
    MAX_UPLOAD_NUM_FILES: Number(import.meta.env.VITE_MAX_UPLOAD_NUM_FILES) || 10,
    MAX_UPLOAD_FILE_SIZE: Number(import.meta.env.VITE_MAX_UPLOAD_FILE_SIZE) || 52428800,
    MAX_UPLOAD_TARBALL_SIZE: Number(import.meta.env.VITE_MAX_UPLOAD_TARBALL_SIZE) || 10737418240,
    MAX_TICKET_ATTACHMENT_FILE_SIZE: Number(import.meta.env.VITE_MAX_TICKET_ATTACHMENT_FILE_SIZE) || 15728640
  };
};

/**
 * Return the app config based on a deployed app, running via `app/server/index.js`
 *
 * @return {*}  {Promise<IConfig>}
 */
const getDeployedConfig = async (): Promise<IConfig> => {
  const { data } = await axios.get<IConfig>('/config');

  return data;
};

/**
 * Return true if NODE_ENV=development, false otherwise.
 *
 * @return {*}  {boolean}
 */
const isDevelopment = (): boolean => {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
};

/**
 * Provides environment variables.
 *
 * This will fetch env vars from either `process.env` if running with NODE_ENV=development, or from
 * `app/server/index.js` if running as a deployed NODE_ENV=production build.
 *
 * @param {*} props
 * @return {*}
 */
export const ConfigContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const [config, setConfig] = useState<IConfig>();

  useEffect(() => {
    const loadConfig = async () => {
      if (isDevelopment()) {
        const localConfig = getLocalConfig();
        setConfig(localConfig);
      } else {
        const deployedConfig = await getDeployedConfig();
        setConfig(deployedConfig);
      }
    };

    if (!config) {
      loadConfig();
    }
  }, [config]);
  return <ConfigContext.Provider value={config}>{props.children}</ConfigContext.Provider>;
};
