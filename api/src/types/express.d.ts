import type { OpenAPIV3 } from 'openapi-types';
import type { SystemUserExtended } from '../models/system-user';
import type { AuthorizationScheme } from '../services/authorization/authorization-service';

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Multer transformed files.
     */
    files?: Express.Multer.File[];

    /**
     * Keycloak user JWT token object.
     */
    keycloak_token?: any;

    /**
     * SIMS system user details object.
     */
    system_user?: SystemUserExtended;

    /**
     * Authorization Scheme object.
     */
    authorization_scheme?: AuthorizationScheme;

    /**
     * Contributor id resolved during contributor authorization.
     */
    contributor_id?: number;

    /**
     * OpenAPI operation object injected by express-openapi.
     * Allows `x-express-openapi-validation-strict` to be accessed.
     */
    apiDoc?: OpenAPIV3.OperationObject & {
      'x-express-openapi-validation-strict'?: boolean;
    };
  }

  interface Response {
    /**
     * OpenAPI Response validation function injected by express-openapi
     */
    validateResponse?: (statusCode: number, responseBody: any) => { message: any; errors: any[] } | undefined;
  }
}
