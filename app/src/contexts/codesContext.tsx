import useCodes, { IUseCodes } from 'hooks/useCodes';
import React from 'react';

export type ICodesContext = IUseCodes;

export const CodesContext = React.createContext<ICodesContext>({ codes: undefined, isLoading: false, isReady: false });

/**
 * Context that fetches app code sets and provides them to all children.
 *
 * @param {*} props
 * @return {*}
 */
export const CodesContextProvider: React.FC = (props) => {
  const codes = useCodes();

  return <CodesContext.Provider value={codes}>{props.children}</CodesContext.Provider>;
};
