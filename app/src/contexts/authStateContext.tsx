import useBiohubUserWrapper from 'hooks/useBiohubUserWrapper';
import React, { useMemo } from 'react';
import { AuthContextProps, useAuth } from 'react-oidc-context';

export interface IAuthState {
  auth: AuthContextProps;
  biohubUserWrapper: ReturnType<typeof useBiohubUserWrapper>;
}

export const AuthStateContext = React.createContext<IAuthState | undefined>(undefined);

export const AuthStateContextProvider: React.FC<React.PropsWithChildren> = (props) => {
  const auth = useAuth();
  const biohubUserWrapper = useBiohubUserWrapper();

  const contextValue = useMemo(() => {
    return {
      auth,
      biohubUserWrapper
    };
  }, [auth, biohubUserWrapper]);

  return <AuthStateContext.Provider value={contextValue}>{props.children}</AuthStateContext.Provider>;
};
