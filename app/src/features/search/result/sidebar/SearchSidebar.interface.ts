// =============================================================================
// Filter Types
// =============================================================================

import { JSX } from 'react';

/** A property within a filter group that can be filtered on */
export interface FilterProperty {
  /** API key / property name */
  name: string;
  /** Display label */
  displayName: string;
  /** Property type */
  type: 'text' | 'number' | 'datetime';
}

/** A group of filter properties organized by feature type */
export interface FilterGroup {
  /** Feature type ID */
  id: number;
  /** Feature type name (API key) */
  name: string;
  /** Display label */
  displayName: string;
  /** Properties within this group */
  properties: FilterProperty[];
}

/** An active filter applied by the user */
export interface ActiveFilter {
  /** Feature type name (API key) */
  featureType: string;
  /** Feature type display label */
  featureTypeDisplayName: string;
  /** Property name (API key) */
  property: string;
  /** Property type for API */
  propertyType: 'text' | 'datetime' | 'enum';
  /** Property display label */
  label: string;
  /** Current value */
  value: string;
}

// =============================================================================
// Sidebar Component Props
// =============================================================================

/** Props for SearchSidebar */
export interface SearchSidebarProps {
  /** Groups of filters by feature type */
  filterGroups: FilterGroup[];
  /** Currently active filters */
  activeFilters: ActiveFilter[];
  /** Called when filters change */
  onFiltersChange: (filters: ActiveFilter[]) => void;
  /** Optional callback when a filter changes (e.g., trigger search) */
  handleFilterChange?: () => void;
}

/** Props for a generic filter section (popular / group) */
export interface SearchSidebarSectionProps<T = any> {
  /** Section title */
  title: string;
  /** List of options to render */
  options: T[];
  /** If true, show a search input */
  searchable?: boolean;
  /** Render function for each option */
  renderOption: (option: T) => JSX.Element;
}
