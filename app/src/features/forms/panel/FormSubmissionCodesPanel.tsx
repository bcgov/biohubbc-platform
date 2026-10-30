import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { FORM_CODES_PAGINATION } from 'constants/form';
import { useApi } from 'hooks/useApi';
import { IContributorCodeset } from 'interfaces/useContributorsApi.interface';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';

interface IFormSubmissionCodesPanelProps {
  /** Form slug. */
  slug: string;
  /** Selected codeset. */
  codeset: IContributorCodeset;
  /** Clears the selected codeset, closing the panel. */
  onClose: () => void;
}

/**
 * Sidebar of the Codes tab: the codes of the selected codeset of the form's contributor. Ended codes are not listed.
 *
 * @param {IFormSubmissionCodesPanelProps} props
 * @returns {JSX.Element} Codes of the selected codeset.
 */
export const FormSubmissionCodesPanel = ({ slug, codeset, onClose }: IFormSubmissionCodesPanelProps) => {
  const biohubApi = useApi();

  const codesQuery = useQuery({
    queryKey: formQueryKeys.codes(slug, codeset.contributor_codeset_id, FORM_CODES_PAGINATION),
    queryFn: ({ signal }) =>
      biohubApi.forms.getFormCodesetCodes(slug, codeset.contributor_codeset_id, FORM_CODES_PAGINATION, { signal })
  });
  const codes = (codesQuery.data?.codes ?? []).filter((code) => !code.record_end_date);

  return (
    <>
      <QueryErrorDialog error={codesQuery.error} label="codes" />
      <PageSection
        id="form-submission-codes"
        label={`${codeset.label} Codes`}
        headerContent={
          <IconButton aria-label="Close codes" onClick={onClose}>
            <Icon path={mdiClose} size={0.8} />
          </IconButton>
        }>
        {codes.length === 0 && (
          <Typography variant="body2" color="text.secondary" p={2}>
            No codes
          </Typography>
        )}
        {codes.length > 0 && (
          <List dense>
            {codes.map((code) => (
              <ListItem key={code.contributor_codeset_code_id}>
                <ListItemText primary={code.label} secondary={code.description ?? code.key} />
              </ListItem>
            ))}
          </List>
        )}
      </PageSection>
    </>
  );
};
