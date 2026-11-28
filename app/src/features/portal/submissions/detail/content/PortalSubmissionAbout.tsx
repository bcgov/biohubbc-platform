import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useMemo } from 'react';
import { getFormattedDate } from 'utils/Utils';

interface PortalSubmissionAboutRow {
  id: string;
  property: string;
  value: string;
}

interface PortalSubmissionAboutProps {
  /** Submission whose metadata is displayed. */
  submission: SubmissionRecordWithSecurity;
}

/**
 * Displays a submission's metadata for its team as property and value pairs, matching the About sections of other
 * pages.
 *
 * @param {PortalSubmissionAboutProps} props - Submission whose metadata is displayed.
 * @returns {JSX.Element} The submission About section.
 */
export const PortalSubmissionAbout = ({ submission }: PortalSubmissionAboutProps) => {
  const columns = useMemo<GridColDef<PortalSubmissionAboutRow>[]>(
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

  const rows = useMemo<PortalSubmissionAboutRow[]>(
    () => [
      {
        id: 'submitted',
        property: 'Submitted',
        value: getFormattedDate(DATE_FORMAT.MediumDateFormat, submission.submitted_timestamp)
      },
      {
        id: 'last-approved-upload',
        property: 'Last approved upload',
        value: submission.last_approved_upload_date
          ? getFormattedDate(DATE_FORMAT.MediumDateFormat, submission.last_approved_upload_date)
          : ''
      },
      { id: 'contributor', property: 'Contributor', value: submission.contributor_name },
      { id: 'uuid', property: 'UUID', value: submission.uuid }
    ],
    [submission]
  );

  return (
    <PageSection id="submission-about" label="About">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
