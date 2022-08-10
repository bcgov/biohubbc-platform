import { SYSTEM_ROLE } from 'constants/roles';
import { AuthStateContext } from 'contexts/authStateContext';
import React, { isValidElement, ReactElement, useContext } from 'react';
import { PropsWithChildren } from 'react';
import { isAuthenticated } from 'utils/authUtils';

interface IGuardProps<T = never> extends PropsWithChildren {
  /**
   * An optional backup ReactElement to render if the guard fails.
   *
   * @memberof IGuardProps
   */
  fallback?: ((...args: T[]) => ReactElement) | ReactElement;
}

/**
 * Renders `props.children` only if the user is NOT authenticated and has none of the specified valid system roles
 *
 * @param {*} props
 * @return {*}
 */
export const NoRoleGuard: React.FC<React.PropsWithChildren<{ validSystemRoles: SYSTEM_ROLE[] } & IGuardProps>> = (props) => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  const hasSystemRole = keycloakWrapper?.hasSystemRole(props.validSystemRoles);

  if (!hasSystemRole) {
    // User has no matching system role
    return <>{props.children}</>;
  }

  // User has matching system role
  if (props.fallback) {
    if (isValidElement(props.fallback)) {
      return <>{props.fallback}</>;
    }

    return props.fallback();
  }

  return <></>;
};

/**
 * Renders `props.children` only if the user is authenticated and has at least 1 of the specified valid system roles.
 *
 * @param {*} props
 * @return {*}
 */
export const SystemRoleGuard: React.FC<React.PropsWithChildren<{ validSystemRoles: SYSTEM_ROLE[] } & IGuardProps>> = (props) => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  const hasSystemRole = keycloakWrapper?.hasSystemRole(props.validSystemRoles);

  if (hasSystemRole) {
    // User has a matching system role
    return <>{props.children}</>;
  }

  // User has no matching system role
  if (props.fallback) {
    if (isValidElement(props.fallback)) {
      return <>{props.fallback}</>;
    }

    return props.fallback();
  }

  return <></>;
};

/**
 * Renders `props.children` only if the user is authenticated (logged in).
 *
 * @param {*} props
 * @return {*}
 */
export const AuthGuard: React.FC<React.PropsWithChildren<IGuardProps>> = (props) => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  if (isAuthenticated(keycloakWrapper)) {
    // User is logged in
    return <>{props.children}</>;
  }

  // User is not logged in
  if (props.fallback) {
    if (isValidElement(props.fallback)) {
      return <>{props.fallback}</>;
    }

    return props.fallback();
  }

  return <></>;
};

/**
 * Renders `props.children` only if the user is not authenticated (logged in).
 *
 * @param {*} props
 * @return {*}
 */
export const UnAuthGuard: React.FC<React.PropsWithChildren<IGuardProps>> = (props) => {
  const { keycloakWrapper } = useContext(AuthStateContext);

  if (!isAuthenticated(keycloakWrapper)) {
    // User is not logged in
    return <>{props.children}</>;
  }

  // User is logged in
  if (props.fallback) {
    if (isValidElement(props.fallback)) {
      return <>{props.fallback}</>;
    }

    return props.fallback();
  }

  return <></>;
};
