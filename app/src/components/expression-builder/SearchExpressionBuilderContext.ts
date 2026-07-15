import { createContext, useContext } from 'react';
import { SearchExpressionBuilderContextValue } from './SearchExpressionBuilder.interface';

const SearchExpressionBuilderContext = createContext<SearchExpressionBuilderContextValue>({});

/**
 * Provides search builder callbacks to slot components rendered by the shared expression builder.
 */
export const SearchExpressionBuilderProvider = SearchExpressionBuilderContext.Provider;

/**
 * Reads search builder callbacks for slot components.
 *
 * @returns {SearchExpressionBuilderContextValue} Search builder callback context.
 */
export const useSearchExpressionBuilderContext = (): SearchExpressionBuilderContextValue => {
  return useContext(SearchExpressionBuilderContext);
};
