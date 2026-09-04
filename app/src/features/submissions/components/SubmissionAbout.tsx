import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useMemo } from 'react';
import { getFormattedDate } from 'utils/Utils';

interface SubmissionAboutRow {
  id: string;
  property: string;
  value: string;
}

interface SubmissionAboutProps {
  /** Submission whose identifying metadata is displayed. */
  submission: SubmissionRecordWithSecurity;
}

/**
 * Displays identifying metadata for a submission.
 *
 * @param {SubmissionAboutProps} props - Submission displayed in the About section.
 * @returns {JSX.Element} The submission About section.
 */
export const SubmissionAbout = ({ submission }: SubmissionAboutProps) => {
  const columns = useMemo<GridColDef<SubmissionAboutRow>[]>(
    () => [
      { field: 'property', headerName: 'Property', flex: 0.3 },
      {
        field: 'value',
        headerName: 'Value',
        flex: 0.7,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.value} sx={{ width: '100%' }}>
            {params.value}
          </Typography>
        )
      }
    ],
    []
  );

  const rows = useMemo<SubmissionAboutRow[]>(
    () => [
      {
        id: 'create-date',
        property: 'Create date',
        value: getFormattedDate(DATE_FORMAT.MediumDateFormat, submission.create_date)
      },
      {
        id: 'last-updated',
        property: 'Last updated',
        value: getFormattedDate(
          DATE_FORMAT.MediumDateFormat,
          submission.last_approved_upload_date ?? submission.create_date
        )
      },
      { id: 'contributor', property: 'Contributor', value: submission.contributor_name }
    ],
    [submission]
  );

  return (
    <PageSection id="submission-about" label="About">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
