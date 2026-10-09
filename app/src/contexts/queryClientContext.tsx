import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useState } from 'react';
import { createAppQueryClient } from 'utils/query-client';

/**
 * Holds server state for one authentication identity. The owning auth boundary changes this component's key when
 * the identity changes, so pending requests and mutation callbacks retain their old client rather than writing into
 * the next identity's cache. Token refreshes preserve the component and its client.
 *
 * @param {PropsWithChildren} props The application providers and routes using this identity's cache.
 * @returns {JSX.Element} Children with an isolated query and mutation cache.
 */
export const QueryClientContextProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(createAppQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
