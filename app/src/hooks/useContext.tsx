import { ConfigContext, IConfig } from 'contexts/configContext';
import { DialogContext, IDialogContext } from 'contexts/dialogContext';
import { IPolicyContext, PolicyContext } from 'contexts/policyContext';
import { ITicketContext, TicketContext } from 'contexts/ticketContext';
import { useContext } from 'react';

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
 * Returns an instance of `IPolicyContext` from `PolicyContext`.
 *
 * @return {*}  {IPolicyContext}
 */
export const usePolicyContext = (): IPolicyContext => {
  const context = useContext(PolicyContext);

  if (!context) {
    throw new Error(
      'PolicyContext is undefined, please verify you are calling usePolicyContext() as child of an <PolicyContextProvider> component.'
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
