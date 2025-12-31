import { ChangeEvent } from 'react';

// =============================================================================
// Filter Option Types (for dropdown/sidebar)
// =============================================================================

/**
 * A single filter option representing a searchable property.
 */
export interface FilterOption {
  name: string;
  displayName: string;
  type: 'text' | 'enum' | 'datetime';
  values?: string[]; // For enum type
}

/**
 * A property within a filter group that can be filtered on.
 */
export interface FilterProperty {
  /** Property name (API key, e.g., "focal_species") */
  name: string;
  /** Display label (e.g., "Focal Species") */
  displayName: string;
  /** Property type for input rendering */
  type: 'text' | 'number' | 'datetime';
}

/**
 * A group of filter properties organized by feature type.
 */
export interface FilterGroup {
  /** Feature type ID */
  id: number;
  /** Feature type name (e.g., "animal", "dataset") */
  name: string;
  /** Display name (e.g., "Animal", "Dataset") */
  displayName: string;
  /** Properties within this group */
  properties: FilterProperty[];
}

// =============================================================================
// Active Filter Types
// =============================================================================

/**
 * An active filter applied by the user.
 */
export interface ActiveFilter {
  /** Feature type name (e.g., "dataset", "animal") */
  featureType: string;
  /** Feature type display name (e.g., "Dataset", "Animal") */
  featureTypeDisplayName: string;
  /** Property name (API key) */
  property: string;
  /** Property type for API mapping */
  propertyType: 'text' | 'datetime' | 'enum';
  /** Property display label */
  label: string;
  /** Filter value */
  value: string;
}

// =============================================================================
// Component Props
// =============================================================================

/**
 * Props for the SearchInput component (keyword search only).
 */
export interface ISearchInputProps {
  placeholderText: string;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  value: string;
  onClear?: () => void;
}

/**
 * Props for the FilterSidebar component.
 */
export interface IFilterSidebarProps {
  /** Grouped filter options by feature type */
  filterGroups: FilterGroup[];
  /** Currently active filters */
  activeFilters: ActiveFilter[];
  /** Called when filters change */
  onFiltersChange: (filters: ActiveFilter[]) => void;
}

/**
 * Props for the FilterGroup component (collapsible category).
 */
export interface IFilterGroupProps {
  /** Feature type ID */
  id: number;
  /** Feature type name (API key, e.g., "animal") */
  featureTypeName: string;
  /** Display name (e.g., "Animal") */
  displayName: string;
  /** Properties in this group */
  properties: FilterProperty[];
  /** Initially expanded? */
  defaultExpanded?: boolean;
  /** Active filters for highlighting checked items */
  activeFilters: ActiveFilter[];
  /** Called when a filter is added */
  onAddFilter: (filter: ActiveFilter) => void;
  /** Called when a filter is removed (needs both feature type and property to identify) */
  onRemoveFilter: (featureType: string, propertyName: string) => void;
}

/**
 * Props for the FilterCheckbox component (individual property).
 */
export interface IFilterCheckboxProps {
  /** Property name (API key) */
  name: string;
  /** Display label */
  displayName: string;
  /** Input type */
  type: 'text' | 'number' | 'datetime';
  /** Whether filter is active */
  isActive: boolean;
  /** Current value if active */
  value?: string;
  /** Called when filter is added with a value */
  onAdd: (value: string) => void;
  /** Called when filter is removed */
  onRemove: () => void;
}

/**
 * Props for the FilterDrawer component (mobile/tablet wrapper).
 */
export interface IFilterDrawerProps {
  /** Grouped filter options by feature type */
  filterGroups: FilterGroup[];
  /** Currently active filters */
  activeFilters: ActiveFilter[];
  /** Called when filters change */
  onFiltersChange: (filters: ActiveFilter[]) => void;
  /** Number of active filters (for badge) */
  activeFilterCount: number;
}
