import React, { PropsWithChildren, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';

export interface IPolicyContext {
  policyId: string;
  /** Key of the policy detail query; components read it with `usePolicyQuery` and invalidate it after saved changes. */
  policyQueryKey: ReturnType<typeof policyQueryKeys.detail>;
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
 * Provides the route's policy id, and the key its detail is cached under, to admin policy detail pages.
 *
 * @param {PropsWithChildren} props
 * @returns {*} Provider element.
 */
export const AdminPolicyContextProvider = ({ children }: PropsWithChildren) => {
  const policyId = usePolicyIdFromRoute();
  const value = useMemo(() => ({ policyId, policyQueryKey: policyQueryKeys.detail(policyId) }), [policyId]);

  // A different record owns different drafts and dialogs; pending saves retain the previous instance.
  return (
    <PolicyContext.Provider key={policyId} value={value}>
      {children}
    </PolicyContext.Provider>
  );
};
