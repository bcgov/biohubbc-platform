import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { useMemo } from 'react';
import { getFormattedDate } from 'utils/Utils';

interface SubmissionFeatureAboutRow {
  id: string;
  property: string;
  value: string;
}

export interface SubmissionFeatureAboutProps {
  feature: ISubmissionFeature;
}

/**
 * Displays identifying metadata for a submission feature.
 *
 * @param {SubmissionFeatureAboutProps} props - Submission feature whose identifying metadata is displayed.
 * @returns {JSX.Element} The submission feature About section.
 */
export const SubmissionFeatureAbout = ({ feature }: SubmissionFeatureAboutProps) => {
  const columns = useMemo<GridColDef<SubmissionFeatureAboutRow>[]>(
    () => [
      {
        field: 'property',
        headerName: 'Property',
        flex: 0.3
      },
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

  const rows = useMemo<SubmissionFeatureAboutRow[]>(
    () => [
      {
        id: 'create-date',
        property: 'Create date',
        value: getFormattedDate(DATE_FORMAT.MediumDateFormat, feature.create_date)
      },
      { id: 'contributor', property: 'Contributor', value: feature.contributor_name },
      { id: 'uuid', property: 'UUID', value: feature.uuid }
    ],
    [feature]
  );

  return (
    <PageSection id="submission-feature-about" label="About">
      <CustomDataGrid autoHeight rows={rows} columns={columns} disableColumnSelector hideFooter rowSelection={false} />
    </PageSection>
  );
};
