import { MaterializedViewSecurityConfig } from '../types';

export const SECURITY_CONFIG: MaterializedViewSecurityConfig = {
  defaultExcludeAllSecured: true,
  securedWhitelist: [] // Empty means no secured data is included in secured views
};
