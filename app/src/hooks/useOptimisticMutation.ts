import { useCallback, useRef } from 'react';

export interface IOptimisticMutationContext<TState> {
  currentState: TState;
  optimisticState: TState;
}

export interface IOptimisticMutationSetup<TState> {
  getData: () => TState;
  setData: (nextState: TState) => void;
}

export interface IOptimisticMutationConfig<TState, TApiResult> {
  optimisticState: TState;
  mutation: (context: IOptimisticMutationContext<TState>) => Promise<TApiResult>;
  onSuccess?: (result: TApiResult, context: IOptimisticMutationContext<TState>) => void;
  onRollback?: (error: unknown, context: IOptimisticMutationContext<TState>) => void;
}

/**
 * Generic optimistic mutation engine for any state container.
 *
 * Applies optimistic state immediately, executes the async mutation, and
 * rolls back to `currentState` on failure unless a custom rollback is provided.
 */
export const useOptimisticMutation = <TState>(setup: IOptimisticMutationSetup<TState>) => {
  const getDataRef = useRef(setup.getData);
  const setDataRef = useRef(setup.setData);

  getDataRef.current = setup.getData;
  setDataRef.current = setup.setData;

  /**
   * Executes one optimistic mutation transaction.
   *
   * @param buildConfig Builds optimistic mutation config from the current state.
   * @returns The mutation result.
   */
  const handleMutation = useCallback(
    async <TApiResult>(
      buildConfig: (currentState: TState) => IOptimisticMutationConfig<TState, TApiResult>
    ): Promise<TApiResult> => {
      const currentState = getDataRef.current();
      const config = buildConfig(currentState);
      const context: IOptimisticMutationContext<TState> = {
        currentState,
        optimisticState: config.optimisticState
      };

      setDataRef.current(config.optimisticState);

      try {
        const result = await config.mutation(context);
        config.onSuccess?.(result, context);
        return result;
      } catch (error) {
        setDataRef.current(currentState);
        config.onRollback?.(error, context);
        throw error;
      }
    },
    []
  );

  return { handleMutation };
};
