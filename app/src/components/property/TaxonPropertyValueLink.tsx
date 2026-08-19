import { ITALICIZED_TAXON_RANKS } from 'constants/taxon';
import { TaxonPropertyValue } from 'interfaces/property-value.interface';
import { useLocation } from 'react-router-dom';
import { buildSubmissionTaxonPath } from 'utils/routes';
import { PropertyValueLink } from './PropertyValueLink';

export interface TaxonPropertyValueLinkProps {
  /** Structured taxon value from the indexed-property read model. */
  value: TaxonPropertyValue;
  /** Submission the referencing feature belongs to. */
  submissionId: string | number;
  /** Submission route base, e.g. `/submission` or `/portal/submission`. */
  featureRouteBasePath: string;
}

/**
 * Renders a taxon value as its `label`, linking to the taxon page under the referencing submission.
 *
 * The label is italicized for ranks written in scientific-name style (genus and below); the TSN and rank
 * are exposed as hover text and `data-*` attributes.
 *
 * @param {TaxonPropertyValueLinkProps} props
 * @returns {JSX.Element}
 */
export const TaxonPropertyValueLink = ({ value, submissionId, featureRouteBasePath }: TaxonPropertyValueLinkProps) => {
  const location = useLocation();

  const italic = value.rank ? ITALICIZED_TAXON_RANKS.has(value.rank.toLowerCase()) : false;
  const title = [`TSN ${value.tsn}`, value.rank].filter(Boolean).join(' · ');

  return (
    <PropertyValueLink
      to={buildSubmissionTaxonPath(featureRouteBasePath, submissionId, value.taxon_id, location.search)}
      label={value.label}
      title={title}
      italic={italic}
      dataAttributes={{ 'data-taxon-id': value.taxon_id, 'data-tsn': value.tsn }}
    />
  );
};
