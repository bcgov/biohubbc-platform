import { CodesContext, ICodesContext } from 'contexts/codesContext';
import { useContext } from 'react';
import { ISubmissionContext, SubmissionContext } from '../contexts/submissionContext';

/**
 * Returns an instance of `ISubmissionContext` from `SubmissionContext`.
 *
 * @return {*}  {ISubmissionContext}
 */
export const useSubmissionContext = (): ISubmissionContext => {
  const context = useContext(SubmissionContext);

  if (!context) {
    throw Error(
      'SubmissionContext is undefined, please verify you are calling useSubmissionContext() as child of an <SubmissionContextProvider> component.'
    );
  }

  return context;
};

/**
 * Returns an instance of `ICodesContext` from `CodesContext`.
 *
 * @return {*}  {ICodesContext}
 */
export const useCodesContext = (): ICodesContext => {
  const context = useContext(CodesContext);

  if (!context) {
    throw Error(
      'CodesContext is undefined, please verify you are calling useCodesContext() as child of an <CodesContextProvider> component.'
    );
  }

  return context;
};
