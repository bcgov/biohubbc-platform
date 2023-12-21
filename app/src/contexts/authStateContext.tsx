import useBiohubUserWrapper, { IBiohubUserWrapper } from 'hooks/useBiohubUserWrapper';
import React from 'react';
import { AuthContextProps, useAuth } from 'react-oidc-context';

export interface IAuthState {
  /**
   * The logged in user's Keycloak information.
   *
   * @type {AuthContextProps}
   * @memberof IAuthState
   */
  auth: AuthContextProps;
  /**
   * The logged in user's SIMS user information.
   *
   * @type {IBiohubUserWrapper}
   * @memberof IAuthState
   */
  biohubUserWrapper: IBiohubUserWrapper;
}

export const AuthStateContext = React.createContext<IAuthState | undefined>(undefined);

/**
 * Provides access to user and authentication (keycloak) data about the logged in user.
 *
 * @param {*} props
 * @return {*}
 */
export const AuthStateContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const auth = useAuth();

  const biohubUserWrapper = useBiohubUserWrapper();

  return (
    <AuthStateContext.Provider
      value={{
        auth,
        biohubUserWrapper
      }}>
      {props.children}
    </AuthStateContext.Provider>
  );
};
