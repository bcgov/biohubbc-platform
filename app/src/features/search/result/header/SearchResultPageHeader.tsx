import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { PageHeader } from 'components/header/PageHeader';
import { FeatureTypeTabs } from 'components/tabs/FeatureTypeTabs';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ReactNode } from 'react';
import { ISearchContainerLink } from '../../container/tab/SearchTabs.interface';
import { SearchResultSearch } from './SearchResultSearch';

interface SearchResultPageHeaderProps {
  /** Feature type currently resolved from the `/search/:featureType` route. */
  activeFeatureType: string;
  /** Ordered feature-type tabs available for the current code metadata. */
  featureTypeLinks: ISearchContainerLink[];
  /** Search text from the current URL query string. */
  searchTerm: string;
  /** Expression tree currently applied to result requests. */
  expressionTree: ExpressionTreeExpression | null;
  /** Applies a new expression tree from the search expression builder. */
  onExpressionApply: (expressionTree: ExpressionTreeExpression | null) => void;
  /** Navigates to another feature-type result tab while preserving relevant query params. */
  onFeatureTypeChange: (featureTypeName: string) => void;
  /** Optional content at the end of the tab row, set apart from the feature-type tabs by a divider. */
  tabsEndContent?: ReactNode;
}

/**
 * Renders the structured header for the feature search result page.
 *
 * Combines the expression-aware search input with a tab for every feature type, in the shared scrollable
 * `FeatureTypeTabs` row. Optional end content follows the tabs after a vertical divider. Page-level hooks own expression
 * apply behavior and tab navigation.
 *
 * @param {SearchResultPageHeaderProps} props - Current feature type, search state, tab links, and header callbacks.
 * @returns {JSX.Element} Page header with search expression input and feature-type tabs.
 */
export const SearchResultPageHeader = ({
  activeFeatureType,
  featureTypeLinks,
  searchTerm,
  expressionTree,
  onExpressionApply,
  onFeatureTypeChange,
  tabsEndContent
}: SearchResultPageHeaderProps) => {
  const hasTabs = featureTypeLinks.length > 0 || Boolean(tabsEndContent);

  return (
    <PageHeader
      maxWidth="lg"
      subheader={
        <SearchResultSearch
          searchTerm={searchTerm}
          expressionTree={expressionTree}
          onExpressionApply={onExpressionApply}
        />
      }
      tabs={
        hasTabs ? (
          <Stack direction="row" gap={3}>
            <FeatureTypeTabs
              activeFeatureType={activeFeatureType}
              featureTypes={featureTypeLinks}
              onFeatureTypeChange={onFeatureTypeChange}
              ariaLabel="Search feature types"
              data-testid="search-feature-type-tabs"
            />
            {tabsEndContent && (
              <>
                <Divider orientation="vertical" flexItem />
                {tabsEndContent}
              </>
            )}
          </Stack>
        ) : undefined
      }
    />
  );
};
