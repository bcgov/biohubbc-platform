import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
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
}

/**
 * Renders the structured header for the feature search result page.
 *
 * Combines the expression-aware search input with feature-type tabs. Page-level
 * hooks own expression apply behavior and tab navigation.
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
  onFeatureTypeChange
}: SearchResultPageHeaderProps) => {
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
        featureTypeLinks.length > 0 ? (
          <TabGroup
            value={activeFeatureType}
            onChange={onFeatureTypeChange}
            ariaLabel="Search feature types"
            tabs={featureTypeLinks}
          />
        ) : undefined
      }
    />
  );
};
