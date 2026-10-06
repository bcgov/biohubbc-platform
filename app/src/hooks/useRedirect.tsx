import { useCallback, useMemo } from 'react';
import { buildUrl } from 'utils/Utils';
import { useUrlQueryParams } from './useUrlQueryParams';

interface Redirect {
  redirectUri: string | undefined;
  redirect: () => void;
}

export default function useRedirect(fallbackUri: string): Redirect {
  const redirectUri = useRedirectUri(fallbackUri);

  const redirect = useCallback(() => {
    if (redirectUri) {
      window.location.replace(redirectUri);
    }
  }, [redirectUri]);

  return { redirectUri, redirect };
}

export function useRedirectUri(fallbackUri: string) {
  const queryParams = useUrlQueryParams();

  const redirectUri = useMemo(
    () =>
      queryParams['redirect']
        ? buildUrl(window.location.origin, decodeURIComponent(queryParams['redirect']))
        : fallbackUri,
    [fallbackUri, queryParams]
  );

  return redirectUri;
}
