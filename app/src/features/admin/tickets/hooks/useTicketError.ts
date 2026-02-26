import { useState } from 'react';

/**
 * Shared page-level error state for ticket detail actions.
 *
 * @return {*}
 */
export const useTicketError = () => {
  const [error, setError] = useState<string | undefined>();

  return {
    error,
    setError
  };
};

