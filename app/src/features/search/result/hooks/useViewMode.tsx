import { useState } from 'react';

/**
 * Toggles the search results view between table and list format
 *
 * @returns {*}
 */
export const useViewMode = () => {
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');

  const toggleViewMode = () => {
    setViewMode((prevMode) => (prevMode === 'table' ? 'list' : 'table'));
  };

  return {
    viewMode,
    toggleViewMode
  };
};
