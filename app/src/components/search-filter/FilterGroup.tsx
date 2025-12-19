import { mdiChevronDown, mdiChevronRight } from '@mdi/js';
import { Icon } from '@mdi/react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import FilterCheckbox from './FilterCheckbox';
import { ActiveFilter, IFilterGroupProps } from './types';
import { useSearchFilterStyles } from './useSearchFilterStyles';

/**
 * Collapsible filter group component organized by feature type.
 * Displays a header with expand/collapse toggle and a list of FilterCheckbox items.
 *
 * @param {IFilterGroupProps} props
 * @returns {JSX.Element}
 */
export const FilterGroup = (props: IFilterGroupProps) => {
  const {
    id,
    featureTypeName,
    displayName,
    properties,
    defaultExpanded = false,
    activeFilters,
    onAddFilter,
    onRemoveFilter
  } = props;
  const styles = useSearchFilterStyles();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Count active filters in this group (must match both feature type AND property)
  const activeCount = properties.filter((prop) =>
    activeFilters.some((f) => f.featureType === featureTypeName && f.property === prop.name)
  ).length;

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleAddFilter = (propertyName: string, propertyDisplayName: string, type: string, value: string) => {
    const filter: ActiveFilter = {
      featureType: featureTypeName,
      featureTypeDisplayName: displayName,
      property: propertyName,
      propertyType: type === 'datetime' ? 'datetime' : 'text',
      label: propertyDisplayName,
      value
    };
    onAddFilter(filter);
  };

  return (
    <Box data-testid={`filter-group-${id}`}>
      {/* Group header - clickable to expand/collapse */}
      <Box
        sx={styles.filterGroupHeader}
        onClick={handleToggle}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={`filter-group-content-${id}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Icon path={isExpanded ? mdiChevronDown : mdiChevronRight} size={0.8} />
          <span>
            {displayName} ({properties.length})
          </span>
        </Box>
        {activeCount > 0 && (
          <Typography component="span" sx={{ fontSize: '12px', color: '#2E5DD7', fontWeight: 600 }}>
            {activeCount} active
          </Typography>
        )}
      </Box>

      {/* Collapsible content */}
      <Collapse in={isExpanded} id={`filter-group-content-${id}`}>
        <Box sx={{ pl: 2, pb: 1 }}>
          {properties.map((prop) => {
            // Match filter by both feature type AND property name
            const activeFilter = activeFilters.find(
              (f) => f.featureType === featureTypeName && f.property === prop.name
            );
            return (
              <FilterCheckbox
                key={prop.name}
                name={prop.name}
                displayName={prop.displayName}
                type={prop.type}
                isActive={!!activeFilter}
                value={activeFilter?.value}
                onAdd={(value) => handleAddFilter(prop.name, prop.displayName, prop.type, value)}
                onRemove={() => onRemoveFilter(featureTypeName, prop.name)}
              />
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default FilterGroup;
