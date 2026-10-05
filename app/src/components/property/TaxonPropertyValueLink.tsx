import { ITALICIZED_TAXON_RANKS } from 'constants/taxon';
import { TaxonPropertyValue } from 'interfaces/property-value.interface';
import { type SubmissionTaxonPathResolver } from 'utils/routes.interface';
import { PropertyValueLink } from './PropertyValueLink';

interface TaxonPropertyValueLinkProps {
  value: TaxonPropertyValue;
  submissionId: number;
  getSubmissionTaxonPath: SubmissionTaxonPathResolver;
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
export const TaxonPropertyValueLink = ({
  value,
  submissionId,
  getSubmissionTaxonPath
}: TaxonPropertyValueLinkProps) => {
  const italic = value.rank ? ITALICIZED_TAXON_RANKS.has(value.rank.toLowerCase()) : false;
  const title = [`TSN ${value.tsn}`, value.rank].filter(Boolean).join(' · ');

  return (
    <PropertyValueLink
      to={getSubmissionTaxonPath(submissionId, value.taxon_id)}
      label={value.label}
      title={title}
      italic={italic}
    />
  );
};
