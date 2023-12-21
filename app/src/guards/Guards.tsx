import { SYSTEM_ROLE } from 'constants/roles';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { isFunction } from 'lodash-es';
import { isValidElement, PropsWithChildren, ReactElement } from 'react';
import { hasAtLeastOneValidValue } from 'utils/authUtils';

interface IGuardProps<T = never> extends PropsWithChildren {
  /**
   * An optional backup ReactElement to render if the guard fails.
   *
   * @memberof IGuardProps
   */
  fallback?: ((...args: T[]) => ReactElement) | ReactElement;
}

/**
 * Renders `props.children` only if the user is authenticated and has at least 1 of the specified valid system roles.
 *
 * @param {(PropsWithChildren<{ validSystemRoles: SYSTEM_ROLE[] } & IGuardProps)} props
 * @return {*}
 */
export const SystemRoleGuard = (props: PropsWithChildren<{ validSystemRoles: SYSTEM_ROLE[] } & IGuardProps>) => {
  const authStateContext = useAuthStateContext();
  const { validSystemRoles } = props;

  const hasSystemRole = hasAtLeastOneValidValue(validSystemRoles, authStateContext.biohubUserWrapper.roleNames);

  if (hasSystemRole) {
    // User has a matching system role
    return <>{props.children}</>;
  }

  // User has no matching system role
  if (props.fallback) {
    if (isValidElement(props.fallback)) {
      return <>{props.fallback}</>;
    } else if (isFunction(props.fallback)) {
      return props.fallback();
    }
  }

  return <></>;
};

/**
 * Renders `props.children` only if the user is authenticated (logged in).
 *
 * @param {*} props
 * @return {*}
 */
export const AuthGuard: React.FC<PropsWithChildren<IGuardProps>> = (props) => {
  const authStateContext = useAuthStateContext();

  if (authStateContext.auth.isAuthenticated) {
    // User is logged in
    return <>{props.children}</>;
  }

  // User is not logged in
  if (props.fallback) {
    if (isValidElement(props.fallback)) {
      return <>{props.fallback}</>;
    } else if (isFunction(props.fallback)) {
      return props.fallback();
    }
  }

  return <></>;
};

/**
 * Renders `props.children` only if the user is not authenticated (logged in).
 *
 * @param {*} props
 * @return {*}
 */
export const UnAuthGuard: React.FC<PropsWithChildren<IGuardProps>> = (props) => {
  const authStateContext = useAuthStateContext();

  if (!authStateContext.auth.isAuthenticated) {
    // User is not logged in
    return <>{props.children}</>;
  }

  // User is logged in
  if (props.fallback) {
    if (isValidElement(props.fallback)) {
      return <>{props.fallback}</>;
    } else if (isFunction(props.fallback)) {
      return props.fallback();
    }
  }

  return <></>;
};
