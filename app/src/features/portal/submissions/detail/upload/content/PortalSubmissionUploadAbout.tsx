import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import {
  SUBMISSION_UPLOAD_DECISION_LABELS,
  SUBMISSION_UPLOAD_JOB_STATUS_LABELS
} from 'constants/submission-upload-status';
import { ISubmissionUploadResponse } from 'interfaces/useSubmissionsApi.interface';
import { useMemo } from 'react';
import { getFormattedDate } from 'utils/Utils';

interface PortalSubmissionUploadAboutRow {
  id: string;
  property: string;
  value: string;
}

interface PortalSubmissionUploadAboutProps {
  /** Upload whose metadata is displayed. */
  upload: ISubmissionUploadResponse;
}

/**
 * Displays a submission upload's metadata for the submission's team as property and value pairs, matching the About
 * sections of other pages.
 *
 * @param {PortalSubmissionUploadAboutProps} props - Upload whose metadata is displayed.
 * @returns {JSX.Element} The upload About section.
 */
export const PortalSubmissionUploadAbout = ({ upload }: PortalSubmissionUploadAboutProps) => {
  const columns = useMemo<GridColDef<PortalSubmissionUploadAboutRow>[]>(
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

  const rows = useMemo<PortalSubmissionUploadAboutRow[]>(
    () => [
      {
        id: 'uploaded',
        property: 'Uploaded',
        value: getFormattedDate(DATE_FORMAT.MediumDateFormat, upload.create_date)
      },
      { id: 'status', property: 'Status', value: SUBMISSION_UPLOAD_JOB_STATUS_LABELS[upload.status] },
      { id: 'decision', property: 'Decision', value: SUBMISSION_UPLOAD_DECISION_LABELS[upload.decision] },
      { id: 'upload-id', property: 'Upload ID', value: upload.submission_upload_id }
    ],
    [upload]
  );

  return (
    <PageSection id="submission-upload-about" label="About">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
