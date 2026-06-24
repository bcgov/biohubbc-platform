import { CodesContext, ICodesContext } from 'contexts/codesContext';
import { ConfigContext, IConfig } from 'contexts/configContext';
import { DialogContext, IDialogContext } from 'contexts/dialogContext';
import { IPolicyAutocompleteContext, PolicyAutocompleteContext } from 'contexts/policyAutocompleteContext';
import { ITicketContext, TicketContext } from 'contexts/ticketContext';
import { useContext } from 'react';
import { ISubmissionContext, SubmissionContext } from '../contexts/submissionContext';

/**
 * Returns an instance of `IConfig` from `ConfigContext`.
 *
 * @return {*}  {IConfig}
 */
export const useConfigContext = (): IConfig => {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error(
      'ConfigContext is undefined, please verify you are calling useConfigContext() as child of an <ConfigContextProvider> component.'
    );
  }

  return context;
};

/**
 * Returns an instance of `ISubmissionContext` from `SubmissionContext`.
 *
 * @return {*}  {ISubmissionContext}
 */
export const useSubmissionContext = (): ISubmissionContext => {
  const context = useContext(SubmissionContext);

  if (!context) {
    throw new Error(
      'SubmissionContext is undefined, please verify you are calling useSubmissionContext() as child of an <SubmissionContextProvider> component.'
    );
  }

  return context;
};

/**
 * Returns an instance of `ITicketContext` from `TicketContext`.
 *
 * @return {*}  {ITicketContext}
 */
export const useTicketContext = (): ITicketContext => {
  const context = useContext(TicketContext);

  if (!context) {
    throw new Error(
      'TicketContext is undefined, please verify you are calling useTicketContext() as child of an <TicketContextProvider> component.'
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
    throw new Error(
      'CodesContext is undefined, please verify you are calling useCodesContext() as child of an <CodesContextProvider> component.'
    );
  }

  return context;
};

export const useDialogContext = (): IDialogContext => {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error(
      'DialogContext2 is undefined, please verify you are calling useDialogContext() as child of an <DialogContextProvider2> component.'
    );
  }

  return context;
};

/**
 * Returns an instance of `IPolicyAutocompleteContext` from `PolicyAutocompleteContext`.
 *
 * @return {*}  {IPolicyAutocompleteContext}
 */
export const usePolicyAutocompleteContext = (): IPolicyAutocompleteContext => {
  const context = useContext(PolicyAutocompleteContext);

  if (!context) {
    throw new Error(
      'PolicyAutocompleteContext is undefined, please verify you are calling usePolicyAutocompleteContext() as child of a <PolicyAutocompleteContextProvider> component.'
    );
  }

  return context;
};
