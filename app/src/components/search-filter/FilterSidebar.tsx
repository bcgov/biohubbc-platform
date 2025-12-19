import { mdiClose, mdiMagnify, mdiStar } from '@mdi/js';
import { Icon } from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { memo, useMemo, useState } from 'react';
import FilterCheckbox from './FilterCheckbox';
import FilterGroup from './FilterGroup';
import { ActiveFilter, FilterGroup as FilterGroupType, FilterProperty, IFilterSidebarProps } from './types';
import { useSearchFilterStyles } from './useSearchFilterStyles';

/** Property names to show in the "Popular" section */
const POPULAR_PROPERTY_NAMES = ['scientific_name', 'start_date', 'end_date', 'sex', 'count', 'method_name'];

/** Popular filter with feature type context */
interface PopularFilter extends FilterProperty {
  featureTypeName: string;
  featureTypeDisplayName: string;
}

/**
 * Sidebar component for filtering search results by property.
 * Displays filter groups organized by feature type with collapsible sections.
 *
 * @param {IFilterSidebarProps} props
 * @returns {JSX.Element}
 */
export const FilterSidebar = memo((props: IFilterSidebarProps) => {
  const { filterGroups, activeFilters, onFiltersChange } = props;
  const styles = useSearchFilterStyles();

  // Search term for filtering the filter list
  const [searchTerm, setSearchTerm] = useState('');

  // Extract popular filters from all groups
  const popularFilters = useMemo((): PopularFilter[] => {
    const popular: PopularFilter[] = [];

    filterGroups.forEach((group) => {
      group.properties.forEach((prop) => {
        if (POPULAR_PROPERTY_NAMES.includes(prop.name)) {
          popular.push({
            ...prop,
            featureTypeName: group.name,
            featureTypeDisplayName: group.displayName
          });
        }
      });
    });

    // Sort by the order in POPULAR_PROPERTY_NAMES, then by feature type
    return popular.sort((a, b) => {
      const aIndex = POPULAR_PROPERTY_NAMES.indexOf(a.name);
      const bIndex = POPULAR_PROPERTY_NAMES.indexOf(b.name);
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.featureTypeDisplayName.localeCompare(b.featureTypeDisplayName);
    });
  }, [filterGroups]);

  // Filter groups based on search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) {
      return filterGroups;
    }

    const term = searchTerm.toLowerCase();
    return filterGroups
      .map((group) => ({
        ...group,
        properties: group.properties.filter(
          (prop) => prop.displayName.toLowerCase().includes(term) || prop.name.toLowerCase().includes(term)
        )
      }))
      .filter((group) => group.properties.length > 0);
  }, [filterGroups, searchTerm]);

  // Handle clearing all filters
  const handleClearFilters = () => {
    onFiltersChange([]);
  };

  // Handle adding a filter
  const handleAddFilter = (filter: ActiveFilter) => {
    // Check if filter already exists (must match both feature type AND property)
    const exists = activeFilters.find((f) => f.featureType === filter.featureType && f.property === filter.property);
    if (exists) {
      // Update existing filter value
      onFiltersChange(
        activeFilters.map((f) => (f.featureType === filter.featureType && f.property === filter.property ? filter : f))
      );
    } else {
      onFiltersChange([...activeFilters, filter]);
    }
  };

  // Handle removing a filter (needs both feature type and property to identify)
  const handleRemoveFilter = (featureType: string, propertyName: string) => {
    onFiltersChange(activeFilters.filter((f) => !(f.featureType === featureType && f.property === propertyName)));
  };

  return (
    <Box sx={styles.filterSidebar}>
      {/* Header */}
      <Typography sx={styles.filterSidebarHeader}>Filters</Typography>

      {/* Search input */}
      <Box sx={styles.filterSearchContainer}>
        <InputBase
          fullWidth
          placeholder="Search filters..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startAdornment={
            <InputAdornment position="start">
              <Icon path={mdiMagnify} size={0.8} style={{ color: '#697386' }} />
            </InputAdornment>
          }
          endAdornment={
            searchTerm ? (
              <InputAdornment position="end">
                <Button
                  size="small"
                  sx={{ minWidth: 'auto', padding: '2px' }}
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search">
                  <Icon path={mdiClose} size={0.6} style={{ color: '#697386' }} />
                </Button>
              </InputAdornment>
            ) : null
          }
          sx={styles.filterSearchInput}
        />
      </Box>

      {/* Popular Filters Section */}
      {popularFilters.length > 0 && !searchTerm && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Icon path={mdiStar} size={0.7} style={{ color: '#F59E0B' }} />
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#697386', textTransform: 'uppercase' }}>
              Popular
            </Typography>
          </Box>
          <Box sx={{ pl: 0.5, mb: 2 }}>
            {popularFilters.map((filter) => {
              const activeFilter = activeFilters.find(
                (f) => f.featureType === filter.featureTypeName && f.property === filter.name
              );
              return (
                <FilterCheckbox
                  key={`${filter.featureTypeName}-${filter.name}`}
                  name={filter.name}
                  displayName={`${filter.displayName} (${filter.featureTypeDisplayName})`}
                  type={filter.type}
                  isActive={!!activeFilter}
                  value={activeFilter?.value}
                  onAdd={(value) => {
                    const newFilter: ActiveFilter = {
                      featureType: filter.featureTypeName,
                      featureTypeDisplayName: filter.featureTypeDisplayName,
                      property: filter.name,
                      propertyType: filter.type === 'datetime' ? 'datetime' : 'text',
                      label: filter.displayName,
                      value
                    };
                    handleAddFilter(newFilter);
                  }}
                  onRemove={() => handleRemoveFilter(filter.featureTypeName, filter.name)}
                />
              );
            })}
          </Box>
          <Divider sx={{ my: 1.5 }} />
        </>
      )}

      {/* All Filter Groups */}
      <Box sx={styles.filterGroupsContainer}>
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group: FilterGroupType) => (
            <FilterGroup
              key={group.id}
              id={group.id}
              featureTypeName={group.name}
              displayName={group.displayName}
              properties={group.properties}
              activeFilters={activeFilters}
              onAddFilter={handleAddFilter}
              onRemoveFilter={handleRemoveFilter}
            />
          ))
        ) : (
          <Typography sx={{ color: '#697386', fontSize: '14px', textAlign: 'center', py: 2 }}>
            No filters match your search
          </Typography>
        )}
      </Box>

      {/* Clear filters button */}
      {activeFilters.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Button fullWidth variant="text" onClick={handleClearFilters} sx={styles.clearFiltersButton}>
            Clear all filters ({activeFilters.length})
          </Button>
        </>
      )}
    </Box>
  );
});

export default FilterSidebar;
