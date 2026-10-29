import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { FORM_CODES_PAGINATION } from 'constants/form';
import { useApi } from 'hooks/useApi';
import { useState } from 'react';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { FormSubmissionCodesPanel } from '../panel/FormSubmissionCodesPanel';

interface IFormSubmissionCodesContentProps {
  /** Form slug. */
  slug: string;
}

/**
 * Codes tab of the form submission page: the codesets of the form's contributor on the left and, in the sidebar, the
 * codes of the selected codeset. Administrators provision codesets beforehand; submitters pick codes from them in code
 * fields and cannot add their own. Ended codesets are not listed.
 *
 * @param {IFormSubmissionCodesContentProps} props
 * @returns {JSX.Element} Codesets and the selected codeset's codes.
 */
export const FormSubmissionCodesContent = ({ slug }: IFormSubmissionCodesContentProps) => {
  const biohubApi = useApi();
  const [selectedCodesetId, setSelectedCodesetId] = useState<number | null>(null);

  const codesetsQuery = useQuery({
    queryKey: formQueryKeys.codesets(slug, FORM_CODES_PAGINATION),
    queryFn: ({ signal }) => biohubApi.forms.getFormCodesets(slug, FORM_CODES_PAGINATION, { signal })
  });
  const codesets = (codesetsQuery.data?.codesets ?? []).filter((codeset) => !codeset.record_end_date);
  const selectedCodeset = codesets.find((codeset) => codeset.contributor_codeset_id === selectedCodesetId);

  return (
    <>
      <QueryErrorDialog error={codesetsQuery.error} label="codesets" />
      <Box
        display="grid"
        gridTemplateColumns={{
          xs: '1fr',
          sm: 'minmax(0, 3fr) minmax(360px, 2fr)'
        }}
        gap={2}>
        <PageSection id="form-submission-codesets" label="Codesets">
          {codesets.length === 0 && (
            <Typography variant="body2" color="text.secondary" p={2}>
              No codesets
            </Typography>
          )}
          {codesets.length > 0 && (
            <List disablePadding>
              {codesets.map((codeset) => (
                <ListItemButton
                  key={codeset.contributor_codeset_id}
                  selected={codeset.contributor_codeset_id === selectedCodesetId}
                  onClick={() => setSelectedCodesetId(codeset.contributor_codeset_id)}>
                  <ListItemText primary={codeset.label} secondary={codeset.description ?? codeset.key} />
                </ListItemButton>
              ))}
            </List>
          )}
        </PageSection>
        <Box>
          {selectedCodeset && (
            <FormSubmissionCodesPanel
              slug={slug}
              codeset={selectedCodeset}
              onClose={() => setSelectedCodesetId(null)}
            />
          )}
        </Box>
      </Box>
    </>
  );
};
