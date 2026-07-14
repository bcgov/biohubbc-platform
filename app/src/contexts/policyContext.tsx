import { useApi } from 'hooks/useApi';
import useDataLoader, { DataLoader } from 'hooks/useDataLoader';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

export interface IPolicyContext {
  policyId: string;
  policyDataLoader: DataLoader<[string], IPolicy, unknown>;
}

export const PolicyContext = React.createContext<IPolicyContext | undefined>(undefined);

/**
 * Reads and validates the route-level policy identifier.
 *
 * @returns Route policy identifier.
 */
const usePolicyIdFromRoute = (): string => {
  const { policyId } = useParams<{ policyId: string }>();

  if (!policyId) {
    throw new Error('Missing policyId route parameter');
  }

  return policyId;
};

/**
 * Provides policy route context for admin policy detail pages.
 *
 * @param {PropsWithChildren} props
 * @returns {*} Provider element.
 */
export const AdminPolicyContextProvider = ({ children }: PropsWithChildren) => {
  const api = useApi();
  const policyId = usePolicyIdFromRoute();
  const policyDataLoader = useDataLoader((id: string) => api.policies.getPolicy(id));

  useEffect(() => {
    policyDataLoader.refresh(policyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId]);

  const value = useMemo(
    () => ({
      policyId,
      policyDataLoader
    }),
    [policyId, policyDataLoader]
  );

  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
};
